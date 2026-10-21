// Endpoints, client constants and the static model catalog for api2.cursor.sh.
//
// Every value here was read off the wire or out of the shipped clients:
//   * auth: `cursor.com/api/auth/login` → WorkOS AuthKit → PKCE
//     `loginDeepControl` + `api2.cursor.sh/auth/poll` (see src/login.js)
//   * RPC: Connect protocol on `api2.cursor.sh`, protobuf or JSON codec
//   * client headers: the local `cursor-agent` bundle (2026.09.26-dd393fe)
//     and the reverse-engineered IDE client
//     (proxy-lab/out/.cursor2api/cxproxy/*)

export const API_BASE = process.env.CURSOR2API_BASE || "https://api2.cursor.sh";
export const LOGIN_HOST = process.env.CURSOR2API_LOGIN_HOST || "https://cursor.com";

/** Client identity the server accepts. `cli-<version>` matches the shipped CLI. */
export const CLIENT_VERSION = process.env.CURSOR2API_CLIENT_VERSION || "cli-2026.09.26-dd393fe";
export const CLIENT_TYPE = "cli";
export const USER_AGENT = `cursor-agent/${CLIENT_VERSION.replace(/^cli-/, "")}`;

/** RPC paths (Connect: POST /<package>.<Service>/<Method>). */
export const RPC = {
  availableModels: "aiserver.v1.AiService/AvailableModels",
  getUsableModels: "aiserver.v1.AiService/GetUsableModels",
  getUserInfo: "aiserver.v1.AiService/GetUserInfo",
  streamChat: "aiserver.v1.AiService/StreamChat",
  streamUnifiedChatWithTools: "aiserver.v1.ChatService/StreamUnifiedChatWithTools",
  periodUsage: "aiserver.v1.DashboardService/GetCurrentPeriodUsage",
  planInfo: "aiserver.v1.DashboardService/GetPlanInfo",
};

/** Auth paths. */
export const AUTH = {
  loginDeepControl: `${LOGIN_HOST}/loginDeepControl`,
  poll: `${API_BASE}/auth/poll`,
  exchangeApiKey: `${API_BASE}/auth/exchange_user_api_key`,
};

/** Static catalog: used until `GetUsableModels` answers for the account. */
export const KNOWN_MODELS = [
  "auto",
  "composer-1",
  "gpt-5.1-codex",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4o",
  "claude-4.5-opus-high",
  "claude-4.5-opus-high-thinking",
  "claude-4.5-sonnet",
  "claude-4.5-sonnet-thinking",
  "claude-4-sonnet",
  "gemini-3-pro",
  "gemini-2.5-flash",
  "grok-code-fast-1",
];

export const DEFAULT_MODEL = "auto";

// Fail-closed proxy: every upstream call goes through the proxy below when set
// (env `CURSOR2API_PROXY`). `configure()` lets the CLI override it at runtime.
export const config = {
  base: API_BASE,
  proxy: process.env.CURSOR2API_PROXY || null,
  apiKey: process.env.CURSOR2API_KEY || null,
  storePath: null,
  clientVersion: CLIENT_VERSION,
};

export function configure(patch = {}) {
  Object.assign(config, patch);
  return config;
}
