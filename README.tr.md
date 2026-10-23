<div align="center">

# cursor2api

Bir **Cursor** hesabını yerel bir **OpenAI uyumlu API**'ye dönüştüren resmî olmayan köprü.

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

İki kimlik bilgisi yolu:

- **Tarayıcı onayı** (varsayılan): PKCE derin bağlantısı `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  cursor.com'a giriş yapılmış bir tarayıcıda onaylanır, ardından sunucu
  `{ accessToken, refreshToken }` döndürene kadar `api2.cursor.sh/auth/poll` adresinde yoklanır.
- **Cursor API anahtarı**: `cursor2api apikey key_…` anahtarı
  `POST api2.cursor.sh/auth/exchange_user_api_key` üzerinden değiştirir — tarayıcı yok.

> Resmî değildir ve Cursor ile bağlantılı değildir. Sahip olduğunuz bir hesapla kullanın ve Cursor'ın şartlarına uyun.
> Bu köprü özel uç noktalarla konuşur; bunlar haber verilmeden değişebilir.

## Gereksinimler

- Node.js **18+** (bağımlılık yok).
- Bir Cursor hesabı (ücretsiz *Hobby* planı da sayılır — köprü plan kademesini önemsemez,
  hangi modellerin yanıt vereceğine hesabın kendi yetkileri karar verir).

## Kurulum

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

Veya klasörü herhangi bir yere bırakıp `node /path/to/cursor2api/bin/cursor2api.js …` çağırın; derleme
adımı ve `npm install` yoktur (Node 18+ köprünün kullandığı her şeyi içerir).

## Tek komut

Aracı Cursor API anahtarlarınıza yönlendirin (`api-keys.txt`, satır başına bir `key_…`) ve doğrulanmış
köprü kimlik bilgilerini oluşturur — değişim, canlı sohbet denemesi, yalnızca 200'leri tut:

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

Kesin bir ret (401/403, tükenmiş kota, devre dışı bırakılmış hesap) `keys.txt`'in yanındaki
`keys-dead.txt` dosyasına `key`, sebep ve ISO zamanı olarak kaydedilir; 429/5xx/taşıma hatası
yeniden denenir ve asla ölü olarak işaretlenmez. `--dry` planı yazdırır ve hiçbir şey yazmaz.

> **Kalite kapıları.** Buradaki her kimlik bilgisi `keys.txt`'e yazılmadan önce canlı bir `chat-200`
> geçti (ölü anahtarlar asla gönderilmez). Yönlendirici kombinasyonları model düzeyinde aynı kuralı
> izler: bir giriş **yalnızca model `chat-200` yanıtlıyorsa ve araçları çağırabiliyorsa** eklenir —
> araç desteği olmayan bir model, ölü bir anahtar veya ölü bir sağlayıcı eklenmek yerine çıkarılır.
> **9Router ve OmniRoute** ile çalışır.

> ⚠️ **Şartlar ve hesap riski.** cursor2api resmî olmayan bir köprüdür: bir sağlayıcıyı otomatikleştirmek
> Hizmet Şartlarını ihlal edebilir ve hesapların veya IP'lerin yasaklanmasına yol açabilir. Bunu sahip
> olduğunuz hesaplarda, kendi makinenizden, kendi riskinizle çalıştırırsınız. Büyük bir çalıştırmadan önce
> sağlayıcının ToS'unu okuyun.

## Hızlı başlangıç

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | PKCE tarayıcı onayı; tokenlar `~/.cursor2api/tokens.json` içine düşer. |
| `cursor2api apikey <key_…>` | Bir Cursor API anahtarını token çiftiyle değiştirir (tarayıcı yok). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Yerel API'yi başlatır. |
| `cursor2api status` | Token durumu + plan + geçerli dönem kullanımı. |
| `cursor2api models` | Bu hesap için model kimlikleri (statik listeye geri döner). |
| `cursor2api usage` | Ham plan/kullanım yükü. |
| `cursor2api logout` | Saklanan tokenları siler. |

## Uç noktalar

| Rota | Şekil | Notlar |
| --- | --- | --- |
| `GET /v1/models` | OpenAI modeller listesi | `GetUsableModels` → `AvailableModels` → statik katalog. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + SSE akışı. |
| `GET /v1/usage` | Cursor planı + dönem kullanımı | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Canlılık. |

## 🔌 9Router'a bağlanma

[9Router](https://9router.com) bu köprüyle düz bir OpenAI uyumlu sağlayıcı olarak konuşur:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: boş olmayan herhangi bir şey (veya `--key` için verdiğiniz değer)
4. Model: `GET /v1/models` içinden herhangi bir kimlik

Veya paketlenmiş bağlayıcının bu dört adımı sizin için yapmasına izin verin — yerel bir 9Router üzerinde sağlayıcı düğümünü ve bağlantıyı oluşturur:

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Varsayılanlar: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Önce köprüyü başlatın (`node bin/cursor2api.js serve`); 9Router ardından modelleri `cursor2api/<model id>` olarak listeler. Köprü normal bir yerel OpenAI sunucusudur, bu nedenle Cline, Continue, Open WebUI, LiteLLM veya herhangi bir `OPENAI_BASE_URL` istemcisi aynı şekilde çalışır.

## 🔌 OmniRoute'a bağlanma

[OmniRoute](https://omniroute.online) bu köprüyle düz bir OpenAI uyumlu sağlayıcı olarak konuşur:

1. Providers → add → **OpenAI Compatible**
2. Base URL: `http://127.0.0.1:8795/v1`
3. API key: boş olmayan herhangi bir şey (veya `--key` için verdiğiniz değer)
4. Model: `GET /v1/models` içinden herhangi bir kimlik

Veya paketlenmiş bağlayıcının bu dört adımı sizin için yapmasına izin verin — yerel bir OmniRoute üzerinde sağlayıcı düğümünü ve bağlantıyı oluşturur:

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Varsayılanlar: `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Önce köprüyü başlatın (`node bin/cursor2api.js serve`); OmniRoute ardından modelleri `cursor2api/<model id>` olarak listeler. Köprü normal bir yerel OpenAI sunucusudur, bu nedenle Cline, Continue, Open WebUI, LiteLLM veya herhangi bir `OPENAI_BASE_URL` istemcisi aynı şekilde çalışır.

## Yukarı akış çağrısı nasıl çalışır

Cursor'ın API'si `api2.cursor.sh` üzerinde Connect RPC'dir ve hesap bir WorkOS kimliğidir:

1. **Giriş** — `cursor.com/api/auth/login`, WorkOS AuthKit'e yönlendirir
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). Köprü, gönderilen `cursor-agent` CLI'nin yaptığı
   aynı PKCE dansını yapar: `loginDeepControl`'da S256 challenge + `uuid`, `GET /auth/poll`
   (404 = hâlâ beklemede) ve `POST /auth/exchange_user_api_key` üzerinden bir yenileme.
2. **Kimlik başlıkları** — her çağrı `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` ve `x-client-key` taşır.
   Checksum, `floor(Date.now()/1e6)` değerini 6 bayt üzerinde dönen bir XOR/add şifresiyle kodlar,
   base64url ile kodlar ve sabit bir 64-hex makine kimliği ekler; `x-client-key` kurulum başına
   sabit bir özettir. Her ikisi de token'dan deterministik olarak türetilir (`src/checksum.js`).
3. **Sohbet** — Connect çerçeveli bir `StreamUnifiedChatRequestWithTools` protobuf'u ile
   `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools`: konuşma mesajları (`text` + `type`, 1 = insan,
   2 = ai), `model_details.model_name`, istek/konuşma kimlikleri, `unified_mode = CHAT`.
   Yanıtlar `StreamUnifiedChatResponseWithTools`'un Connect çerçeveleridir; köprü
   `stream_unified_chat_response.text` (ve `thinking.text`) okur ve OpenAI parçaları ile `[DONE]` yeniden yayar.
   Alan numaraları tahmin edilmedi: oluşturulan `aiserver.v1` tanımlayıcısından okundular
   (geliştirme çalışma alanındaki `proxy-lab/.cursor-proto-dump.py`).
4. **Katalog/plan** aynı Connect RPC'yi JSON kodeğiyle kullanır (`content-type: application/json`).

## Proxy (isteğe bağlı)

`CURSOR2API_PROXY` (veya `--proxy`) ayarlayın ve loopback olmayan her çağrı — giriş, yenileme, katalog, sohbet —
o proxy üzerinden çıkar:

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Desteklenenler: `socks5://`, `socks5h://` (DNS proxy'de), `socks4a://`, `http://`, `https://`, isteğe bağlı
`user:pass@` ile. Loopback hedefleri proxy'yi atlar, böylece test paketinin mock'u çalışmaya devam eder.
Tüneller `node:net`/`node:tls` üzerinde elle yapılmıştır ve bir proxy hatası fail-closed'dur: istek
sessizce doğrudan gitmek yerine hata verir.

## Testler

```bash
node test/smoke.js
```

Tüm hattı bir **mock Cursor ağ geçidine** karşı çalıştırır — hesap yok, ağ yok. `/v1/models`
geri dönüşünü, giden istemci başlıklarını (`x-cursor-client-version`, checksum şekli), köprünün
oluşturduğu Connect çerçeveleme + protobuf gövdesini, akış çevirisini (deltalar,
`finish_reason: stop`, `[DONE]`) ve akışsız şekli doğrular.

## Sınırlar

- **Araç çağrıları henüz çevrilmiyor.** Cursor `client_side_tool_v2_call` çerçevelerini akıtır (dosya oku,
  terminal çalıştır, …); köprü bunları düşürür ve yalnızca asistan metnini iletir. Çok turlu bağlam
  çağıran tarafından yeniden oynatılır, Cursor tarafından sunucu tarafında önbelleğe alınmaz.
- **Görüntü/ekler iletilmez.** Konuşmadaki görüntüler ve dosya ekleri
  yok sayılır.
- Erişim tokenları ~1 saatlik JWT'lerdir; köprü bunları saklanan yenileme tokenıyla yeniler ve yenileme
  reddedildiğinde yeni bir `login` ister.
- Hangi modellerin yanıt verdiği ve dahil edilen ödeneğin ne kadarının kaldığı hesabın kendi yetkisidir:
  `cursor2api status` planı ve dönem kullanımını yazdırır, böylece engellenen bir model sessiz kalmak yerine görünür olur.

## ⚠️ Hesap riski ve bunu en aza indirme

Cursor her isteği bir WorkOS kimliğine ve kendi dolandırıcılık kontrollerine bağlar, bu nedenle yasaklanabilecek
şey olarak köprüyü değil hesabı görün. Bu köprünün yaptığı ve yapmadığı şeyler:

- **Token deposu başına bir hesap.** `~/.cursor2api/tokens.json` tek bir hesap tutar; köprü asla
  birden fazla hesabı tek bir depoda çoklamaz ve bir kimliği hesaplar arasında asla yeniden kullanmaz.
- **Sabit, türetilmiş kablo kimliği.** `machineId` / `x-client-key` / `x-cursor-checksum` o hesabın
  kendi tokenından türetilir, bu nedenle iki depo Cursor'a asla aynı parmak izini sunmaz. Bir depoyu
  makineler arasında kopyalayıp aynı oturumun çalışmaya devam etmesini beklemeyin.
- **Trafik şekillendirme yok.** Köprü IP'leri döndürmez, patlamalar halinde yeniden denemez veya isteklerin
  yerel bir sunucudan geldiğini gizlemez. Onu bir fan-in arkasına koyarsanız (bir yönlendirici, paylaşılan bir ajan kutusu)
  ve tek bir hesaba dakikada binlerce istek gönderirse, hız sınırları ve yetki değişiklikleri bekleyin —
  hesabın kendi ödeneği tavandır.
- **Kayıt burada otomatikleştirilmemiştir.** `cursor2api login` *mevcut* hesabınızı yetkilendirir; köprü
  hesap oluşturmaz ve Cursor'ın kendi kayıt botu/tekilleştirme korumaları deneyen herkes için geçerlidir.
- Makinenizin çıkışı kaydolduğunuz yer değilse proxy seçeneğini kullanın: `--proxy`, rotalar arasında
  zıplamak yerine trafiği tutarlı tutar.

Bir token her model için 401/403 yanıtı vermeye başlarsa, bu genellikle köprü değil hesaptır: tekrar
`cursor2api login` çalıştırın, ardından planı ve kalan ödeneği görmek için `cursor2api status` çalıştırın.

## Lisans

MIT — bkz. [LICENSE](LICENSE).