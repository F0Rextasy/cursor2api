// Cursor sign-in (PKCE deep-link flow) and token refresh.
//
//   1. build  https://cursor.com/loginDeepControl?challenge=<S256>&uuid=<uuid>
//             &mode=login&redirectTarget=cli          (the shipped CLI's params)
//   2. the user approves that URL in a browser that is signed in to cursor.com
//   3. poll   GET https://api2.cursor.sh/auth/poll?uuid&verifier
//             404 = still pending · 200 = { accessToken, refreshToken }
//   4. refresh POST /auth/exchange_user_api_key with the refresh token as bearer
//
// Verified against two independent reverse-engineered clients
// (chaseyoungcn/opencodex src/oauth/cursor.ts, amitray007/headroom
// docs/providers/cursor.md) and against the shipped `cursor-agent` bundle
// (proxy-lab/out/.cursor2api/bundle-hits.txt).

import crypto from "node:crypto";
import { API_BASE, AUTH, LOGIN_HOST } from "./config.js";
import { request } from "./http.js";

const POLL_INTERVAL_MS = 1200;
const POLL_BACKOFF = 1.2;
const POLL_MAX_INTERVAL_MS = 10_000;
const POLL_ATTEMPTS = 180;

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** PKCE pair + the CLI's deep-link URL (the verifier never leaves this process). */
export function beginLogin({ redirectTarget = "cli" } = {}) {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const uuid = crypto.randomUUID();
  const url = new URL("/loginDeepControl", LOGIN_HOST);
  url.searchParams.set("challenge", challenge);
  url.searchParams.set("uuid", uuid);
  url.searchParams.set("mode", "login");
  url.searchParams.set("redirectTarget", redirectTarget);
  return { uuid, verifier, loginUrl: url.toString() };
}

export class LoginError extends Error {}

/** Polls `/auth/poll` until the browser approves (404 → pending, 200 → tokens). */
export async function pollLogin({ uuid, verifier }, { onTick, signal, attempts = POLL_ATTEMPTS } = {}) {
  let delay = POLL_INTERVAL_MS;
  let consecutive = 0;
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw new LoginError("login cancelled");
    const url = `${AUTH.poll}?uuid=${encodeURIComponent(uuid)}&verifier=${encodeURIComponent(verifier)}`;
    let res = null;
    try {
      res = await request(url, { method: "GET", signal });
    } catch (err) {
      consecutive++;
      if (consecutive >= 3) throw new LoginError(`poll failed: ${err.message}`);
    }
    if (res) {
      if (res.status === 200) {
        const body = await res.json().catch(() => null);
        if (body?.accessToken && body?.refreshToken) return body;
        throw new LoginError("poll returned 200 without tokens");
      }
      if ([400, 401, 403, 410].includes(res.status)) {
        throw new LoginError(`login was denied or expired (HTTP ${res.status})`);
      }
      consecutive = 0;
    }
    onTick?.({ attempt: i + 1, status: res?.status ?? null });
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(Math.round(delay * POLL_BACKOFF), POLL_MAX_INTERVAL_MS);
  }
  throw new LoginError(`login not approved after ${attempts} polls`);
}

/** Refresh token → fresh credentials (the server may rotate the refresh token). */
export async function refreshTokens(refreshToken) {
  const res = await request(AUTH.exchangeApiKey, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${refreshToken}` },
    body: "{}",
  });
  if (res.status === 403) return null;
  if (!res.ok) throw new LoginError(`refresh failed: HTTP ${res.status}`);
  const body = await res.json().catch(() => null);
  if (!body?.accessToken || !body?.refreshToken) return null;
  return body;
}

/** Exchange a Cursor API key (dashboard → API keys) for the same token pair. */
export async function exchangeApiKey(apiKey) {
  const res = await request(AUTH.exchangeApiKey, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: "{}",
  });
  if (!res.ok) throw new LoginError(`api key exchange failed: HTTP ${res.status}`);
  const body = await res.json().catch(() => null);
  if (!body?.accessToken) throw new LoginError("api key exchange returned no access token");
  return body;
}

export { API_BASE };
