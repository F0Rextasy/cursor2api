// mint.js — bulk-convert Cursor API keys into verified bridge credentials.
//
// cursor2api is a bridge: it does not create Cursor accounts (the README says so).
// What it *can* do in one command is take a pool of Cursor `key_…` API keys,
// exchange each for a token pair (no browser), probe the account with a live chat
// call, and keep only the keys that answer 200 in keys.txt. A definite reject
// (401/403, quota, ban) is recorded as `key<TAB>reason<TAB>ISO` in keys-dead.txt
// next to keys.txt; 429/5xx/transport failures are transient and never marked dead.
//
// One account per token store: each key gets its own store under
// ~/.cursor2api/accounts/, so several accounts coexist (store.js holds one account
// per file and the bridge never multiplexes accounts).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "cli.js");
const API_KEY_FILE = "api-keys.txt";
const PROXY_FILE = "proxies.txt";
const MODEL = "auto";

const readLines = (file) => {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"));
  } catch {
    return [];
  }
};

/** Cursor API keys: `--api-keys <file>` → api-keys.txt → CURSOR2API_API_KEYS. */
function apiKeys(file) {
  const fromFile = file ? readLines(path.resolve(file)) : readLines(path.resolve(API_KEY_FILE));
  if (fromFile.length) return fromFile;
  return String(process.env.CURSOR2API_API_KEYS || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Exits: `--pool <file>` → proxies.txt → a single CURSOR2API_PROXY. */
function exits(poolFile) {
  const lines = poolFile ? readLines(path.resolve(poolFile)) : readLines(path.resolve(PROXY_FILE));
  if (lines.length) return lines;
  return process.env.CURSOR2API_PROXY ? [process.env.CURSOR2API_PROXY] : [];
}

/** One token store per key so several accounts never share a file. */
const storeFor = (key) =>
  path.join(os.homedir(), ".cursor2api", "accounts", `${crypto.createHash("sha1").update(key).digest("hex").slice(0, 16)}.json`);

/**
 * Only a *definite* reject is dead. 429 / 5xx / socket errors are transient:
 * the same key may work on another exit or later, so it is never written to
 * keys-dead.txt.
 */
function classify(status, message) {
  const m = String(message || "");
  if (status === 401 || status === 403) return "auth";
  if (/quota|insufficient|exceeded|allowance/i.test(m)) return "quota";
  if (/deactivat|suspend|bann|disabled|forbidden/i.test(m)) return "ban";
  const http = Number((/HTTP (\d{3})/.exec(m) || [])[1] || 0);
  if (http === 401 || http === 403) return "auth";
  if (http === 404) return "account";
  return null;
}

/** Live chat probe in a child process so each key's own store is the one loaded. */
function probe(storeFile, proxy, model) {
  const env = { ...process.env, CURSOR2API_STORE: storeFile, CURSOR2API_MODEL: model };
  if (proxy) env.CURSOR2API_PROXY = proxy;
  else delete env.CURSOR2API_PROXY;
  const r = spawnSync(process.execPath, [CLI, "probe", "--model", model], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
    env,
  });
  const line = String(r.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
  try {
    return JSON.parse(line);
  } catch {
    return { ok: false, status: 0, error: String(r.stderr || "probe failed").slice(0, 160) };
  }
}

function appendKey(file, key) {
  let have = "";
  try {
    have = fs.readFileSync(file, "utf8");
  } catch {
    /* new file */
  }
  if (have.split(/\r?\n/).map((s) => s.trim()).includes(key)) return;
  fs.appendFileSync(file, (have && !/\n$/.test(have) ? "\n" : "") + key + "\n");
}

function writeDead(file, dead) {
  fs.writeFileSync(file, dead.map((d) => `${d.key}\t${d.why}\t${d.at}`).join("\n") + (dead.length ? "\n" : ""));
}

/**
 * @returns {Promise<{requested:number, live:number, dead:number, dry?:boolean}>}
 */
export async function runMint({ count = 5, poolFile, keysFile, apiKeyFile, model = MODEL, dry = false, log = console.log } = {}) {
  const keys = apiKeys(apiKeyFile);
  const pool = exits(poolFile);
  const KEYS = path.resolve(keysFile || "keys.txt");
  const DEAD = path.join(path.dirname(KEYS), "keys-dead.txt");
  const n = Math.max(1, Number(count) || 1);

  if (dry) {
    log("dry run — nothing is written and no request is sent.");
    log(`  count ${n} · keys ${keys.length ? `${keys.length} in ${apiKeyFile || API_KEY_FILE}` : `none (write ${API_KEY_FILE} or set CURSOR2API_API_KEYS)`} · exits ${pool.length || "direct"} · keys.txt ${KEYS}`);
    return { requested: n, live: 0, dead: 0, dry: true };
  }

  if (!keys.length) {
    log(`no Cursor API keys — put one key_… per line in ${apiKeyFile || API_KEY_FILE} (or set CURSOR2API_API_KEYS).`);
    return { requested: n, live: 0, dead: 0 };
  }

  const { exchangeApiKey } = await import("./login.js");
  const { expiryOf } = await import("./store.js");
  const { configure } = await import("./config.js");

  const slice = keys.slice(0, n);
  log(`cursor2api mint · ${slice.length} key(s) · exits ${pool.length || "direct"} · keys land in ${KEYS}`);

  let live = 0;
  const dead = [];
  for (let i = 0; i < slice.length; i++) {
    const key = slice[i];
    const proxy = pool.length ? pool[i % pool.length] : null;
    configure({ proxy });
    let tokens;
    try {
      tokens = await exchangeApiKey(key);
    } catch (e) {
      const why = classify(e.status, e.message);
      log(`  #${i + 1} ${key.slice(0, 10)}… exchange failed: ${String(e.message).slice(0, 110)}`);
      if (why) dead.push({ key, why, at: new Date().toISOString() });
      continue; // transient exchange failure: not dead
    }
    const storeFile = storeFor(key);
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    fs.writeFileSync(
      storeFile,
      JSON.stringify({ account: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: expiryOf(tokens.accessToken), updatedAt: Date.now() } }, null, 2),
    );
    const p = probe(storeFile, proxy, model);
    if (p.ok) {
      appendKey(KEYS, key);
      live++;
      log(`  #${i + 1} ${key.slice(0, 10)}… chat=${p.status} LIVE`);
    } else {
      const why = classify(p.status, p.error);
      log(`  #${i + 1} ${key.slice(0, 10)}… chat=${p.status} ${why || "transient"}`);
      if (why) dead.push({ key, why, at: new Date().toISOString() });
    }
  }

  writeDead(DEAD, dead);
  log(`done — ${live}/${slice.length} key(s) live in ${KEYS} · ${dead.length} dead in ${DEAD}`);
  return { requested: n, live, dead: dead.length };
}
