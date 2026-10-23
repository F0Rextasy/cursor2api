<div align="center">

# cursor2api

Inoffizielle Brücke, die ein **Cursor**-Konto in eine lokale **OpenAI-kompatible API** verwandelt.

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

Zwei Wege zur Authentifizierung:

- **Browser-Freigabe** (Standard): PKCE-Deep-Link `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  freigegeben in einem Browser, der bei cursor.com angemeldet ist, dann per Polling bei
  `api2.cursor.sh/auth/poll` abgefragt, bis der Server `{ accessToken, refreshToken }` zurückgibt.
- **Cursor-API-Schlüssel**: `cursor2api apikey key_…` tauscht den Schlüssel über
  `POST api2.cursor.sh/auth/exchange_user_api_key` ein — ohne Browser.

> Inoffiziell und nicht mit Cursor verbunden. Verwende es mit einem Konto, das dir gehört, und beachte
> Cursors Nutzungsbedingungen. Diese Brücke spricht mit privaten Endpunkten; diese können sich ohne
> Vorankündigung ändern.

## Voraussetzungen

- Node.js **18+** (keine Abhängigkeiten).
- Ein Cursor-Konto (der kostenlose *Hobby*-Tarif zählt — die Brücke kümmert sich nicht um die Tarifstufe,
  die Berechtigungen des Kontos entscheiden, welche Modelle antworten).

## Installation

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

Oder lege den Ordner irgendwo ab und rufe `node /path/to/cursor2api/bin/cursor2api.js …` auf; es gibt
keinen Build-Schritt und kein `npm install` (Node 18+ bringt alles mit, was die Brücke verwendet).

## Ein Befehl

Richte das Tool auf deine Cursor-API-Schlüssel (`api-keys.txt`, ein `key_…` pro Zeile) und es erstellt
verifizierte Brücken-Anmeldedaten — Austausch, Live-Chat-Test, nur die 200er behalten:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

Eine eindeutige Ablehnung (401/403, ein aufgebrauchtes Kontingent, ein deaktiviertes Konto) wird als
`key`, Grund und ISO-Zeit in `keys-dead.txt` neben `keys.txt` festgehalten; ein 429/5xx/Transportfehler
wird erneut versucht und niemals als tot markiert. `--dry` gibt den Tarif aus und schreibt nichts.

> **Qualitätsprüfungen.** Jede Anmeldedaten hier hat einen Live-`chat-200` bestanden, bevor sie in
> `keys.txt` geschrieben wurde (tote Schlüssel werden nie ausgeliefert). Router-Kombinationen folgen
> derselben Regel auf Modellebene: Ein Eintrag wird **nur hinzugefügt, wenn das Modell `chat-200`
> antwortet und Tools aufrufen kann** — ein Modell ohne Tool-Unterstützung, ein toter Schlüssel oder ein
> toter Anbieter wird verworfen statt hinzugefügt. Funktioniert mit **9Router und OmniRoute**.

> ⚠️ **Bedingungen & Kontorisiko.** cursor2api ist eine inoffizielle Brücke: Die Automatisierung eines
> Anbieters kann gegen dessen Nutzungsbedingungen verstoßen und zur Sperrung von Konten oder IPs führen.
> Du betreibst dies auf Konten, die dir gehören, von deinem eigenen Rechner, auf eigenes Risiko. Lies die
> Nutzungsbedingungen des Anbieters, bevor du einen großen Lauf startest.

## Schnellstart

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Befehle

| Befehl | Was er tut |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | PKCE-Browser-Freigabe; Tokens landen in `~/.cursor2api/tokens.json`. |
| `cursor2api apikey <key_…>` | Tauscht einen Cursor-API-Schlüssel gegen das Token-Paar (ohne Browser). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Startet die lokale API. |
| `cursor2api status` | Token-Status + Tarif + Nutzung des aktuellen Zeitraums. |
| `cursor2api models` | Modell-IDs für dieses Konto (fällt auf die statische Liste zurück). |
| `cursor2api usage` | Rohe Tarif-/Nutzungsdaten. |
| `cursor2api logout` | Löscht gespeicherte Tokens. |

## Endpunkte

| Route | Form | Hinweise |
| --- | --- | --- |
| `GET /v1/models` | OpenAI-Modellliste | `GetUsableModels` → `AvailableModels` → statischer Katalog. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + SSE-Streaming. |
| `GET /v1/usage` | Cursor-Tarif + Zeitraum-Nutzung | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Lebendigkeit. |

## 🔌 Verbindung mit 9Router

[9Router](https://9router.com) spricht mit dieser Brücke als einfacher OpenAI-kompatibler Anbieter:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: anything non-empty (or the value you passed to `--key`)
4. Model: any id from `GET /v1/models`

Oder lass den mitgelieferten Connector diese vier Schritte für dich erledigen — er erstellt den
Anbieterknoten und die Verbindung auf einem lokalen 9Router:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Standardwerte: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`.
Starte zuerst die Brücke (`node bin/cursor2api.js serve`); 9Router listet die Modelle dann als
`cursor2api/<model id>` auf. Die Brücke ist ein normaler lokaler OpenAI-Server, daher funktionieren
Cline, Continue, Open WebUI, LiteLLM oder jeder `OPENAI_BASE_URL`-Client auf dieselbe Weise.

## 🔌 Verbindung mit OmniRoute

[OmniRoute](https://omniroute.online) spricht mit dieser Brücke als einfacher OpenAI-kompatibler Anbieter:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: anything non-empty (or the value you passed to `--key`)
4. Model: any id from `GET /v1/models`

Oder lass den mitgelieferten Connector diese vier Schritte für dich erledigen — er erstellt den
Anbieterknoten und die Verbindung auf einem lokalen OmniRoute:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Standardwerte: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`.
Starte zuerst die Brücke (`node bin/cursor2api.js serve`); OmniRoute listet die Modelle dann als
`cursor2api/<model id>` auf. Die Brücke ist ein normaler lokaler OpenAI-Server, daher funktionieren
Cline, Continue, Open WebUI, LiteLLM oder jeder `OPENAI_BASE_URL`-Client auf dieselbe Weise.

## Wie der Upstream-Aufruf funktioniert

Cursors API ist Connect RPC auf `api2.cursor.sh`, und das Konto ist eine WorkOS-Identität:

1. **Login** — `cursor.com/api/auth/login` leitet in WorkOS AuthKit weiter
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). Die Brücke führt denselben PKCE-Tanz durch wie das
   mitgelieferte `cursor-agent`-CLI: S256-Challenge + `uuid` bei `loginDeepControl`, `GET /auth/poll`
   (404 = noch ausstehend) und eine Aktualisierung über `POST /auth/exchange_user_api_key`.
2. **Identitäts-Header** — jeder Aufruf trägt `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` und `x-client-key`.
   Die Checksumme kodiert `floor(Date.now()/1e6)` mit einer rollierenden XOR/Add-Chiffre über 6 Bytes,
   base64url-kodiert sie und hängt eine stabile 64-Hex-Maschinen-ID an; `x-client-key` ist ein stabiler
   Digest pro Installation. Beide werden deterministisch aus dem Token abgeleitet (`src/checksum.js`).
3. **Chat** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools` mit einem Connect-gerahmten
   `StreamUnifiedChatRequestWithTools`-Protobuf: Konversationsnachrichten (`text` + `type`, 1 = human,
   2 = ai), `model_details.model_name`, Request-/Konversations-IDs, `unified_mode = CHAT`.
   Antworten sind Connect-Frames von `StreamUnifiedChatResponseWithTools`; die Brücke liest
   `stream_unified_chat_response.text` (und `thinking.text`) und gibt OpenAI-Chunks plus `[DONE]` aus.
   Die Feldnummern sind nicht geraten: Sie wurden aus dem generierten `aiserver.v1`-Deskriptor
   (`proxy-lab/.cursor-proto-dump.py` im Entwicklungs-Workspace) ausgelesen.
4. **Katalog/Tarif** verwenden dasselbe Connect RPC mit dem JSON-Codec (`content-type: application/json`).

## Proxy (optional)

Setze `CURSOR2API_PROXY` (oder `--proxy`) und jeder Nicht-Loopback-Aufruf — Login, Aktualisierung,
Katalog, Chat — verlässt das System über diesen Proxy:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Unterstützt: `socks5://`, `socks5h://` (DNS am Proxy), `socks4a://`, `http://`, `https://`, mit
optionalem `user:pass@`. Loopback-Ziele umgehen den Proxy, damit der Mock der Testsuite weiterhin
funktioniert. Tunnel sind handgeschrieben auf `node:net`/`node:tls`, und ein Proxy-Fehler ist
fail-closed: Die Anfrage schlägt fehl, statt stillschweigend direkt zu gehen.

## Tests

```bash
node test/smoke.js
```

Führt die gesamte Pipeline gegen ein **Mock-Cursor-Gateway** aus — kein Konto, kein Netzwerk. Es
prüft den `/v1/models`-Fallback, die ausgehenden Client-Header (`x-cursor-client-version`,
Checksummen-Form), das Connect-Framing + den Protobuf-Body, den die Brücke erstellt, die
Streaming-Übersetzung (Deltas, `finish_reason: stop`, `[DONE]`) und die Nicht-Streaming-Form.

## Einschränkungen

- **Tool-Aufrufe werden noch nicht übersetzt.** Cursor streamt `client_side_tool_v2_call`-Frames (Datei
  lesen, Terminal ausführen, …); die Brücke verwirft sie und leitet nur den Assistententext weiter.
  Mehrrunden-Kontext wird vom Aufrufer erneut übergeben, nicht serverseitig von Cursor zwischengespeichert.
- **Vision/Anhänge werden nicht weitergeleitet.** Bilder und Dateianhänge in der Konversation werden
  ignoriert.
- Access-Tokens sind ~1 h gültige JWTs; die Brücke erneuert sie mit dem gespeicherten Refresh-Token und
  fordert ein neues `login` an, wenn die Aktualisierung abgelehnt wird.
- Welche Modelle antworten und wie viel des enthaltenen Kontingents übrig ist, liegt in der eigenen
  Berechtigung des Kontos: `cursor2api status` gibt den Tarif und die Zeitraum-Nutzung aus, sodass ein
  blockiertes Modell sichtbar wird statt still zu bleiben.

## ⚠️ Kontorisiko & wie man es minimiert

Cursor bindet jede Anfrage an eine WorkOS-Identität und eigene Betrugsprüfungen, also betrachte das
Konto — nicht die Brücke — als das, was gesperrt werden kann. Was diese Brücke tut und nicht tut:

- **Ein Konto pro Token-Speicher.** `~/.cursor2api/tokens.json` enthält ein einzelnes Konto; die Brücke
  bündelt niemals mehrere Konten in einem Speicher und verwendet niemals eine Identität über Konten
  hinweg wieder.
- **Stabile, abgeleitete Wire-Identität.** `machineId` / `x-client-key` / `x-cursor-checksum` werden aus
  dem eigenen Token dieses Kontos abgeleitet, sodass zwei Speicher Cursor niemals denselben Fingerabdruck
  präsentieren. Kopiere keinen Speicher zwischen Maschinen und erwarte nicht, dass dieselbe Sitzung
  weiter funktioniert.
- **Keine Traffic-Formung.** Die Brücke rotiert keine IPs, wiederholt nicht in Bursts und verbirgt nicht,
  dass Anfragen von einem lokalen Server kommen. Wenn du sie hinter ein Fan-in stellst (einen Router,
  eine gemeinsam genutzte Agent-Box), das Tausende Anfragen pro Minute an ein Konto feuert, rechne mit
  Ratenlimits und Änderungen der Berechtigungen — das eigene Kontingent des Kontos ist die Obergrenze.
- **Die Registrierung wird hier nicht automatisiert.** `cursor2api login` autorisiert *dein* bestehendes
  Konto; die Brücke erstellt keine Konten, und Cursors eigene Bot-/Dedup-Schutzmaßnahmen bei der
  Registrierung gelten für jeden, der es versucht.
- Verwende die Proxy-Option, wenn der Egress deines Rechners nicht der ist, von dem du dich angemeldet
  hast: `--proxy` hält den Traffic konsistent, statt zwischen Routen zu springen.

Wenn ein Token beginnt, für jedes Modell mit 401/403 zu antworten, ist das normalerweise das Konto, nicht
die Brücke: Führe `cursor2api login` erneut aus, dann `cursor2api status`, um den Tarif und das
verbleibende Kontingent zu sehen.

## Lizenz

MIT — siehe [LICENSE](LICENSE).