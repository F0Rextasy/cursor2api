// Token store: one Cursor account per store file.
//
//   { accessToken, refreshToken, email?, machineId?, clientKey?, expiresAt? }
//
// The access token is a WorkOS JWT (~1 h). Refresh goes through
// `POST /auth/exchange_user_api_key` with the refresh token as bearer (see
// src/login.js); when that fails the CLI tells the user to run `login` again.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { config } from "./config.js";

const defaultPath = path.join(os.homedir(), ".cursor2api", "tokens.json");

export function storePath() {
  return config.storePath || process.env.CURSOR2API_STORE || defaultPath;
}

let cache = null;

export function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(storePath(), "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

export function save(next) {
  cache = next;
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  try {
    fs.chmodSync(file, 0o600);
  } catch {}
  return cache;
}

export function get() {
  return load().account || null;
}

export function set(entry) {
  const all = load();
  all.account = { ...(all.account || {}), ...entry, updatedAt: Date.now() };
  return save(all).account;
}

export function clear() {
  const all = load();
  delete all.account;
  save(all);
}

/** Access tokens are JWTs; read `exp` (ms) so refresh happens before the 401. */
export function expiryOf(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(entry, leadMs = 120_000) {
  if (!entry?.accessToken) return true;
  const exp = entry.expiresAt || expiryOf(entry.accessToken);
  if (!exp) return false;
  return Date.now() > exp - leadMs;
}
