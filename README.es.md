<div align="center">

# cursor2api

Puente no oficial que convierte una cuenta de **Cursor** en una **API local compatible con OpenAI**.

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

Dos rutas de credenciales:

- **Aprobación en el navegador** (predeterminada): enlace profundo PKCE `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  aprobado en un navegador con sesión iniciada en cursor.com, luego sondeado en `api2.cursor.sh/auth/poll` hasta que el
  servidor devuelve `{ accessToken, refreshToken }`.
- **Clave de API de Cursor**: `cursor2api apikey key_…` intercambia la clave mediante
  `POST api2.cursor.sh/auth/exchange_user_api_key` — sin navegador.

> No oficial y sin afiliación con Cursor. Úsalo con una cuenta que te pertenezca y respeta los términos de Cursor.
> Este puente se comunica con endpoints privados; pueden cambiar sin previo aviso.

## Requisitos

- Node.js **18+** (sin dependencias).
- Una cuenta de Cursor (el plan gratuito *Hobby* cuenta — al puente no le importa el nivel del plan, los
  propios derechos de la cuenta deciden qué modelos responden).

## Instalación

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

O coloca la carpeta en cualquier lugar y llama a `node /path/to/cursor2api/bin/cursor2api.js …`; no hay paso
de compilación ni `npm install` (Node 18+ incluye todo lo que usa el puente).

## Un solo comando

Apunta la herramienta a tus claves de API de Cursor (`api-keys.txt`, una `key_…` por línea) y construye credenciales
de puente verificadas — intercambio, prueba de chat en vivo, conserva solo los 200:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

Un rechazo definitivo (401/403, una cuota agotada, una cuenta deshabilitada) se registra como
`key`, motivo y hora ISO en `keys-dead.txt` junto a `keys.txt`; un 429/5xx/fallo de transporte se
reintenta y nunca se marca como muerto. `--dry` imprime el plan y no escribe nada.

> **Controles de calidad.** Cada credencial aquí pasó un `chat-200` en vivo antes de escribirse en `keys.txt`
> (las claves muertas nunca se incluyen). Las combinaciones del router siguen la misma regla a nivel de modelo: una entrada se
> añade **solo si el modelo responde `chat-200` y puede llamar a herramientas** — un modelo sin soporte de herramientas,
> una clave muerta o un proveedor muerto se descarta en lugar de añadirse. Funciona con **9Router y OmniRoute**.

> ⚠️ **Términos y riesgo de cuenta.** cursor2api es un puente no oficial: automatizar un proveedor puede violar
> sus Términos de Servicio y provocar el baneo de cuentas o IPs. Ejecutas esto en cuentas que te pertenecen, desde tu propia
> máquina, bajo tu propio riesgo. Lee los ToS del proveedor antes de una ejecución a gran escala.

## Inicio rápido

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | Aprobación PKCE en el navegador; los tokens se guardan en `~/.cursor2api/tokens.json`. |
| `cursor2api apikey <key_…>` | Intercambia una clave de API de Cursor por el par de tokens (sin navegador). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Inicia la API local. |
| `cursor2api status` | Estado del token + plan + uso del período actual. |
| `cursor2api models` | Ids de modelos para esta cuenta (recurre a la lista estática). |
| `cursor2api usage` | Carga útil sin procesar de plan/uso. |
| `cursor2api logout` | Elimina los tokens almacenados. |

## Endpoints

| Ruta | Forma | Notas |
| --- | --- | --- |
| `GET /v1/models` | Lista de modelos de OpenAI | `GetUsableModels` → `AvailableModels` → catálogo estático. |
| `POST /v1/chat/completions` | Chat Completions de OpenAI | JSON + streaming SSE. |
| `GET /v1/usage` | Plan de Cursor + uso del período | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Estado de actividad. |

## 🔌 Conectar con 9Router

[9Router](https://9router.com) se comunica con este puente como un proveedor simple compatible con OpenAI:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: cualquier valor no vacío (o el valor que pasaste a `--key`)
4. Model: cualquier id de `GET /v1/models`

O deja que el conector incluido haga esos cuatro pasos por ti — crea el nodo del proveedor y la conexión en un 9Router local:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Valores predeterminados: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Inicia primero el puente (`node bin/cursor2api.js serve`); 9Router entonces lista los modelos como `cursor2api/<model id>`. El puente es un servidor OpenAI local normal, así que Cline, Continue, Open WebUI, LiteLLM o cualquier cliente `OPENAI_BASE_URL` funcionan de la misma manera.

## 🔌 Conectar con OmniRoute

[OmniRoute](https://omniroute.online) se comunica con este puente como un proveedor simple compatible con OpenAI:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: cualquier valor no vacío (o el valor que pasaste a `--key`)
4. Model: cualquier id de `GET /v1/models`

O deja que el conector incluido haga esos cuatro pasos por ti — crea el nodo del proveedor y la conexión en un OmniRoute local:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Valores predeterminados: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Inicia primero el puente (`node bin/cursor2api.js serve`); OmniRoute entonces lista los modelos como `cursor2api/<model id>`. El puente es un servidor OpenAI local normal, así que Cline, Continue, Open WebUI, LiteLLM o cualquier cliente `OPENAI_BASE_URL` funcionan de la misma manera.

## Cómo funciona la llamada ascendente

La API de Cursor es Connect RPC en `api2.cursor.sh`, y la cuenta es una identidad de WorkOS:

1. **Inicio de sesión** — `cursor.com/api/auth/login` redirige a WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). El puente hace la misma danza PKCE que el
   CLI `cursor-agent` distribuido: desafío S256 + `uuid` en `loginDeepControl`, `GET /auth/poll`
   (404 = aún pendiente) y una renovación mediante `POST /auth/exchange_user_api_key`.
2. **Cabeceras de identidad** — cada llamada lleva `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` y `x-client-key`.
   El checksum codifica `floor(Date.now()/1e6)` con un cifrado XOR/add rotativo sobre 6 bytes,
   lo codifica en base64url y añade un id de máquina estable de 64 hex; `x-client-key` es un digest
   estable por instalación. Ambos se derivan de forma determinista del token (`src/checksum.js`).
3. **Chat** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools` con un protobuf
   `StreamUnifiedChatRequestWithTools` enmarcado en Connect: mensajes de la conversación (`text` + `type`, 1 = humano,
   2 = ai), `model_details.model_name`, ids de solicitud/conversación, `unified_mode = CHAT`.
   Las respuestas son tramas Connect de `StreamUnifiedChatResponseWithTools`; el puente lee
   `stream_unified_chat_response.text` (y `thinking.text`) y reemite chunks de OpenAI más `[DONE]`.
   Los números de campo no se adivinan: se leyeron del descriptor generado `aiserver.v1`
   (`proxy-lab/.cursor-proto-dump.py` en el espacio de trabajo de desarrollo).
4. **Catálogo/plan** usan el mismo Connect RPC con el códec JSON (`content-type: application/json`).

## Proxy (opcional)

Establece `CURSOR2API_PROXY` (o `--proxy`) y cada llamada que no sea loopback — inicio de sesión, renovación, catálogo, chat —
sale a través de ese proxy:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Compatible con: `socks5://`, `socks5h://` (DNS en el proxy), `socks4a://`, `http://`, `https://`, con
`user:pass@` opcional. Los destinos loopback omiten el proxy para que el mock de la suite de pruebas siga funcionando.
Los túneles están hechos a mano sobre `node:net`/`node:tls`, y un fallo del proxy es de cierre seguro: la solicitud
da error en lugar de ir directamente en silencio.

## Pruebas

```bash
node test/smoke.js
```

Ejecuta todo el pipeline contra una **puerta de enlace Cursor simulada** — sin cuenta, sin red. Verifica el
fallback de `/v1/models`, las cabeceras de cliente salientes (`x-cursor-client-version`, forma del checksum), el
enmarcado Connect + cuerpo protobuf que construye el puente, la traducción de streaming (deltas,
`finish_reason: stop`, `[DONE]`) y la forma sin streaming.

## Limitaciones

- **Las llamadas a herramientas aún no se traducen.** Cursor emite tramas `client_side_tool_v2_call` (leer archivo,
  ejecutar terminal, …); el puente las descarta y reenvía solo el texto del asistente. El contexto multiturno es
  reproducido por el llamador, no almacenado en caché del lado del servidor por Cursor.
- **La visión/adjuntos no se reenvían.** Las imágenes y los archivos adjuntos en la conversación se
  ignoran.
- Los tokens de acceso son JWT de ~1 h; el puente los renueva con el token de refresco almacenado, y solicita un
  nuevo `login` cuando se rechaza la renovación.
- Qué modelos responden, y cuánto queda de la asignación incluida, es derecho propio de la cuenta:
  `cursor2api status` imprime el plan y el uso del período para que un modelo bloqueado sea visible en lugar de silencioso.

## ⚠️ Riesgo de cuenta y cómo minimizarlo

Cursor vincula cada solicitud a una identidad de WorkOS y a sus propias comprobaciones antifraude, así que trata la cuenta — no el
puente — como lo que puede ser baneado. Lo que este puente hace y no hace:

- **Una cuenta por almacén de tokens.** `~/.cursor2api/tokens.json` contiene una sola cuenta; el puente nunca
  multiplexa varias cuentas en un almacén ni reutiliza una identidad entre cuentas.
- **Identidad de red estable y derivada.** `machineId` / `x-client-key` / `x-cursor-checksum` se derivan del
  token propio de esa cuenta, así que dos almacenes nunca presentan la misma huella a Cursor. No copies un
  almacén entre máquinas y esperes que la misma sesión siga funcionando.
- **Sin modelado de tráfico.** El puente no rota IPs, no reintenta en ráfagas ni oculta que las solicitudes provienen de
  un servidor local. Si lo pones detrás de un fan-in (un router, una caja de agente compartida) que dispara miles de
  solicitudes por minuto a una cuenta, espera límites de velocidad y cambios de derechos — la asignación propia de la
  cuenta es el techo.
- **El registro no se automatiza aquí.** `cursor2api login` autoriza *tu* cuenta existente; el puente no
  crea cuentas, y las propias protecciones antibot/deduplicación de registro de Cursor se aplican a cualquiera que lo intente.
- Usa la opción de proxy si la salida de tu máquina no es la misma desde la que te registraste: `--proxy` mantiene el
  tráfico consistente en lugar de saltar entre rutas.

Si un token empieza a responder 401/403 para todos los modelos, normalmente es la cuenta, no el puente: ejecuta
`cursor2api login` de nuevo, luego `cursor2api status` para ver el plan y la asignación restante.

## Licencia

MIT — consulta [LICENSE](LICENSE).