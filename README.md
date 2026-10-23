<div align="center">

# cursor2api

Unofficial bridge that turns a **Cursor** account into a local **OpenAI-compatible API**.

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)

[🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

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

## One command

Point the tool at your Cursor API keys (`api-keys.txt`, one `key_…` per line) and it builds verified
bridge credentials — exchange, live chat probe, keep only the 200s:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

A definite reject (401/403, an exhausted quota, a disabled account) is recorded as
`key`, reason and ISO time in `keys-dead.txt` next to `keys.txt`; a 429/5xx/transport failure is
retried and never marked dead. `--dry` prints the plan and writes nothing.

> **Quality gates.** Every credential here passed a live `chat-200` before it was written to `keys.txt`
> (dead keys are never shipped). Router combos follow the same rule at the model level: an entry is
> added **only if the model answers `chat-200` and can call tools** — a model without tool support,
> a dead key or a dead provider is dropped instead of added. Works with **9Router and OmniRoute**.

> ⚠️ **Terms & account risk.** cursor2api is an unofficial bridge: automating a provider can violate
> its Terms of Service and get accounts or IPs banned. You run this on accounts you own, from your own
> machine, at your own risk. Read the provider's ToS before a large run.

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

## 🔌 Connect to 9Router

[9Router](https://9router.com) talks to this bridge as a plain OpenAI-compatible provider:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: anything non-empty (or the value you passed to `--key`)
4. Model: any id from `GET /v1/models`

Or let the bundled connector do those four steps for you — it creates the provider node and the connection on a local 9Router:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Defaults: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Start the bridge first (`node bin/cursor2api.js serve`); 9Router then lists the models as `cursor2api/<model id>`. The bridge is a normal local OpenAI server, so Cline, Continue, Open WebUI, LiteLLM or any `OPENAI_BASE_URL` client work the same way.

## 🔌 Connect to OmniRoute

[OmniRoute](https://omniroute.online) talks to this bridge as a plain OpenAI-compatible provider:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: anything non-empty (or the value you passed to `--key`)
4. Model: any id from `GET /v1/models`

Or let the bundled connector do those four steps for you — it creates the provider node and the connection on a local OmniRoute:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Defaults: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Start the bridge first (`node bin/cursor2api.js serve`); OmniRoute then lists the models as `cursor2api/<model id>`. The bridge is a normal local OpenAI server, so Cline, Continue, Open WebUI, LiteLLM or any `OPENAI_BASE_URL` client work the same way.

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
