> 🌐 **Read this in:** **English** *(this file)* · Türkçe · 中文 · 日本語 · 한국어 · Deutsch · Français ·
> Español · Português · Русский — the nine translations ship in a follow-up pass (`README.<lang>.md`).

# cursor2api

Unofficial bridge that turns a **Cursor** account into a local **OpenAI-compatible API**.

```
OpenAI client / 9router  ──►  cursor2api (local)  ──►  api2.cursor.sh (Connect RPC)
```

Two credential paths:

- **Browser approval** (default): PKCE deep link `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  approved in a browser signed in to cursor.com, then polled at `api2.cursor.sh/auth/poll` until the
  server hands back `{ accessToken, refreshToken }`.
- **Cursor API key**: `cursor2api apikey key_…` exchanges the key through
  `POST api2.cursor.sh/auth/exchange_user_api_key` — no browser.

> Unofficial and not affiliated with Cursor. Use it with an account you own and respect Cursor's terms.
> This bridge talks to private endpoints; they can change without notice.

## Requirements

- Node.js **18+** (no dependencies).
- A Cursor account (the free *Hobby* plan counts — the bridge does not care about the plan tier, the
  account's own entitlements decide which models answer).

## Install

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

Or drop the folder anywhere and call `node /path/to/cursor2api/bin/cursor2api.js …`; there is no build
step and no `npm install` (Node 18+ ships everything the bridge uses).

## Quick start

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Commands

| Command | What it does |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | PKCE browser approval; tokens land in `~/.cursor2api/tokens.json`. |
| `cursor2api apikey <key_…>` | Exchange a Cursor API key for the token pair (no browser). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Start the local API. |
| `cursor2api status` | Token state + plan + current-period usage. |
| `cursor2api models` | Model ids for this account (falls back to the static list). |
| `cursor2api usage` | Raw plan/usage payload. |
| `cursor2api logout` | Delete stored tokens. |

## Endpoints

| Route | Shape | Notes |
| --- | --- | --- |
| `GET /v1/models` | OpenAI models list | `GetUsableModels` → `AvailableModels` → static catalog. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + SSE streaming. |
| `GET /v1/usage` | Cursor plan + period usage | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Liveness. |

## Wiring it into 9router

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: anything non-empty (or the value you passed to `--key`)
4. Model: any id from `GET /v1/models`

## How the upstream call works

Cursor's API is Connect RPC on `api2.cursor.sh`, and the account is a WorkOS identity:

1. **Login** — `cursor.com/api/auth/login` redirects into WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). The bridge does the same PKCE dance the shipped
   `cursor-agent` CLI does: S256 challenge + `uuid` at `loginDeepControl`, `GET /auth/poll`
   (404 = still pending) and a refresh through `POST /auth/exchange_user_api_key`.
2. **Identity headers** — every call carries `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` and `x-client-key`.
   The checksum encodes `floor(Date.now()/1e6)` with a rolling XOR/add cipher over 6 bytes,
   base64url-encodes it and appends a stable 64-hex machine id; `x-client-key` is a stable
   per-install digest. Both are derived deterministically from the token (`src/checksum.js`).
3. **Chat** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools` with a Connect-framed
   `StreamUnifiedChatRequestWithTools` protobuf: conversation messages (`text` + `type`, 1 = human,
   2 = ai), `model_details.model_name`, request/conversation ids, `unified_mode = CHAT`.
   Responses are Connect frames of `StreamUnifiedChatResponseWithTools`; the bridge reads
   `stream_unified_chat_response.text` (and `thinking.text`) and re-emits OpenAI chunks plus `[DONE]`.
   The field numbers are not guessed: they were read out of the generated `aiserver.v1` descriptor
   (`proxy-lab/.cursor-proto-dump.py` in the development workspace).
4. **Catalog/plan** use the same Connect RPC with the JSON codec (`content-type: application/json`).

## Proxy (optional)

Set `CURSOR2API_PROXY` (or `--proxy`) and every non-loopback call — login, refresh, catalog, chat —
leaves through that proxy:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Supported: `socks5://`, `socks5h://` (DNS at the proxy), `socks4a://`, `http://`, `https://`, with
optional `user:pass@`. Loopback targets bypass the proxy so the test suite's mock keeps working.
Tunnels are hand-rolled on `node:net`/`node:tls`, and a proxy failure is fail-closed: the request
errors instead of quietly going direct.

## Tests

```bash
node test/smoke.js
```

Runs the whole pipeline against a **mock Cursor gateway** — no account, no network. It asserts the
`/v1/models` fallback, the outgoing client headers (`x-cursor-client-version`, checksum shape), the
Connect framing + protobuf body the bridge builds, the streaming translation (deltas,
`finish_reason: stop`, `[DONE]`) and the non-streaming shape.

## Limits

- **Tool calls are not translated yet.** Cursor streams `client_side_tool_v2_call` frames (read file,
  run terminal, …); the bridge drops them and forwards assistant text only. Multi-turn context is
  replayed by the caller, not cached server-side by Cursor.
- **Vision/attachments are not forwarded.** Images and file attachments in the conversation are
  ignored.
- Access tokens are ~1 h JWTs; the bridge refreshes them with the stored refresh token, and asks for a
  new `login` when the refresh is rejected.
- Which models answer, and how much of the included allowance is left, is the account's own entitlement:
  `cursor2api status` prints the plan and period usage so a blocked model is visible instead of silent.

## ⚠️ Account risk & how to minimise it

Cursor ties every request to a WorkOS identity and its own fraud checks, so treat the account — not the
bridge — as the thing that can get banned. What this bridge does and does not do:

- **One account per token store.** `~/.cursor2api/tokens.json` holds a single account; the bridge never
  multiplexes several accounts into one store and never reuses an identity across accounts.
- **Stable, derived wire identity.** `machineId` / `x-client-key` / `x-cursor-checksum` are derived from
  that account's own token, so two stores never present the same fingerprint to Cursor. Do not copy a
  store between machines and expect the same session to keep working.
- **No traffic shaping.** The bridge does not rotate IPs, retry in bursts, or hide that requests come from
  a local server. If you put it behind a fan-in (a router, a shared agent box) that fires thousands of
  requests a minute at one account, expect rate limits and entitlement changes — the account's own
  allowance is the ceiling.
- **Signup is not automated here.** `cursor2api login` authorises *your* existing account; the bridge does
  not create accounts, and Cursor's own sign-up bot/dedup protections apply to anyone who tries.
- Use the proxy option if your machine's egress is not the one you signed up from: `--proxy` keeps the
  traffic consistent instead of hopping between routes.

If a token starts answering 401/403 for every model, that is usually the account, not the bridge: run
`cursor2api login` again, then `cursor2api status` to see the plan and remaining allowance.


## License

MIT — see [LICENSE](LICENSE).
