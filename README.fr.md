<div align="center">

# cursor2api

Passerelle non officielle qui transforme un compte **Cursor** en une **API locale compatible OpenAI**.

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

Deux chemins d'authentification :

- **Approbation par navigateur** (par défaut) : lien profond PKCE `https://cursor.com/loginDeepControl?challenge=…&uuid=…`,
  approuvé dans un navigateur connecté à cursor.com, puis interrogé sur `api2.cursor.sh/auth/poll` jusqu'à ce que le
  serveur renvoie `{ accessToken, refreshToken }`.
- **Clé API Cursor** : `cursor2api apikey key_…` échange la clé via
  `POST api2.cursor.sh/auth/exchange_user_api_key` — sans navigateur.

> Non officiel et sans affiliation avec Cursor. Utilisez-le avec un compte qui vous appartient et respectez les conditions de Cursor.
> Cette passerelle communique avec des points de terminaison privés ; ceux-ci peuvent changer sans préavis.

## Prérequis

- Node.js **18+** (aucune dépendance).
- Un compte Cursor (le plan gratuit *Hobby* suffit — la passerelle ne se soucie pas du niveau de plan, ce
  sont les droits propres du compte qui déterminent quels modèles répondent).

## Installation

```bash
git clone https://github.com/F0Rextasy/cursor2api.git
cd cursor2api
node bin/cursor2api.js help      # zero dependencies, nothing to install
```

Ou déposez le dossier n'importe où et appelez `node /path/to/cursor2api/bin/cursor2api.js …` ; il n'y a aucune étape
de build ni de `npm install` (Node 18+ fournit tout ce que la passerelle utilise).

## Une seule commande

Pointez l'outil vers vos clés API Cursor (`api-keys.txt`, une `key_…` par ligne) et il construit des
identifiants de passerelle vérifiés — échange, test de chat en direct, ne conserve que les 200 :

```bash
node src/cli.js mint --count 5 --pool proxies.txt   # 5 verified credentials in keys.txt
```

Un rejet définitif (401/403, un quota épuisé, un compte désactivé) est enregistré sous forme de
`key`, raison et horodatage ISO dans `keys-dead.txt` à côté de `keys.txt` ; un 429/5xx/échec de transport est
réessayé et jamais marqué comme mort. `--dry` affiche le plan et n'écrit rien.

> **Contrôles de qualité.** Chaque identifiant ici a passé un `chat-200` en direct avant d'être écrit dans `keys.txt`
> (les clés mortes ne sont jamais livrées). Les combinaisons de routeur suivent la même règle au niveau du modèle : une entrée est
> ajoutée **uniquement si le modèle répond `chat-200` et peut appeler des outils** — un modèle sans prise en charge des outils,
> une clé morte ou un fournisseur mort est écarté au lieu d'être ajouté. Fonctionne avec **9Router et OmniRoute**.

> ⚠️ **Conditions et risque pour le compte.** cursor2api est une passerelle non officielle : automatiser un fournisseur peut violer
> ses conditions d'utilisation et entraîner le bannissement de comptes ou d'IP. Vous exécutez ceci sur des comptes qui vous appartiennent, depuis votre propre
> machine, à vos propres risques. Lisez les conditions d'utilisation du fournisseur avant une exécution à grande échelle.

## Démarrage rapide

```bash
node bin/cursor2api.js login              # prints an approval URL, waits for the browser
node bin/cursor2api.js serve --port 8795  # local OpenAI API

curl http://127.0.0.1:8795/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

## Commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `cursor2api login [--tz Europe/Istanbul]` | Approbation par navigateur PKCE ; les jetons arrivent dans `~/.cursor2api/tokens.json`. |
| `cursor2api apikey <key_…>` | Échange une clé API Cursor contre la paire de jetons (sans navigateur). |
| `cursor2api serve [--port 8795] [--key secret] [--proxy url]` | Démarre l'API locale. |
| `cursor2api status` | État du jeton + plan + utilisation de la période en cours. |
| `cursor2api models` | Identifiants de modèles pour ce compte (repli sur la liste statique). |
| `cursor2api usage` | Charge utile brute du plan/d'utilisation. |
| `cursor2api logout` | Supprime les jetons stockés. |

## Points de terminaison

| Route | Forme | Remarques |
| --- | --- | --- |
| `GET /v1/models` | Liste de modèles OpenAI | `GetUsableModels` → `AvailableModels` → catalogue statique. |
| `POST /v1/chat/completions` | OpenAI Chat Completions | JSON + streaming SSE. |
| `GET /v1/usage` | Plan Cursor + utilisation de la période | `DashboardService`. |
| `GET /healthz` | `{ ok, hasToken, expiresAt, proxy }` | Vivacité. |

## 🔌 Connexion à 9Router

[9Router](https://9router.com) communique avec cette passerelle comme un simple fournisseur compatible OpenAI :

1. Providers → add → **OpenAI Compatible**
2. Base URL : `http://127.0.0.1:8795/v1`
3. API key : n'importe quelle valeur non vide (ou la valeur passée à `--key`)
4. Model : n'importe quel identifiant issu de `GET /v1/models`

Ou laissez le connecteur fourni effectuer ces quatre étapes pour vous — il crée le nœud de fournisseur et la connexion sur un 9Router local :

```bash
node src/launcher.js --connect-9router --9router-base http://localhost:20128 --9router-password 123456
```

Valeurs par défaut : `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Démarrez d'abord la passerelle (`node bin/cursor2api.js serve`) ; 9Router liste alors les modèles sous `cursor2api/<model id>`. La passerelle est un serveur OpenAI local normal, donc Cline, Continue, Open WebUI, LiteLLM ou tout client `OPENAI_BASE_URL` fonctionnent de la même manière.

## 🔌 Connexion à OmniRoute

[OmniRoute](https://omniroute.online) communique avec cette passerelle comme un simple fournisseur compatible OpenAI :

1. Providers → add → **OpenAI Compatible**
2. Base URL : `http://127.0.0.1:8795/v1`
3. API key : n'importe quelle valeur non vide (ou la valeur passée à `--key`)
4. Model : n'importe quel identifiant issu de `GET /v1/models`

Ou laissez le connecteur fourni effectuer ces quatre étapes pour vous — il crée le nœud de fournisseur et la connexion sur un OmniRoute local :

```bash
node src/launcher.js --connect-omniroute --omniroute-base http://localhost:20128 --omniroute-password 123456
```

Valeurs par défaut : `--prefix cursor2api`, `--name Cursor (bridge)`, `--base-url http://127.0.0.1:8795/v1`. Démarrez d'abord la passerelle (`node bin/cursor2api.js serve`) ; OmniRoute liste alors les modèles sous `cursor2api/<model id>`. La passerelle est un serveur OpenAI local normal, donc Cline, Continue, Open WebUI, LiteLLM ou tout client `OPENAI_BASE_URL` fonctionnent de la même manière.

## Comment fonctionne l'appel en amont

L'API de Cursor est du Connect RPC sur `api2.cursor.sh`, et le compte est une identité WorkOS :

1. **Connexion** — `cursor.com/api/auth/login` redirige vers WorkOS AuthKit
   (`client_01GS6W3C96KW4WRS6Z93JCE2RJ`). La passerelle effectue la même danse PKCE que le CLI
   `cursor-agent` fourni : défi S256 + `uuid` sur `loginDeepControl`, `GET /auth/poll`
   (404 = toujours en attente) et un rafraîchissement via `POST /auth/exchange_user_api_key`.
2. **En-têtes d'identité** — chaque appel porte `authorization: Bearer <accessToken>`,
   `x-cursor-client-version`, `x-cursor-client-type`, `x-cursor-checksum` et `x-client-key`.
   Le checksum encode `floor(Date.now()/1e6)` avec un chiffrement XOR/add roulant sur 6 octets,
   l'encode en base64url et y ajoute un identifiant machine stable de 64 hex ; `x-client-key` est un digest
   stable par installation. Les deux sont dérivés de manière déterministe à partir du jeton (`src/checksum.js`).
3. **Chat** — `POST /aiserver.v1.ChatService/StreamUnifiedChatWithTools` avec un protobuf
   `StreamUnifiedChatRequestWithTools` encadré par Connect : messages de conversation (`text` + `type`, 1 = humain,
   2 = ia), `model_details.model_name`, identifiants de requête/conversation, `unified_mode = CHAT`.
   Les réponses sont des trames Connect de `StreamUnifiedChatResponseWithTools` ; la passerelle lit
   `stream_unified_chat_response.text` (et `thinking.text`) et réémet des chunks OpenAI plus `[DONE]`.
   Les numéros de champ ne sont pas devinés : ils ont été lus dans le descripteur `aiserver.v1` généré
   (`proxy-lab/.cursor-proto-dump.py` dans l'espace de travail de développement).
4. **Catalogue/plan** utilisent le même Connect RPC avec le codec JSON (`content-type: application/json`).

## Proxy (facultatif)

Définissez `CURSOR2API_PROXY` (ou `--proxy`) et chaque appel non-loopback — connexion, rafraîchissement, catalogue, chat —
passe par ce proxy :

```bash
node bin/cursor2api.js serve --proxy socks5h://127.0.0.1:40000
```

Pris en charge : `socks5://`, `socks5h://` (DNS au niveau du proxy), `socks4a://`, `http://`, `https://`, avec
`user:pass@` facultatif. Les cibles loopback contournent le proxy afin que le mock de la suite de tests continue de fonctionner.
Les tunnels sont faits maison sur `node:net`/`node:tls`, et une défaillance du proxy est fail-closed : la requête
échoue au lieu de passer discrètement en direct.

## Tests

```bash
node test/smoke.js
```

Exécute tout le pipeline contre une **passerelle Cursor simulée** — sans compte, sans réseau. Il vérifie le
repli de `/v1/models`, les en-têtes client sortants (`x-cursor-client-version`, forme du checksum), le
cadrage Connect + le corps protobuf que la passerelle construit, la traduction en streaming (deltas,
`finish_reason: stop`, `[DONE]`) et la forme non-streaming.

## Limites

- **Les appels d'outils ne sont pas encore traduits.** Cursor diffuse des trames `client_side_tool_v2_call` (lire un fichier,
  exécuter un terminal, …) ; la passerelle les abandonne et ne transmet que le texte de l'assistant. Le contexte multi-tours est
  rejoué par l'appelant, non mis en cache côté serveur par Cursor.
- **La vision/les pièces jointes ne sont pas transmises.** Les images et les pièces jointes de fichiers dans la conversation sont
  ignorées.
- Les jetons d'accès sont des JWT d'environ 1 h ; la passerelle les rafraîchit avec le jeton de rafraîchissement stocké, et demande une
  nouvelle `login` lorsque le rafraîchissement est rejeté.
- Quels modèles répondent, et combien de l'allocation incluse il reste, relève des droits propres du compte :
  `cursor2api status` affiche le plan et l'utilisation de la période afin qu'un modèle bloqué soit visible au lieu d'être silencieux.

## ⚠️ Risque pour le compte et comment le minimiser

Cursor lie chaque requête à une identité WorkOS et à ses propres contrôles de fraude, donc considérez le compte — pas la
passerelle — comme ce qui peut être banni. Ce que cette passerelle fait et ne fait pas :

- **Un compte par stockage de jetons.** `~/.cursor2api/tokens.json` contient un seul compte ; la passerelle ne
  multiplexe jamais plusieurs comptes dans un même stockage et ne réutilise jamais une identité entre comptes.
- **Identité réseau stable et dérivée.** `machineId` / `x-client-key` / `x-cursor-checksum` sont dérivés du
  jeton propre à ce compte, donc deux stockages ne présentent jamais la même empreinte à Cursor. Ne copiez pas un
  stockage entre machines en espérant que la même session continue de fonctionner.
- **Aucune régulation du trafic.** La passerelle ne fait pas tourner les IP, ne réessaie pas en rafale et ne cache pas que les requêtes viennent d'un
  serveur local. Si vous la placez derrière un point de convergence (un routeur, une machine d'agents partagée) qui déclenche des milliers de
  requêtes par minute sur un seul compte, attendez-vous à des limites de débit et à des changements de droits — l'allocation propre du compte
  est le plafond.
- **L'inscription n'est pas automatisée ici.** `cursor2api login` autorise *votre* compte existant ; la passerelle ne
  crée pas de comptes, et les propres protections anti-bot/dédoublonnage d'inscription de Cursor s'appliquent à quiconque essaie.
- Utilisez l'option proxy si la sortie réseau de votre machine n'est pas celle depuis laquelle vous vous êtes inscrit : `--proxy` maintient le
  trafic cohérent au lieu de sauter entre les routes.

Si un jeton commence à répondre 401/403 pour tous les modèles, c'est généralement le compte, pas la passerelle : exécutez
`cursor2api login` à nouveau, puis `cursor2api status` pour voir le plan et l'allocation restante.

## Licence

MIT — voir [LICENSE](LICENSE).