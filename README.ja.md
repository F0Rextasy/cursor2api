<div align="center">

# cursor2api

**Cursor** アカウントをローカルの **OpenAI 互換 API** に変える非公式ブリッジ。

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

認証情報の取得方法は 2 通り:

- **ブラウザ承認** (デフォルト): PKCE ディープリンク `https://cursor.com/loginDeepControl?challenge=…&uuid=…` を
  cursor.com にサインイン済みのブラウザで承認し、サーバーが `{ accessToken, refreshToken }` を返すまで
  `api2.cursor.sh/auth/poll` をポーリングします。
- **Cursor API キー**: `cursor2api apikey key_…` が
  `POST api2.cursor.sh/auth/exchange_user_api_key` 経由でキーを交換します — ブラウザ不要。

> 非公式であり、Cursor とは提携していません。所有しているアカウントで使用し、Cursor の利用規約を守ってください。
> このブリッジは非公開エンドポイントと通信するため、予告なく変更される可能性があります。

## 要件

- Node.js **18+** (依存関係なし)。
- Cursor アカウント (無料の *Hobby* プランでも可 — ブリッジはプラン階層を気にせず、
  アカウント自身の権利がどのモデルが応答するかを決定します)。

## インストール

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

またはフォルダを任意の場所に置き、`node /path/to/cursor2api/bin/cursor2api.js …` を呼び出します。ビルド
ステップも `npm install` もありません (Node 18+ にはブリッジが使用するすべてが同梱されています)。

## コマンド 1 つで

ツールに Cursor API キー (`api-keys.txt`、1 行に 1 つの `key_…`) を指定すると、検証済みの
ブリッジ認証情報を構築します — 交換、ライブチャットプローブ、200 のみを保持:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

明確な拒否 (401/403、クォータ枯渇、アカウント無効) は
`keys.txt` の隣の `keys-dead.txt` に `key`、理由、ISO 時刻として記録されます。429/5xx/トランスポート障害は
再試行され、dead としてマークされることはありません。`--dry` はプランを表示し、何も書き込みません。

> **品質ゲート。** ここにあるすべての認証情報は、`keys.txt` に書き込まれる前にライブの `chat-200` を通過しています
> (dead キーは決して出荷されません)。ルーターのコンボもモデルレベルで同じルールに従います: エントリは
> **モデルが `chat-200` に応答し、ツールを呼び出せる場合にのみ**追加されます — ツールサポートのないモデル、
> dead キー、dead プロバイダーは追加されずに破棄されます。**9Router と OmniRoute** で動作します。

> ⚠️ **規約とアカウントのリスク。** cursor2api は非公式ブリッジです: プロバイダーを自動化すると
> 利用規約に違反し、アカウントや IP が BAN される可能性があります。所有しているアカウントで、自分の
> マシンから、自己責任で実行してください。大規模な実行の前にプロバイダーの利用規約をお読みください。

## クイックスタート

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | PKCE ブラウザ承認。トークンは `~/.cursor2api/tokens.json` に保存されます。 |
| `cursor2api apikey <key_…>` | Cursor API キーをトークンペアと交換します (ブラウザ不要)。 |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | ローカル API を起動します。 |
| `cursor2api status` | トークンの状態 + プラン + 現在の期間の使用量。 |
| `cursor2api models` | このアカウントのモデル ID (静的リストにフォールバック)。 |
| `cursor2api usage` | 生のプラン/使用量ペイロード。 |
| `cursor2api logout` | 保存されたトークンを削除します。 |

## エンドポイント

| ルート | 形式 | 備考 |
| --- | --- | --- |
| `GET /v1/models` | OpenAI モデルリスト | `GetUsableModels` → `AvailableModels` → 静的カタログ。 |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + SSE ストリーミング。 |
| `GET /v1/usage` | Cursor プラン + 期間使用量 | `DashboardService`。 |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | 稼働確認。 |

## 🔌 9Router に接続

[9Router](https://9router.com) はこのブリッジを通常の OpenAI 互換プロバイダーとして扱います:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: 空でない任意の値 (または `--key` に渡した値)
4. Model: `GET /v1/models` の任意の ID

または、同梱のコネクターにこれら 4 ステップを実行させることもできます — ローカルの 9Router 上にプロバイダーノードと接続を作成します:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

デフォルト: `--prefix cursor2api`、`--name Cursor (bridge)`、`--base-url http://127.0.0.1:8795/v1`。先にブリッジを起動してください (`node bin/cursor2api.js serve`)。その後 9Router はモデルを `cursor2api/<model id>` として一覧表示します。ブリッジは通常のローカル OpenAI サーバーなので、Cline、Continue、Open WebUI、LiteLLM、その他 `OPENAI_BASE_URL` クライアントも同様に動作します。

## 🔌 OmniRoute に接続

[OmniRoute](https://omniroute.online) はこのブリッジを通常の OpenAI 互換プロバイダーとして扱います:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: 空でない任意の値 (または `--key` に渡した値)
4. Model: `GET /v1/models` の任意の ID

または、同梱のコネクターにこれら 4 ステップを実行させることもできます — ローカルの OmniRoute 上にプロバイダーノードと接続を作成します:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

デフォルト: `--prefix cursor2api`、`--name Cursor (bridge)`、`--base-url http://127.0.0.1:8795/v1`。先にブリッジを起動してください (`node bin/cursor2api.js serve`)。その後 OmniRoute はモデルを `cursor2api/<model id>` として一覧表示します。ブリッジは通常のローカル OpenAI サーバーなので、Cline、Continue、Open WebUI、LiteLLM、その他 `OPENAI_BASE_URL` クライアントも同様に動作します。

## アップストリーム呼び出しの仕組み

Cursor の API は `api2.cursor.sh` 上の Connect RPC で、アカウントは WorkOS アイデンティティです:

1. **ログイン** — `cursor.com/api/auth/login` は WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`) にリダイレクトします。ブリッジは同梱の
   `cursor-agent` CLI と同じ PKCE ダンスを行います: `loginDeepControl` での S256 チャレンジ + `uuid`、`GET /auth/poll`
   (404 = まだ保留中)、そして `POST /auth/exchange_user_api_key` によるリフレッシュ。
2. **アイデンティティヘッダー** — すべての呼び出しは `authorization: Bearer <accessToken>`、
   `x-cursor-client-version`、`x-cursor-client-type`、`x-cursor-checksum`、`x-client-key` を伴います。
   チェックサムは `floor(Date.now()/1e6)` を 6 バイトのローリング XOR/add 暗号でエンコードし、
   base64url エンコードして、安定した 64 桁の 16 進数マシン ID を付加します。`x-client-key` は安定した
   インストールごとのダイジェストです。どちらもトークンから決定論的に導出されます (`src/checksum.js`)。
3. **チャット** — Connect フレーム化された
   `StreamUnifiedChatRequestWithTools` protobuf を伴う `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools`: 会話メッセージ (`text` + `type`、1 = human、
   2 = ai)、`model_details.model_name`、リクエスト/会話 ID、`unified_mode = CHAT`。
   レスポンスは `StreamUnifiedChatResponseWithTools` の Connect フレームです。ブリッジは
   `stream_unified_chat_response.text` (および `thinking.text`) を読み取り、OpenAI チャンクと `[DONE]` を再出力します。
   フィールド番号は推測ではありません: 生成された `aiserver.v1` 記述子
   (開発ワークスペースの `proxy-lab/.cursor-proto-dump.py`) から読み取られました。
4. **カタログ/プラン** は JSON コーデック (`content-type: application/json`) で同じ Connect RPC を使用します。

## プロキシ (オプション)

`CURSOR2API_PROXY` (または `--proxy`) を設定すると、すべての非ループバック呼び出し — ログイン、リフレッシュ、カタログ、チャット —
がそのプロキシを経由します:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

対応: `socks5://`、`socks5h://` (プロキシ側で DNS)、`socks4a://`、`http://`、`https://`、
オプションの `user:pass@`。ループバックターゲットはプロキシをバイパスするため、テストスイートのモックが動作し続けます。
トンネルは `node:net`/`node:tls` 上に手作りされており、プロキシ障害はフェイルクローズです: リクエストは
静かに直接接続するのではなくエラーになります。

## テスト

```bash
node test/smoke.js
```

**モック Cursor ゲートウェイ**に対してパイプライン全体を実行します — アカウント不要、ネットワーク不要。これは
`/v1/models` フォールバック、送信クライアントヘッダー (`x-cursor-client-version`、チェックサム形状)、
ブリッジが構築する Connect フレーミング + protobuf ボディ、ストリーミング変換 (デルタ、
`finish_reason: stop`、`[DONE]`)、非ストリーミング形状を検証します。

## 制限

- **ツール呼び出しはまだ変換されません。** Cursor は `client_side_tool_v2_call` フレーム (ファイル読み取り、
  ターミナル実行、…) をストリームしますが、ブリッジはそれらを破棄し、アシスタントのテキストのみを転送します。マルチターンのコンテキストは
  呼び出し元によって再生され、Cursor 側でサーバーキャッシュされることはありません。
- **ビジョン/添付ファイルは転送されません。** 会話内の画像やファイル添付は
  無視されます。
- アクセストークンは約 1 時間の JWT です。ブリッジは保存されたリフレッシュトークンでそれらをリフレッシュし、リフレッシュが拒否された場合は
  新しい `login` を要求します。
- どのモデルが応答するか、含まれる許容量がどれだけ残っているかは、アカウント自身の権利です:
  `cursor2api status` はプランと期間使用量を表示するため、ブロックされたモデルが黙ってではなく可視化されます。

## ⚠️ アカウントのリスクと最小化する方法

Cursor はすべてのリクエストを WorkOS アイデンティティと独自の不正チェックに結び付けるため、BAN される可能性があるのは
ブリッジではなくアカウントだと考えてください。このブリッジが行うことと行わないこと:

- **トークンストアごとに 1 アカウント。** `~/.cursor2api/tokens.json` は単一のアカウントを保持します。ブリッジは
  複数のアカウントを 1 つのストアに多重化することはなく、アカウント間でアイデンティティを再利用することもありません。
- **安定した、導出されたワイヤアイデンティティ。** `machineId` / `x-client-key` / `x-cursor-checksum` は
  そのアカウント自身のトークンから導出されるため、2 つのストアが同じフィンガープリントを Cursor に提示することはありません。ストアを
  マシン間でコピーして同じセッションが動き続けることを期待しないでください。
- **トラフィックシェーピングなし。** ブリッジは IP をローテートしたり、バーストで再試行したり、リクエストが
  ローカルサーバーから来ていることを隠したりしません。ファンイン (ルーター、共有エージェントボックス) の背後に置いて 1 つのアカウントに
  毎分数千のリクエストを送ると、レート制限と権利の変更が予想されます — アカウント自身の許容量が上限です。
- **サインアップはここでは自動化されません。** `cursor2api login` は*あなたの*既存のアカウントを認可します。ブリッジは
  アカウントを作成せず、Cursor 自身のサインアップボット/重複排除保護が試みるすべての人に適用されます。
- マシンの egress がサインアップ元と異なる場合はプロキシオプションを使用してください: `--proxy` は
  ルート間をホッピングする代わりにトラフィックを一貫させます。

トークンがすべてのモデルに対して 401/403 を返し始めた場合、それは通常ブリッジではなくアカウントです:
`cursor2api login` を再度実行し、次に `cursor2api status` でプランと残りの許容量を確認してください。

## ライセンス

MIT — [LICENSE](LICENSE) を参照。