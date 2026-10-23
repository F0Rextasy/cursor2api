<div align="center">

# cursor2api

Неофициальный мост, превращающий аккаунт **Cursor** в локальный **API, совместимый с OpenAI**.

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

Два пути получения учётных данных:

- **Подтверждение через браузер** (по умолчанию): deep link PKCE `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  подтверждается в браузере, где выполнен вход в cursor.com, затем опрашивается `api2.cursor.sh/auth/poll`, пока
  сервер не вернёт `{ accessToken, refreshToken }`.
- **API-ключ Cursor**: `cursor2api apikey key_…` обменивает ключ через
  `POST api2.cursor.sh/auth/exchange_user_api_key` — без браузера.

> Неофициально и не связано с Cursor. Используйте с аккаунтом, которым владеете, и соблюдайте условия Cursor.
> Этот мост обращается к приватным эндпоинтам; они могут измениться без предупреждения.

## Требования

- Node.js **18+** (без зависимостей).
- Аккаунт Cursor (бесплатный план *Hobby* подойдёт — мосту безразличен уровень плана,
  собственные права аккаунта определяют, какие модели отвечают).

## Установка

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

Или поместите папку куда угодно и вызывайте `node /path/to/cursor2api/bin/cursor2api.js …`; здесь нет шага
сборки и нет `npm install` (Node 18+ включает всё, что использует мост).

## Одна команда

Укажите инструменту ваши API-ключи Cursor (`api-keys.txt`, по одному `key_…` в строке), и он создаст проверенные
учётные данные моста — обмен, живая проверка чата, оставить только 200-е:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

Однозначный отказ (401/403, исчерпанная квота, отключённый аккаунт) записывается как
`key`, причина и время в формате ISO в `keys-dead.txt` рядом с `keys.txt`; 429/5xx/сбой транспорта
повторяется и никогда не помечается как мёртвый. `--dry` выводит план и ничего не записывает.

> **Проверки качества.** Каждые учётные данные здесь прошли живой `chat-200` до того, как были записаны в `keys.txt`
> (мёртвые ключи никогда не поставляются). Комбинации роутера следуют тому же правилу на уровне модели: запись
> добавляется **только если модель отвечает `chat-200` и умеет вызывать инструменты** — модель без поддержки инструментов,
> мёртвый ключ или мёртвый провайдер отбрасывается, а не добавляется. Работает с **9Router и OmniRoute**.

> ⚠️ **Условия и риск для аккаунта.** cursor2api — неофициальный мост: автоматизация провайдера может нарушать
> его Условия обслуживания и привести к блокировке аккаунтов или IP. Вы запускаете это на своих аккаунтах, со своей
> машины, на свой риск. Прочитайте ToS провайдера перед крупным запуском.

## Быстрый старт

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Команды

| Команда | Что делает |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | Подтверждение через браузер с PKCE; токены попадают в `~/.cursor2api/tokens.json`. |
| `cursor2api apikey <key_…>` | Обмен API-ключа Cursor на пару токенов (без браузера). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Запустить локальный API. |
| `cursor2api status` | Состояние токена + план + использование за текущий период. |
| `cursor2api models` | Идентификаторы моделей для этого аккаунта (с откатом к статическому списку). |
| `cursor2api usage` | Необработанные данные плана/использования. |
| `cursor2api logout` | Удалить сохранённые токены. |

## Эндпоинты

| Маршрут | Формат | Примечания |
| --- | --- | --- |
| `GET /v1/models` | Список моделей OpenAI | `GetUsableModels` → `AvailableModels` → статический каталог. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + потоковая передача SSE. |
| `GET /v1/usage` | План Cursor + использование за период | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Проверка работоспособности. |

## 🔌 Подключение к 9Router

[9Router](https://9router.com) обращается к этому мосту как к обычному провайдеру, совместимому с OpenAI:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: любое непустое значение (или значение, переданное в `--key`)
4. Model: любой id из `GET /v1/models`

Или позвольте встроенному коннектору выполнить эти четыре шага за вас — он создаёт узел провайдера и подключение на локальном 9Router:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Значения по умолчанию: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Сначала запустите мост (`node bin/cursor2api.js serve`); тогда 9Router перечислит модели как `cursor2api/<model id>`. Мост — это обычный локальный сервер OpenAI, поэтому Cline, Continue, Open WebUI, LiteLLM или любой клиент с `OPENAI_BASE_URL` работают так же.

## 🔌 Подключение к OmniRoute

[OmniRoute](https://omniroute.online) обращается к этому мосту как к обычному провайдеру, совместимому с OpenAI:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: любое непустое значение (или значение, переданное в `--key`)
4. Model: любой id из `GET /v1/models`

Или позвольте встроенному коннектору выполнить эти четыре шага за вас — он создаёт узел провайдера и подключение на локальном OmniRoute:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Значения по умолчанию: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Сначала запустите мост (`node bin/cursor2api.js serve`); тогда OmniRoute перечислит модели как `cursor2api/<model id>`. Мост — это обычный локальный сервер OpenAI, поэтому Cline, Continue, Open WebUI, LiteLLM или любой клиент с `OPENAI_BASE_URL` работают так же.

## Как работает вызов к вышестоящему сервису

API Cursor — это Connect RPC на `api2.cursor.sh`, а аккаунт — это идентификатор WorkOS:

1. **Вход** — `cursor.com/api/auth/login` перенаправляет в WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). Мост выполняет тот же танец PKCE, что и поставляемый
   CLI `cursor-agent`: S256-челлендж + `uuid` на `loginDeepControl`, `GET /auth/poll`
   (404 = всё ещё в ожидании) и обновление через `POST /auth/exchange_user_api_key`.
2. **Заголовки идентификации** — каждый вызов несёт `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` и `x-client-key`.
   Контрольная сумма кодирует `floor(Date.now()/1e6)` с помощью скользящего XOR/add-шифра по 6 байтам,
   кодирует её в base64url и добавляет стабильный 64-символьный hex-идентификатор машины; `x-client-key` — это стабильный
   дайджест для каждой установки. Оба детерминированно выводятся из токена (`src/checksum.js`).
3. **Чат** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools` с protobuf
   `StreamUnifiedChatRequestWithTools` в Connect-обрамлении: сообщения диалога (`text` + `type`, 1 = человек,
   2 = ИИ), `model_details.model_name`, идентификаторы запроса/диалога, `unified_mode = CHAT`.
   Ответы — это Connect-кадры `StreamUnifiedChatResponseWithTools`; мост читает
   `stream_unified_chat_response.text` (и `thinking.text`) и повторно выдаёт чанки OpenAI плюс `[DONE]`.
   Номера полей не угаданы: они были прочитаны из сгенерированного дескриптора `aiserver.v1`
   (`proxy-lab/.cursor-proto-dump.py` в рабочем пространстве разработки).
4. **Каталог/план** используют тот же Connect RPC с JSON-кодеком (`content-type: application/json`).

## Прокси (необязательно)

Задайте `CURSOR2API_PROXY` (или `--proxy`), и каждый вызов не к loopback — вход, обновление, каталог, чат —
уходит через этот прокси:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Поддерживаются: `socks5://`, `socks5h://` (DNS на прокси), `socks4a://`, `http://`, `https://`, с
необязательным `user:pass@`. Цели loopback обходят прокси, чтобы мок в наборе тестов продолжал работать.
Туннели написаны вручную на `node:net`/`node:tls`, и сбой прокси приводит к отказу: запрос
завершается ошибкой, а не тихо идёт напрямую.

## Тесты

```bash
node test/smoke.js
```

Прогоняет весь конвейер против **мок-шлюза Cursor** — без аккаунта, без сети. Он проверяет
откат `/v1/models`, исходящие заголовки клиента (`x-cursor-client-version`, форму контрольной суммы),
Connect-обрамление + тело protobuf, которое строит мост, потоковую трансляцию (дельты,
`finish_reason: stop`, `[DONE]`) и непоточную форму.

## Ограничения

- **Вызовы инструментов пока не транслируются.** Cursor передаёт кадры `client_side_tool_v2_call` (чтение файла,
  запуск терминала, …); мост отбрасывает их и пересылает только текст ассистента. Многоходовый контекст
  воспроизводится вызывающей стороной, а не кэшируется на стороне сервера Cursor.
- **Изображения/вложения не пересылаются.** Изображения и файловые вложения в диалоге
  игнорируются.
- Токены доступа — это JWT примерно на 1 ч; мост обновляет их с помощью сохранённого refresh-токена и запрашивает
  новый `login`, когда обновление отклонено.
- Какие модели отвечают и сколько включённой квоты осталось — это собственные права аккаунта:
  `cursor2api status` выводит план и использование за период, чтобы заблокированная модель была видна, а не молчала.

## ⚠️ Риск для аккаунта и как его минимизировать

Cursor привязывает каждый запрос к идентификатору WorkOS и своим собственным проверкам на мошенничество, поэтому относитесь к аккаунту — а не к
мосту — как к тому, что может быть заблокировано. Что этот мост делает и чего не делает:

- **Один аккаунт на хранилище токенов.** `~/.cursor2api/tokens.json` содержит один аккаунт; мост никогда не
  мультиплексирует несколько аккаунтов в одно хранилище и никогда не переиспользует идентификатор между аккаунтами.
- **Стабильная, производная сетевая идентичность.** `machineId` / `x-client-key` / `x-cursor-checksum` выводятся из
  собственного токена этого аккаунта, поэтому два хранилища никогда не предъявляют Cursor один и тот же отпечаток. Не копируйте
  хранилище между машинами и не ожидайте, что та же сессия продолжит работать.
- **Никакого формирования трафика.** Мост не ротирует IP, не повторяет запросы пачками и не скрывает, что запросы идут от
  локального сервера. Если вы поставите его за точкой сбора (роутер, общий агентский хост), которая выдаёт тысячи
  запросов в минуту на один аккаунт, ожидайте ограничений скорости и изменений прав — собственная
  квота аккаунта является потолком.
- **Регистрация здесь не автоматизирована.** `cursor2api login` авторизует *ваш* существующий аккаунт; мост не
  создаёт аккаунты, и собственные защиты Cursor от ботов/дубликатов при регистрации применяются к любому, кто попытается.
- Используйте опцию прокси, если исходящий трафик вашей машины не тот, с которого вы регистрировались: `--proxy` сохраняет
  трафик согласованным вместо перескакивания между маршрутами.

Если токен начинает отвечать 401/403 для каждой модели, обычно это аккаунт, а не мост: выполните
`cursor2api login` снова, затем `cursor2api status`, чтобы увидеть план и оставшуюся квоту.

## Лицензия

MIT — см. [LICENSE](LICENSE).