// Local HTTP server: OpenAI-compatible facade over a Cursor account.
//
//   GET  /healthz              liveness + credential state
//   GET  /v1/models            this account's Cursor models
//   POST /v1/chat/completions  OpenAI shape (JSON + SSE)
//
// The Cursor backend streams text deltas; tool calls are not translated (yet),
// so a turn only ever yields assistant text.

import http from "node:http";
import crypto from "node:crypto";
import { config, DEFAULT_MODEL } from "./config.js";
import * as store from "./store.js";
import { CursorError, resolveAccount, usableModels, streamChat, planInfo } from "./cursor.js";

export function createServer({ apiKey = config.apiKey } = {}) {
  return http.createServer((req, res) => {
    handle(req, res, apiKey).catch((err) => {
      sendJson(res, 500, { error: { message: `bridge failure: ${err.message}`, type: "api_error" } });
    });
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

function readBody(req, limit = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authorized(req, apiKey) {
  if (!apiKey) return true;
  const header = req.headers.authorization || "";
  return (header.startsWith("Bearer ") ? header.slice(7).trim() : "") === apiKey;
}

async function handle(req, res, apiKey) {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/")) {
    const entry = store.get();
    const expired = store.isExpired(entry);
    return sendJson(res, entry && !expired ? 200 : 503, {
      ok: Boolean(entry) && !expired,
      hasToken: Boolean(entry?.accessToken),
      expiresAt: entry?.expiresAt || null,
      proxy: config.proxy ? "configured" : "direct",
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/models") {
    if (!authorized(req, apiKey)) return sendJson(res, 401, { error: { message: "bad api key", type: "auth_error" } });
    const models = await usableModels();
    return sendJson(res, 200, {
      object: "list",
      data: models.map((id) => ({ id, object: "model", created: 0, owned_by: "cursor" })),
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/usage") {
    return sendJson(res, 200, await planInfo());
  }
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    if (!authorized(req, apiKey)) return sendJson(res, 401, { error: { message: "bad api key", type: "auth_error" } });
    const body = JSON.parse(await readBody(req));
    const model = body.model || DEFAULT_MODEL;
    const stream = body.stream !== false;
    const messages = body.messages || [];
    if (!messages.length) return sendJson(res, 400, { error: { message: "messages is required", type: "invalid_request_error" } });
    await resolveAccount();

    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    if (!stream) {
      let text = "";
      for await (const delta of streamChat({ messages, model, maxTokens: body.max_tokens })) {
        if (delta.type === "text") text += delta.text;
      }
      return sendJson(res, 200, {
        id,
        object: "chat.completion",
        created,
        model,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      });
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    const chunk = (delta, finish = null) =>
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finish }],
      })}\n\n`;
    res.write(chunk({ role: "assistant", content: "" }));
    try {
      for await (const delta of streamChat({ messages, model, maxTokens: body.max_tokens })) {
        res.write(chunk(delta.type === "thinking" ? { reasoning_content: delta.text } : { content: delta.text }));
      }
      res.write(chunk({}, "stop"));
    } catch (err) {
      const message = err instanceof CursorError ? `${err.message} (HTTP ${err.status})` : err.message;
      res.write(`data: ${JSON.stringify({ error: { message, type: "upstream_error" } })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    return res.end();
  }
  return sendJson(res, 404, { error: { message: "not found", type: "invalid_request_error" } });
}
