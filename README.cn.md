<div align="center">

# cursor2api

非官方桥接工具，将 **Cursor** 账户转换为本地 **OpenAI 兼容 API**。

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

两种凭据路径：

- **浏览器授权**（默认）：PKCE 深度链接 `https://cursor.com/loginDeepControl?challenge=…&uuid=…`，
  在已登录 cursor.com 的浏览器中批准，然后在 `api2.cursor.sh/auth/poll` 轮询，直到
  服务器返回 `{ accessToken, refreshToken }`。
- **Cursor API 密钥**：`cursor2api apikey key_…` 通过
  `POST api2.cursor.sh/auth/exchange_user_api_key` 交换密钥——无需浏览器。

> 非官方，与 Cursor 无关联。请在你拥有的账户上使用，并遵守 Cursor 的条款。
> 此桥接工具与私有端点通信；这些端点可能随时更改。

## 要求

- Node.js **18+**（无依赖）。
- 一个 Cursor 账户（免费的 *Hobby* 计划也算——桥接工具不关心计划等级，
  账户自身的权限决定哪些模型可以响应）。

## 安装

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

或者将文件夹放在任意位置，然后调用 `node /path/to/cursor2api/bin/cursor2api.js …`；没有构建
步骤，也不需要 `npm install`（Node 18+ 自带桥接工具使用的所有内容）。

## 一条命令

将工具指向你的 Cursor API 密钥（`api-keys.txt`，每行一个 `key_…`），它会构建经过验证的
桥接凭据——交换、实时聊天探测、只保留 200 响应：

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

明确的拒绝（401/403、配额耗尽、账户被禁用）会记录为
`key`、原因和 ISO 时间，写入 `keys.txt` 旁边的 `keys-dead.txt`；429/5xx/传输失败会
重试，绝不会标记为失效。`--dry` 会打印计划且不写入任何内容。

> **质量门禁。** 这里的每个凭据在写入 `keys.txt` 之前都通过了实时 `chat-200`
> （失效密钥绝不会被输出）。路由器组合在模型层面遵循同样的规则：一个条目
> **仅当该模型响应 `chat-200` 且能调用工具时**才会被添加——不支持工具的模型、
> 失效密钥或失效提供商会直接被丢弃而不是添加。适用于 **9Router 和 OmniRoute**。

> ⚠️ **条款与账户风险。** cursor2api 是非官方桥接工具：自动化提供商会违反
> 其服务条款，并可能导致账户或 IP 被封禁。你在自己的机器上、对你拥有的账户运行此工具，
> 风险自负。在大规模运行前请阅读提供商的服务条款。

## 快速开始

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## 命令

| 命令 | 作用 |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | PKCE 浏览器授权；令牌保存到 `~/.cursor2api/tokens.json`。 |
| `cursor2api apikey <key_…>` | 用 Cursor API 密钥交换令牌对（无需浏览器）。 |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | 启动本地 API。 |
| `cursor2api status` | 令牌状态 + 计划 + 当前周期用量。 |
| `cursor2api models` | 此账户的模型 ID（回退到静态列表）。 |
| `cursor2api usage` | 原始计划/用量负载。 |
| `cursor2api logout` | 删除已存储的令牌。 |

## 端点

| 路由 | 形态 | 说明 |
| --- | --- | --- |
| `GET /v1/models` | OpenAI 模型列表 | `GetUsableModels` → `AvailableModels` → 静态目录。 |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + SSE 流式传输。 |
| `GET /v1/usage` | Cursor 计划 + 周期用量 | `DashboardService`。 |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | 存活检查。 |

## 🔌 连接到 9Router

[9Router](https://9router.com) 将此桥接工具作为普通的 OpenAI 兼容提供商进行通信：

1. 提供商 → 添加 → **OpenAI Compatible**
2. Base URL：`http://127.0.0.1:8795/v1`
3. API 密钥：任意非空值（或你传给 `--key` 的值）
4. 模型：`GET /v1/models` 中的任意 ID

或者让捆绑的连接器替你完成这四步——它在本地 9Router 上创建提供商节点和连接：

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

默认值：`--prefix cursor2api`、`--name Cursor (bridge)`、`--base-url http://127.0.0.1:8795/v1`。先启动桥接工具（`node bin/cursor2api.js serve`）；然后 9Router 会将模型列为 `cursor2api/<model id>`。此桥接工具是普通的本地 OpenAI 服务器，因此 Cline、Continue、Open WebUI、LiteLLM 或任何 `OPENAI_BASE_URL` 客户端都可以同样使用。

## 🔌 连接到 OmniRoute

[OmniRoute](https://omniroute.online) 将此桥接工具作为普通的 OpenAI 兼容提供商进行通信：

1. 提供商 → 添加 → **OpenAI Compatible**
2. Base URL：`http://127.0.0.1:8795/v1`
3. API 密钥：任意非空值（或你传给 `--key` 的值）
4. 模型：`GET /v1/models` 中的任意 ID

或者让捆绑的连接器替你完成这四步——它在本地 OmniRoute 上创建提供商节点和连接：

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

默认值：`--prefix cursor2api`、`--name Cursor (bridge)`、`--base-url http://127.0.0.1:8795/v1`。先启动桥接工具（`node bin/cursor2api.js serve`）；然后 OmniRoute 会将模型列为 `cursor2api/<model id>`。此桥接工具是普通的本地 OpenAI 服务器，因此 Cline、Continue、Open WebUI、LiteLLM 或任何 `OPENAI_BASE_URL` 客户端都可以同样使用。

## 上游调用如何工作

Cursor 的 API 是 `api2.cursor.sh` 上的 Connect RPC，账户是 WorkOS 身份：

1. **登录** — `cursor.com/api/auth/login` 重定向到 WorkOS AuthKit
   （`client_01GS6W3C96KW4WRS6Z93JCE2RJ`）。桥接工具执行与随附的
   `cursor-agent` CLI 相同的 PKCE 流程：在 `loginDeepControl` 使用 S256 challenge + `uuid`，`GET /auth/poll`
   （404 = 仍在等待）以及通过 `POST /auth/exchange_user_api_key` 刷新。
2. **身份标头** — 每次调用都携带 `authorization: Bearer <accessToken>`、
   `x-cursor-client-version`、`x-cursor-client-type`、`x-cursor-checksum` 和 `x-client-key`。
   校验和将 `floor(Date.now()/1e6)` 通过 6 字节的滚动 XOR/加法密码进行编码，
   进行 base64url 编码并附加一个稳定的 64 位十六进制机器 ID；`x-client-key` 是稳定的
   每次安装的摘要。两者都从令牌确定性地派生（`src/checksum.js`）。
3. **聊天** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools`，使用 Connect 帧格式的
   `StreamUnifiedChatRequestWithTools` protobuf：对话消息（`text` + `type`，1 = 人类，
   2 = AI）、`model_details.model_name`、请求/对话 ID、`unified_mode = CHAT`。
   响应是 `StreamUnifiedChatResponseWithTools` 的 Connect 帧；桥接工具读取
   `stream_unified_chat_response.text`（以及 `thinking.text`）并重新发出 OpenAI 块加上 `[DONE]`。
   字段编号不是猜测的：它们是从生成的 `aiserver.v1` 描述符中读取的
   （开发工作区中的 `proxy-lab/.cursor-proto-dump.py`）。
4. **目录/计划** 使用相同的 Connect RPC 和 JSON 编解码器（`content-type: application/json`）。

## 代理（可选）

设置 `CURSOR2API_PROXY`（或 `--proxy`），所有非环回调用——登录、刷新、目录、聊天——
都通过该代理离开：

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

支持：`socks5://`、`socks5h://`（DNS 在代理端）、`socks4a://`、`http://`、`https://`，可选的
`user:pass@`。环回目标绕过代理，以便测试套件的模拟继续工作。
隧道在 `node:net`/`node:tls` 上手工实现，代理失败是故障关闭的：请求
会报错而不是悄悄直连。

## 测试

```bash
node test/smoke.js
```

针对 **模拟 Cursor 网关**运行整个管道——无需账户，无需网络。它断言
`/v1/models` 回退、传出的客户端标头（`x-cursor-client-version`、校验和形态）、
桥接工具构建的 Connect 帧 + protobuf 主体、流式转换（增量、
`finish_reason: stop`、`[DONE]`）以及非流式形态。

## 限制

- **工具调用尚未翻译。** Cursor 流式传输 `client_side_tool_v2_call` 帧（读取文件、
  运行终端等）；桥接工具丢弃它们，仅转发助手文本。多轮上下文由
  调用方重放，而不是由 Cursor 在服务器端缓存。
- **视觉/附件不会被转发。** 对话中的图像和文件附件会被
  忽略。
- 访问令牌是约 1 小时的 JWT；桥接工具使用存储的刷新令牌刷新它们，并在刷新被拒绝时
  请求新的 `login`。
- 哪些模型可以响应，以及包含的配额还剩多少，是账户自身的权限：
  `cursor2api status` 打印计划和周期用量，因此被阻止的模型是可见的而不是静默的。

## ⚠️ 账户风险及如何最小化

Cursor 将每个请求绑定到 WorkOS 身份及其自己的欺诈检查，因此请将账户——而不是
桥接工具——视为可能被封禁的对象。此桥接工具做和不做的事情：

- **每个令牌存储一个账户。** `~/.cursor2api/tokens.json` 保存单个账户；桥接工具从不
  将多个账户多路复用到一个存储中，也从不跨账户重用身份。
- **稳定、派生的线路身份。** `machineId` / `x-client-key` / `x-cursor-checksum` 从
  该账户自己的令牌派生，因此两个存储永远不会向 Cursor 呈现相同的指纹。不要将
  存储复制到机器之间并期望同一会话继续工作。
- **无流量整形。** 桥接工具不轮换 IP、不突发重试，也不隐藏请求来自
  本地服务器。如果你将它放在扇入（路由器、共享代理机器）后面，向一个账户每分钟
  发送数千个请求，预期会遇到速率限制和权限变更——账户自身的
  配额就是上限。
- **此处不自动化注册。** `cursor2api login` 授权*你*现有的账户；桥接工具
  不创建账户，Cursor 自己的注册机器人/去重保护适用于任何尝试的人。
- 如果你机器的出口 IP 不是你注册时使用的那个，请使用代理选项：`--proxy` 保持
  流量一致，而不是在路由之间跳跃。

如果令牌开始对每个模型都返回 401/403，那通常是账户问题，而不是桥接工具：再次运行
`cursor2api login`，然后运行 `cursor2api status` 查看计划和剩余配额。

## 许可证

MIT — 参见 [LICENSE](LICENSE)。