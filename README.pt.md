<div align="center">

# cursor2api

Ponte não oficial que transforma uma conta **Cursor** em uma **API local compatível com OpenAI**.

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

Dois caminhos de credenciais:

- **Aprovação pelo navegador** (padrão): deep link PKCE `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  aprovado em um navegador conectado a cursor.com, depois consultado em `api2.cursor.sh/auth/poll` até que o
  servidor devolva `{ accessToken, refreshToken }`.
- **Chave de API do Cursor**: `cursor2api apikey key_…` troca a chave por meio de
  `POST api2.cursor.sh/auth/exchange_user_api_key` — sem navegador.

> Não oficial e sem afiliação com a Cursor. Use com uma conta que você possui e respeite os termos da Cursor.
> Esta ponte conversa com endpoints privados; eles podem mudar sem aviso.

## Requisitos

- Node.js **18+** (sem dependências).
- Uma conta Cursor (o plano gratuito *Hobby* conta — a ponte não se importa com o nível do plano, as
  próprias permissões da conta decidem quais modelos respondem).

## Instalação

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

Ou coloque a pasta em qualquer lugar e chame `node /path/to/cursor2api/bin/cursor2api.js …`; não há etapa
de build nem `npm install` (o Node 18+ já traz tudo o que a ponte usa).

## Um comando

Aponte a ferramenta para suas chaves de API do Cursor (`api-keys.txt`, uma `key_…` por linha) e ela constrói
credenciais de ponte verificadas — troca, teste de chat ao vivo, mantém apenas os 200:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

Uma rejeição definitiva (401/403, cota esgotada, conta desativada) é registrada como
`key`, motivo e horário ISO em `keys-dead.txt` ao lado de `keys.txt`; um 429/5xx/falha de transporte é
repetido e nunca marcado como morto. `--dry` imprime o plano e não grava nada.

> **Portões de qualidade.** Cada credencial aqui passou por um `chat-200` ao vivo antes de ser gravada em `keys.txt`
> (chaves mortas nunca são entregues). As combinações de roteadores seguem a mesma regra no nível do modelo: uma entrada é
> adicionada **somente se o modelo responder `chat-200` e puder chamar ferramentas** — um modelo sem suporte a ferramentas,
> uma chave morta ou um provedor morto é descartado em vez de adicionado. Funciona com **9Router e OmniRoute**.

> ⚠️ **Termos e risco para a conta.** cursor2api é uma ponte não oficial: automatizar um provedor pode violar
> seus Termos de Serviço e fazer com que contas ou IPs sejam banidos. Você executa isto em contas que possui, da sua própria
> máquina, por sua conta e risco. Leia os ToS do provedor antes de uma execução em larga escala.

## Início rápido

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | Aprovação PKCE pelo navegador; os tokens ficam em `~/.cursor2api/tokens.json`. |
| `cursor2api apikey <key_…>` | Troca uma chave de API do Cursor pelo par de tokens (sem navegador). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Inicia a API local. |
| `cursor2api status` | Estado do token + plano + uso do período atual. |
| `cursor2api models` | Ids de modelos para esta conta (recorre à lista estática). |
| `cursor2api usage` | Payload bruto de plano/uso. |
| `cursor2api logout` | Exclui os tokens armazenados. |

## Endpoints

| Rota | Formato | Observações |
| --- | --- | --- |
| `GET /v1/models` | Lista de modelos OpenAI | `GetUsableModels` → `AvailableModels` → catálogo estático. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + streaming SSE. |
| `GET /v1/usage` | Plano Cursor + uso do período | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Verificação de atividade. |

## 🔌 Conectar ao 9Router

O [9Router](https://9router.com) conversa com esta ponte como um provedor comum compatível com OpenAI:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: qualquer valor não vazio (ou o valor que você passou para `--key`)
4. Model: qualquer id de `GET /v1/models`

Ou deixe o conector incluído fazer esses quatro passos para você — ele cria o nó do provedor e a conexão em um 9Router local:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Padrões: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Inicie a ponte primeiro (`node bin/cursor2api.js serve`); o 9Router então lista os modelos como `cursor2api/<model id>`. A ponte é um servidor OpenAI local normal, então Cline, Continue, Open WebUI, LiteLLM ou qualquer cliente `OPENAI_BASE_URL` funcionam da mesma forma.

## 🔌 Conectar ao OmniRoute

O [OmniRoute](https://omniroute.online) conversa com esta ponte como um provedor comum compatível com OpenAI:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: qualquer valor não vazio (ou o valor que você passou para `--key`)
4. Model: qualquer id de `GET /v1/models`

Ou deixe o conector incluído fazer esses quatro passos para você — ele cria o nó do provedor e a conexão em um OmniRoute local:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Padrões: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Inicie a ponte primeiro (`node bin/cursor2api.js serve`); o OmniRoute então lista os modelos como `cursor2api/<model id>`. A ponte é um servidor OpenAI local normal, então Cline, Continue, Open WebUI, LiteLLM ou qualquer cliente `OPENAI_BASE_URL` funcionam da mesma forma.

## Como a chamada upstream funciona

A API do Cursor é Connect RPC em `api2.cursor.sh`, e a conta é uma identidade WorkOS:

1. **Login** — `cursor.com/api/auth/login` redireciona para o WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). A ponte faz a mesma dança PKCE que o CLI `cursor-agent`
   distribuído faz: desafio S256 + `uuid` em `loginDeepControl`, `GET /auth/poll`
   (404 = ainda pendente) e uma renovação por meio de `POST /auth/exchange_user_api_key`.
2. **Cabeçalhos de identidade** — toda chamada carrega `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` e `x-client-key`.
   O checksum codifica `floor(Date.now()/1e6)` com uma cifra XOR/add rotativa sobre 6 bytes,
   codifica em base64url e acrescenta um id de máquina estável de 64 hex; `x-client-key` é um digest
   estável por instalação. Ambos são derivados deterministicamente do token (`src/checksum.js`).
3. **Chat** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools` com um protobuf
   `StreamUnifiedChatRequestWithTools` em enquadramento Connect: mensagens da conversa (`text` + `type`, 1 = humano,
   2 = ia), `model_details.model_name`, ids de requisição/conversa, `unified_mode = CHAT`.
   As respostas são quadros Connect de `StreamUnifiedChatResponseWithTools`; a ponte lê
   `stream_unified_chat_response.text` (e `thinking.text`) e reemite chunks OpenAI mais `[DONE]`.
   Os números dos campos não são adivinhados: foram lidos do descritor `aiserver.v1` gerado
   (`proxy-lab/.cursor-proto-dump.py` no workspace de desenvolvimento).
4. **Catálogo/plano** usam o mesmo Connect RPC com o codec JSON (`content-type: application/json`).

## Proxy (opcional)

Defina `CURSOR2API_PROXY` (ou `--proxy`) e toda chamada não-loopback — login, renovação, catálogo, chat —
sai por esse proxy:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Suportados: `socks5://`, `socks5h://` (DNS no proxy), `socks4a://`, `http://`, `https://`, com
`user:pass@` opcional. Alvos de loopback ignoram o proxy para que o mock da suíte de testes continue funcionando.
Os túneis são feitos à mão sobre `node:net`/`node:tls`, e uma falha de proxy é fail-closed: a requisição
dá erro em vez de seguir diretamente em silêncio.

## Testes

```bash
node test/smoke.js
```

Executa todo o pipeline contra um **gateway Cursor simulado** — sem conta, sem rede. Ele verifica o
fallback de `/v1/models`, os cabeçalhos de cliente de saída (`x-cursor-client-version`, formato do checksum), o
enquadramento Connect + corpo protobuf que a ponte constrói, a tradução de streaming (deltas,
`finish_reason: stop`, `[DONE]`) e o formato não-streaming.

## Limites

- **Chamadas de ferramentas ainda não são traduzidas.** O Cursor transmite quadros `client_side_tool_v2_call` (ler arquivo,
  executar terminal, …); a ponte os descarta e encaminha apenas o texto do assistente. O contexto multiturno é
  reproduzido pelo chamador, não armazenado em cache no lado do servidor pelo Cursor.
- **Visão/anexos não são encaminhados.** Imagens e anexos de arquivos na conversa são
  ignorados.
- Os tokens de acesso são JWTs de ~1 h; a ponte os renova com o refresh token armazenado e pede um
  novo `login` quando a renovação é rejeitada.
- Quais modelos respondem, e quanto da cota incluída resta, é a própria permissão da conta:
  `cursor2api status` imprime o plano e o uso do período para que um modelo bloqueado fique visível em vez de silencioso.

## ⚠️ Risco para a conta e como minimizá-lo

O Cursor vincula cada requisição a uma identidade WorkOS e às suas próprias verificações antifraude, então trate a conta — não a
ponte — como a coisa que pode ser banida. O que esta ponte faz e não faz:

- **Uma conta por armazenamento de tokens.** `~/.cursor2api/tokens.json` contém uma única conta; a ponte nunca
  multiplexa várias contas em um único armazenamento e nunca reutiliza uma identidade entre contas.
- **Identidade de rede estável e derivada.** `machineId` / `x-client-key` / `x-cursor-checksum` são derivados do
  próprio token dessa conta, então dois armazenamentos nunca apresentam a mesma impressão digital ao Cursor. Não copie um
  armazenamento entre máquinas esperando que a mesma sessão continue funcionando.
- **Sem modelagem de tráfego.** A ponte não rotaciona IPs, não repete em rajadas nem esconde que as requisições vêm de
  um servidor local. Se você a colocar atrás de um fan-in (um roteador, uma máquina de agente compartilhada) que dispara milhares de
  requisições por minuto em uma conta, espere limites de taxa e mudanças de permissão — a própria
  cota da conta é o teto.
- **O cadastro não é automatizado aqui.** `cursor2api login` autoriza *sua* conta existente; a ponte não
  cria contas, e as próprias proteções de bot/deduplicação de cadastro do Cursor se aplicam a quem tentar.
- Use a opção de proxy se a saída da sua máquina não for a mesma de onde você se cadastrou: `--proxy` mantém o
  tráfego consistente em vez de saltar entre rotas.

Se um token começar a responder 401/403 para todos os modelos, isso geralmente é a conta, não a ponte: execute
`cursor2api login` novamente, depois `cursor2api status` para ver o plano e a cota restante.

## Licença

MIT — consulte [LICENSE](LICENSE).