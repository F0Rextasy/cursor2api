#!/usr/bin/env node
// cursor2api CLI:  mint | login | apikey | serve | status | models | usage | logout
//
// Mint (one command): read Cursor API keys, exchange each for tokens, and keep
// the ones that answer a live chat 200 in keys.txt; definite rejects (401/403/
// quota/ban) go to keys-dead.txt next to it. 429/5xx/transport are not "dead".
//
// Global flags:
//   --port <n>        serve port (default 8795)
//   --host <addr>     bind address (default 127.0.0.1)
//   --key <token>     require this bearer token on /v1/*
//   --proxy <url>     upstream proxy (http://, https://, socks5://, socks5h://)
//   --store <path>    token store file (default ~/.cursor2api/tokens.json)
//   --tz <zone>       x-cursor-timezone header (default UTC)
//
// Mint flags:
//   --count <n>       credentials to build (default 5)
//   --api-keys <file> Cursor API keys, one key_… per line (default api-keys.txt)
//   --pool <file>     exits, one per line (default proxies.txt; optional)
//   --keys <file>     output credential file (default keys.txt)
//   --model <id>      model used for the live chat gate (default auto)
//   --dry             print the plan, write nothing

const argv = process.argv.slice(2);

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  return value && !value.startsWith("--") ? value : true;
}

const port = flag("port");
if (port) process.env.CURSOR2API_PORT = String(port);
const host = flag("host");
if (typeof host === "string") process.env.CURSOR2API_HOST = host;
const key = flag("key");
if (typeof key === "string") process.env.CURSOR2API_KEY = key;
const proxy = flag("proxy");
if (typeof proxy === "string") process.env.CURSOR2API_PROXY = proxy;
const storeFlag = flag("store");
if (typeof storeFlag === "string") process.env.CURSOR2API_STORE = storeFlag;
const tz = flag("tz");
if (typeof tz === "string") process.env.CURSOR2API_TZ = tz;

const COMMANDS = new Set(["mint", "login", "apikey", "serve", "status", "models", "usage", "logout", "help"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const MINT = positional[0] === "mint" || argv.includes("--count") || argv.includes("--auto") || argv.includes("--dry");
const cmd = MINT ? "mint" : COMMANDS.has(positional[0]) ? positional[0] : "help";

const { config, KNOWN_MODELS, configure } = await import("../src/config.js");
const store = await import("../src/store.js");
const { beginLogin, pollLogin, exchangeApiKey, LoginError } = await import("../src/login.js");
const { resolveAccount, usableModels, planInfo, CursorError } = await import("../src/cursor.js");

if (flag("store")) configure({ storePath: String(flag("store")) });
configure({ proxy: flag("proxy", config.proxy) || null, apiKey: flag("key", config.apiKey) || null });

function usage() {
  console.log(`cursor2api — one command builds verified credentials from Cursor API keys,
and the same CLI runs the OpenAI-compatible bridge over that account.

  cursor2api mint --count 5 --pool proxies.txt   build 5 verified credentials (keys.txt)
  cursor2api mint --count 5 --dry                print the plan, write nothing
  cursor2api login                 browser approval (PKCE deep link) → tokens
  cursor2api apikey <key_…>        Cursor API key → tokens (no browser)
  cursor2api serve                 start the local OpenAI server
  cursor2api status                show token/plan state
  cursor2api models                list this account's models
  cursor2api usage                 print plan + period usage
  cursor2api logout                delete stored tokens

Mint reads Cursor API keys (one key_… per line) from --api-keys <file> (default
api-keys.txt) or CURSOR2API_API_KEYS, exchanges each for a token pair, and keeps
only the keys that answer a live chat 200 in keys.txt. Definite rejects go to
keys-dead.txt (key, reason, ISO time) next to keys.txt; 429/5xx/transport retry.

Flags: --port 8795 --host 127.0.0.1 --key <bearer> --proxy <url> --store <path> --tz <zone>
Mint:  --count N [5] --api-keys <file> [api-keys.txt] --pool <file> [proxies.txt] --keys <file> [keys.txt] --model <id> [auto] --dry

Env: CURSOR2API_PROXY · CURSOR2API_KEY · CURSOR2API_PORT · CURSOR2API_TZ · CURSOR2API_STORE · CURSOR2API_API_KEYS`);
}

if (cmd === "mint") {
  const { runMint } = await import("../src/mint.js");
  const one = (n, d) => (typeof flag(n) === "string" ? flag(n) : d);
  await runMint({
    count: Number(one("count", 5)) || 5,
    apiKeyFile: one("api-keys", null),
    poolFile: one("pool", null),
    keysFile: one("keys", null),
    model: one("model", "auto"),
    dry: argv.includes("--dry"),
  });
} else if (cmd === "probe") {
  // Internal: mint.js runs this per key with CURSOR2API_STORE pinned to that
  // account's own store file, so one account per store always holds.
  const model = typeof flag("model") === "string" ? flag("model") : "auto";
  try {
    const { streamChat } = await import("../src/cursor.js");
    let text = "";
    for await (const delta of streamChat({ messages: [{ role: "user", content: "reply with the single word: pong" }], model, maxTokens: 32 })) {
      if (delta.type === "text") text += delta.text;
    }
    console.log(JSON.stringify({ ok: !!text, status: 200, text: text.slice(0, 40) }));
    process.exit(text ? 0 : 1);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, status: e.status || 0, error: String(e.message).slice(0, 160) }));
    process.exit(1);
  }
}

if (cmd === "help") {
  usage();
} else if (cmd === "login") {
  const { uuid, verifier, loginUrl } = beginLogin({});
  console.log("Open this URL in a browser that is signed in to cursor.com:\n");
  console.log(`  ${loginUrl}\n`);
  console.log("Waiting for approval…");
  try {
    const tokens = await pollLogin(
      { uuid, verifier },
      { onTick: ({ attempt, status }) => process.stdout.write(`\r  poll #${attempt} (${status ?? "network"})`) }
    );
    store.set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: store.expiryOf(tokens.accessToken),
      authId: tokens.authId || null,
    });
    console.log(`\n✓ signed in (token expires ${new Date(store.expiryOf(tokens.accessToken) || Date.now()).toISOString()})`);
  } catch (err) {
    console.error(`\n✗ ${err instanceof LoginError ? err.message : err.message}`);
    process.exit(1);
  }
} else if (cmd === "apikey") {
  const apiKey = positional[1];
  if (!apiKey) {
    console.error("usage: cursor2api apikey <key_…>");
    process.exit(1);
  }
  const tokens = await exchangeApiKey(apiKey).catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
  store.set({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: store.expiryOf(tokens.accessToken),
  });
  console.log("✓ stored tokens from API key");
} else if (cmd === "logout") {
  store.clear();
  console.log("✓ tokens deleted");
} else if (cmd === "status") {
  const entry = store.get();
  if (!entry?.accessToken) {
    console.log("not logged in — run `cursor2api login`");
    process.exit(1);
  }
  console.log(`store       ${store.storePath()}`);
  console.log(`token       ${entry.accessToken.slice(0, 12)}… (${store.isExpired(entry) ? "expired" : "live"})`);
  console.log(`expires     ${entry.expiresAt ? new Date(entry.expiresAt).toISOString() : "unknown"}`);
  console.log(`proxy       ${config.proxy || "direct"}`);
  const info = await planInfo().catch((e) => ({ error: e.message }));
  console.log(`plan        ${JSON.stringify(info.plan).slice(0, 300)}`);
  console.log(`usage       ${JSON.stringify(info.usage).slice(0, 300)}`);
} else if (cmd === "models") {
  const models = await usableModels().catch(() => KNOWN_MODELS);
  console.log(models.join("\n"));
} else if (cmd === "usage") {
  console.log(JSON.stringify(await planInfo(), null, 2));
} else if (cmd === "serve") {
  const { createServer } = await import("../src/server.js");
  const port = Number(process.env.CURSOR2API_PORT || 8795);
  const host = process.env.CURSOR2API_HOST || "127.0.0.1";
  await resolveAccount().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
  const server = createServer({});
  server.listen(port, host, () => {
    console.log(`cursor2api listening on http://${host}:${port}/v1  (proxy: ${config.proxy || "direct"})`);
  });
}
