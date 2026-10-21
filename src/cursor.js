// Cursor upstream client: Connect RPC on api2.cursor.sh.
//
// Unary calls (models, usage, plan) use the JSON codec over plain HTTP — that is
// how the shipped CLI talks for analytics/catalog calls. Chat uses the streaming
// codec with a hand-built `StreamUnifiedChatRequestWithTools` (field numbers from
// the generated aiserver.v1 descriptor, see src/proto.js).
//
// Everything goes through src/http.js, so `CURSOR2API_PROXY` makes upstream
// fail-closed exactly like the rest of the fleet's bridges.

import crypto from "node:crypto";
import zlib from "node:zlib";
import { config, RPC, CLIENT_TYPE, USER_AGENT, KNOWN_MODELS } from "./config.js";
import { request } from "./http.js";
import { cursorChecksum, machineIdFor, clientKeyFor } from "./checksum.js";
import { refreshTokens } from "./login.js";
import * as store from "./store.js";
import { str, int, bool, readMessage, firstText, connectFrame, splitFrames } from "./proto.js";

const MESSAGE_TYPE = { human: 1, ai: 2 };
const UNIFIED_MODE_CHAT = 1;

export class CursorError extends Error {
  constructor(message, { status = 0, body = "" } = {}) {
    super(message);
    this.name = "CursorError";
    this.status = status;
    this.body = String(body).slice(0, 600);
  }
}

/** Per-account wire identity (stable across calls for the same token). */
function identity(entry) {
  const seed = entry.machineId || entry.accessToken?.slice(-32) || "cursor2api";
  const machineId = entry.machineId || machineIdFor(seed);
  return { machineId, clientKey: entry.clientKey || clientKeyFor(machineId) };
}

function headers(entry, { js = false, body } = {}) {
  const { machineId, clientKey } = identity(entry);
  const h = {
    authorization: `Bearer ${entry.accessToken}`,
    "connect-protocol-version": "1",
    "content-type": js ? "application/json" : "application/connect+proto",
    "user-agent": USER_AGENT,
    "x-cursor-checksum": cursorChecksum(machineId),
    "x-client-key": clientKey,
    "x-cursor-client-version": config.clientVersion,
    "x-cursor-client-type": CLIENT_TYPE,
    "x-cursor-timezone": process.env.CURSOR2API_TZ || "UTC",
    "x-request-id": crypto.randomUUID(),
    "x-ghost-mode": "true",
    accept: js ? "application/json" : "application/connect+proto",
    "accept-encoding": "gzip",
  };
  if (body) h["content-length"] = String(body.length);
  return h;
}

/** Stored account, refreshed when the JWT is (nearly) expired. */
export async function resolveAccount({ force = false } = {}) {
  let entry = store.get();
  if (!entry?.accessToken && !entry?.refreshToken) {
    throw new CursorError("not logged in — run `cursor2api login`");
  }
  if (force || store.isExpired(entry)) {
    if (!entry.refreshToken) throw new CursorError("token expired and no refresh token — run `cursor2api login`");
    const fresh = await refreshTokens(entry.refreshToken);
    if (!fresh) throw new CursorError("refresh rejected — run `cursor2api login` again");
    entry = store.set({
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken || entry.refreshToken,
      expiresAt: store.expiryOf(fresh.accessToken),
    });
  }
  if (!entry.machineId) {
    const { machineId, clientKey } = identity(entry);
    entry = store.set({ machineId, clientKey });
  }
  return entry;
}

async function unary(method, body = {}) {
  const entry = await resolveAccount();
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  const res = await request(`${config.base}/${method}`, {
    method: "POST",
    headers: headers(entry, { js: true, body: payload }),
    body: payload,
  });
  const text = await res.text();
  if (res.status === 401) {
    const retry = await resolveAccount({ force: true }).catch(() => null);
    if (retry) {
      const again = await request(`${config.base}/${method}`, {
        method: "POST",
        headers: headers(retry, { js: true, body: payload }),
        body: payload,
      });
      const text2 = await again.text();
      if (again.ok) return parseJson(text2);
      throw new CursorError(`${method} failed`, { status: again.status, body: text2 });
    }
  }
  if (!res.ok) throw new CursorError(`${method} failed`, { status: res.status, body: text });
  return parseJson(text);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/** Account-visible model ids; falls back to the static catalog. */
export async function usableModels() {
  for (const method of [RPC.getUsableModels, RPC.availableModels]) {
    try {
      const out = await unary(method, {});
      const list = out.models || out.usableModels || out.availableModels;
      if (Array.isArray(list) && list.length) {
        return list.map((m) => m.modelName || m.model_name || m.name || String(m)).filter(Boolean);
      }
    } catch {
      /* fall through to the static catalog */
    }
  }
  return KNOWN_MODELS.slice();
}

export async function planInfo() {
  const [plan, usage] = await Promise.all([
    unary(RPC.planInfo, {}).catch((e) => ({ error: e.message })),
    unary(RPC.periodUsage, {}).catch((e) => ({ error: e.message })),
  ]);
  return { plan, usage };
}

/** One turn worth of Cursor conversation messages from OpenAI-style messages. */
export function toConversation(messages) {
  const conversation = [];
  let system = "";
  for (const msg of messages) {
    const text = typeof msg.content === "string" ? msg.content : (msg.content || []).map((p) => p.text || "").join("");
    if (msg.role === "system") system += (system ? "\n\n" : "") + text;
    else conversation.push({ text, type: msg.role === "assistant" ? MESSAGE_TYPE.ai : MESSAGE_TYPE.human });
  }
  if (system) conversation.unshift({ text: system, type: MESSAGE_TYPE.human });
  return conversation;
}

function buildChatRequest({ conversation, model, maxTokens }) {
  const parts = [];
  for (const msg of conversation) {
    parts.push(str(2, Buffer.concat([str(1, msg.text), int(2, msg.type)])));
  }
  const modelDetails = Buffer.concat([
    str(1, model),
    bool(3, true), // enable_ghost_mode
  ]);
  parts.push(str(7, modelDetails));
  parts.push(str(9, crypto.randomUUID())); // request_id
  parts.push(str(15, crypto.randomUUID())); // conversation_id
  if (maxTokens) parts.push(int(26, maxTokens));
  parts.push(bool(33, true)); // use_unified_chat_prompt
  parts.push(bool(35, true)); // use_full_inputs_context
  parts.push(int(46, UNIFIED_MODE_CHAT));
  parts.push(str(54, "Ask"));
  return str(1, Buffer.concat(parts)); // StreamUnifiedChatRequestWithTools.request
}

/** Streams `{type, text}` deltas from Cursor's chat RPC. */
export async function* streamChat({ messages, model, maxTokens = 4096 }) {
  const entry = await resolveAccount();
  const body = connectFrame(buildChatRequest({ conversation: toConversation(messages), model, maxTokens }));
  const res = await request(`${config.base}/${RPC.streamUnifiedChatWithTools}`, {
    method: "POST",
    headers: headers(entry, { js: false, body }),
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CursorError("chat request rejected", { status: res.status, body: text });
  }
  let buffer = Buffer.alloc(0);
  for await (const chunk of res.body) {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    const { frames, rest } = splitFrames(buffer);
    buffer = rest;
    for (const frame of frames) {
      const delta = decodeFrame(frame);
      if (delta) yield delta;
    }
  }
  if (buffer.length) {
    const { frames } = splitFrames(buffer);
    for (const frame of frames) {
      const delta = decodeFrame(frame);
      if (delta) yield delta;
    }
  }
}

function decodeFrame({ flags, payload }) {
  const gz = (flags & 1) === 1 && (flags & 2) === 0;
  const end = (flags & 2) === 2;
  let data = payload;
  if (gz) {
    try {
      data = zlib.gunzipSync(payload);
    } catch {
      return null;
    }
  }
  if (end) {
    try {
      const trailer = JSON.parse(data.toString("utf8") || "{}");
      if (trailer.error) throw new CursorError(trailer.error.message || "stream error");
    } catch (e) {
      if (e instanceof CursorError) throw e;
    }
    return { type: "done" };
  }
  if (flags === 0) {
    const outer = readMessage(data);
    const inner = outer.get(2)?.[0];
    if (!inner) return null;
    const fields = readMessage(inner);
    const text = firstText(fields, 1);
    if (text) return { type: "text", text };
    const intermediate = firstText(fields, 7);
    if (intermediate) return { type: "text", text: intermediate };
    const thinking = fields.get(25)?.[0];
    if (thinking) {
      const t = firstText(readMessage(thinking), 1);
      if (t) return { type: "thinking", text: t };
    }
    return null;
  }
  // JSON frames (connect+json or error payloads)
  try {
    const parsed = JSON.parse(data.toString("utf8"));
    if (parsed.error) throw new CursorError(parsed.error.message || "stream error");
    const text = parsed?.streamUnifiedChatResponse?.text || parsed?.stream_unified_chat_response?.text;
    if (text) return { type: "text", text };
  } catch (e) {
    if (e instanceof CursorError) throw e;
  }
  return null;
}
