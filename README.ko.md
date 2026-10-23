<div align="center">

# cursor2api

**Cursor** 계정을 로컬 **OpenAI 호환 API**로 바꿔주는 비공식 브리지입니다.

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

두 가지 자격 증명 경로:

- **브라우저 승인** (기본): PKCE 딥 링크 `https://cursor.com/loginDeepControl?challenge=…&uuid=…`를
  cursor.com에 로그인된 브라우저에서 승인한 뒤, 서버가 `{ accessToken, refreshToken }`을 돌려줄 때까지
  `api2.cursor.sh/auth/poll`을 폴링합니다.
- **Cursor API 키**: `cursor2api apikey key_…`가
  `POST api2.cursor.sh/auth/exchange_user_api_key`를 통해 키를 교환합니다 — 브라우저가 필요 없습니다.

> 비공식이며 Cursor와 제휴 관계가 없습니다. 본인이 소유한 계정으로 사용하고 Cursor의 약관을 준수하세요.
> 이 브리지는 비공개 엔드포인트와 통신하므로 예고 없이 변경될 수 있습니다.

## 요구 사항

- Node.js **18+** (의존성 없음).
- Cursor 계정 (무료 *Hobby* 플랜도 됩니다 — 브리지는 플랜 등급을 신경 쓰지 않으며,
  계정 자체의 권한이 어떤 모델이 응답할지 결정합니다).

## 설치

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

또는 폴더를 아무 곳에나 두고 `node /path/to/cursor2api/bin/cursor2api.js …`를 호출하세요. 빌드
단계도 `npm install`도 없습니다 (Node 18+는 브리지가 사용하는 모든 것을 제공합니다).

## 단일 명령

도구를 Cursor API 키(`api-keys.txt`, 한 줄에 `key_…` 하나)로 지정하면 검증된
브리지 자격 증명을 만들어냅니다 — 교환, 실시간 채팅 프로브, 200 응답만 유지:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

명확한 거부(401/403, 소진된 할당량, 비활성화된 계정)는 `keys.txt` 옆의
`keys-dead.txt`에 `key`, 사유, ISO 시각으로 기록됩니다. 429/5xx/전송 실패는
재시도되며 절대 dead로 표시되지 않습니다. `--dry`는 플랜을 출력하고 아무것도 쓰지 않습니다.

> **품질 게이트.** 여기의 모든 자격 증명은 `keys.txt`에 기록되기 전에 실시간 `chat-200`을 통과했습니다
> (dead 키는 절대 배포되지 않습니다). 라우터 콤보도 모델 수준에서 같은 규칙을 따릅니다: 모델이
> `chat-200`으로 응답하고 도구를 호출할 수 **있는 경우에만** 항목이 추가됩니다 — 도구 지원이 없는 모델,
> dead 키, dead 제공자는 추가되지 않고 제거됩니다. **9Router와 OmniRoute**에서 작동합니다.

> ⚠️ **약관 및 계정 위험.** cursor2api는 비공식 브리지입니다: 제공자를 자동화하면
> 서비스 약관을 위반하여 계정이나 IP가 차단될 수 있습니다. 본인이 소유한 계정으로, 본인의
> 머신에서, 본인의 책임하에 실행하세요. 대규모 실행 전에 제공자의 약관을 읽어보세요.

## 빠른 시작

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | PKCE 브라우저 승인; 토큰은 `~/.cursor2api/tokens.json`에 저장됩니다. |
| `cursor2api apikey <key_…>` | Cursor API 키를 토큰 쌍으로 교환합니다 (브라우저 불필요). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | 로컬 API를 시작합니다. |
| `cursor2api status` | 토큰 상태 + 플랜 + 현재 기간 사용량. |
| `cursor2api models` | 이 계정의 모델 id (정적 목록으로 대체됨). |
| `cursor2api usage` | 원시 플랜/사용량 페이로드. |
| `cursor2api logout` | 저장된 토큰을 삭제합니다. |

## 엔드포인트

| 라우트 | 형태 | 비고 |
| --- | --- | --- |
| `GET /v1/models` | OpenAI 모델 목록 | `GetUsableModels` → `AvailableModels` → 정적 카탈로그. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + SSE 스트리밍. |
| `GET /v1/usage` | Cursor 플랜 + 기간 사용량 | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | 활성 상태. |

## 🔌 9Router에 연결

[9Router](https://9router.com)는 이 브리지를 일반 OpenAI 호환 제공자로 취급합니다:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: 비어 있지 않은 아무 값 (또는 `--key`에 전달한 값)
4. Model: `GET /v1/models`의 아무 id

또는 번들된 커넥터가 이 네 단계를 대신 수행하게 하세요 — 로컬 9Router에 제공자 노드와 연결을 생성합니다:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

기본값: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. 먼저 브리지를 시작하세요 (`node bin/cursor2api.js serve`). 그러면 9Router가 모델을 `cursor2api/<model id>`로 나열합니다. 브리지는 일반 로컬 OpenAI 서버이므로 Cline, Continue, Open WebUI, LiteLLM 또는 모든 `OPENAI_BASE_URL` 클라이언트도 같은 방식으로 작동합니다.

## 🔌 OmniRoute에 연결

[OmniRoute](https://omniroute.online)는 이 브리지를 일반 OpenAI 호환 제공자로 취급합니다:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: 비어 있지 않은 아무 값 (또는 `--key`에 전달한 값)
4. Model: `GET /v1/models`의 아무 id

또는 번들된 커넥터가 이 네 단계를 대신 수행하게 하세요 — 로컬 OmniRoute에 제공자 노드와 연결을 생성합니다:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

기본값: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. 먼저 브리지를 시작하세요 (`node bin/cursor2api.js serve`). 그러면 OmniRoute가 모델을 `cursor2api/<model id>`로 나열합니다. 브리지는 일반 로컬 OpenAI 서버이므로 Cline, Continue, Open WebUI, LiteLLM 또는 모든 `OPENAI_BASE_URL` 클라이언트도 같은 방식으로 작동합니다.

## 업스트림 호출이 작동하는 방식

Cursor의 API는 `api2.cursor.sh`의 Connect RPC이며, 계정은 WorkOS 아이덴티티입니다:

1. **로그인** — `cursor.com/api/auth/login`이 WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`)으로 리다이렉트합니다. 브리지는 배포된
   `cursor-agent` CLI가 하는 것과 동일한 PKCE 댄스를 수행합니다: `loginDeepControl`에서 S256 챌린지 + `uuid`, `GET /auth/poll`
   (404 = 아직 대기 중), 그리고 `POST /auth/exchange_user_api_key`를 통한 갱신.
2. **아이덴티티 헤더** — 모든 호출은 `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum`, `x-client-key`를 함께 전달합니다.
   체크섬은 `floor(Date.now()/1e6)`을 6바이트에 걸친 롤링 XOR/add 암호로 인코딩하고,
   base64url로 인코딩한 뒤 안정적인 64-hex 머신 id를 덧붙입니다. `x-client-key`는 설치별로
   안정적인 다이제스트입니다. 둘 다 토큰에서 결정론적으로 파생됩니다 (`src/checksum.js`).
3. **채팅** — Connect 프레이밍된
   `StreamUnifiedChatRequestWithTools` 프로토콜 버퍼와 함께 `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools`를 호출합니다: 대화 메시지(`text` + `type`, 1 = human,
   2 = ai), `model_details.model_name`, 요청/대화 id, `unified_mode = CHAT`.
   응답은 `StreamUnifiedChatResponseWithTools`의 Connect 프레임입니다. 브리지는
   `stream_unified_chat_response.text` (및 `thinking.text`)를 읽고 OpenAI 청크와 `[DONE]`을 다시 내보냅니다.
   필드 번호는 추측한 것이 아닙니다: 생성된 `aiserver.v1` 디스크립터에서 읽어냈습니다
   (개발 워크스페이스의 `proxy-lab/.cursor-proto-dump.py`).
4. **카탈로그/플랜**은 JSON 코덱(`content-type: application/json`)과 함께 동일한 Connect RPC를 사용합니다.

## 프록시 (선택 사항)

`CURSOR2API_PROXY` (또는 `--proxy`)를 설정하면 모든 비루프백 호출 — 로그인, 갱신, 카탈로그, 채팅 —
이 해당 프록시를 통해 나갑니다:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

지원: `socks5://`, `socks5h://` (프록시에서 DNS), `socks4a://`, `http://`, `https://`, 선택적
`user:pass@`. 루프백 대상은 프록시를 우회하므로 테스트 스위트의 목이 계속 작동합니다.
터널은 `node:net`/`node:tls`로 직접 구현되었으며, 프록시 실패는 fail-closed입니다: 요청이
조용히 직접 나가는 대신 오류를 냅니다.

## 테스트

```bash
node test/smoke.js
```

**목 Cursor 게이트웨이**에 대해 전체 파이프라인을 실행합니다 — 계정도, 네트워크도 필요 없습니다. 이 테스트는
`/v1/models` 대체, 나가는 클라이언트 헤더(`x-cursor-client-version`, 체크섬 형태),
브리지가 구성하는 Connect 프레이밍 + 프로토콜 버퍼 본문, 스트리밍 변환(델타,
`finish_reason: stop`, `[DONE]`), 비스트리밍 형태를 검증합니다.

## 제한 사항

- **도구 호출은 아직 변환되지 않습니다.** Cursor는 `client_side_tool_v2_call` 프레임(파일 읽기,
  터미널 실행 등)을 스트리밍합니다. 브리지는 이를 버리고 어시스턴트 텍스트만 전달합니다. 멀티턴 컨텍스트는
  호출자가 재생하며, Cursor가 서버 측에 캐시하지 않습니다.
- **비전/첨부 파일은 전달되지 않습니다.** 대화의 이미지와 파일 첨부는
  무시됩니다.
- 액세스 토큰은 약 1시간짜리 JWT입니다. 브리지는 저장된 리프레시 토큰으로 이를 갱신하며, 갱신이
  거부되면 새 `login`을 요청합니다.
- 어떤 모델이 응답하는지, 포함된 허용량이 얼마나 남았는지는 계정 자체의 권한입니다:
  `cursor2api status`가 플랜과 기간 사용량을 출력하므로 차단된 모델이 조용히 넘어가지 않고 드러납니다.

## ⚠️ 계정 위험 및 최소화 방법

Cursor는 모든 요청을 WorkOS 아이덴티티와 자체 사기 탐지에 연결하므로, 차단될 수 있는 것은
브리지가 아니라 계정이라고 생각하세요. 이 브리지가 하는 것과 하지 않는 것:

- **토큰 저장소당 하나의 계정.** `~/.cursor2api/tokens.json`은 단일 계정을 보관합니다. 브리지는
  여러 계정을 하나의 저장소에 멀티플렉싱하지 않으며 계정 간에 아이덴티티를 재사용하지 않습니다.
- **안정적이고 파생된 와이어 아이덴티티.** `machineId` / `x-client-key` / `x-cursor-checksum`은
  해당 계정 자체의 토큰에서 파생되므로, 두 저장소가 Cursor에 같은 지문을 제시하는 일은 없습니다. 저장소를
  머신 간에 복사하고 같은 세션이 계속 작동하기를 기대하지 마세요.
- **트래픽 조정 없음.** 브리지는 IP를 회전시키거나, 버스트로 재시도하거나, 요청이
  로컬 서버에서 온다는 사실을 숨기지 않습니다. 하나의 계정에 분당 수천 건의 요청을 보내는
  팬인(라우터, 공유 에이전트 박스) 뒤에 두면 속도 제한과 권한 변경을 예상하세요 — 계정 자체의
  허용량이 상한입니다.
- **가입은 여기서 자동화되지 않습니다.** `cursor2api login`은 *본인의* 기존 계정을 승인합니다. 브리지는
  계정을 생성하지 않으며, Cursor 자체의 가입 봇/중복 방지 보호는 시도하는 누구에게나 적용됩니다.
- 머신의 송신 경로가 가입한 곳과 다르다면 프록시 옵션을 사용하세요: `--proxy`는
  경로를 이리저리 옮기지 않고 트래픽을 일관되게 유지합니다.

토큰이 모든 모델에 대해 401/403을 반환하기 시작하면, 보통은 브리지가 아니라 계정 문제입니다:
`cursor2api login`을 다시 실행한 뒤 `cursor2api status`로 플랜과 남은 허용량을 확인하세요.

## 라이선스

MIT — [LICENSE](LICENSE)를 참조하세요.