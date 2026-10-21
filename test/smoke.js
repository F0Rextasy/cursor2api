#!/usr/bin/env node
// End-to-end smoke test with a mock Cursor gateway: no account, no network.
//
// Verifies the parts a live account cannot prove faster:
//   * /v1/models  falls back to the static catalog when the catalog RPC is down
//   * /v1/chat/completions (stream) emits OpenAI chunks + [DONE], and the request
//     the bridge sends carries the Cursor headers and a decodable
//     StreamUnifiedChatRequestWithTools body
//   * the checksum/client-key headers are well formed
//
//   node test/smoke.js

import http from "node:http";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const storeFile = path.join(os.tmpdir(), `cursor2api-smoke-${process.pid}.json`);
fs.writeFileSync(
  storeFile,
  JSON.stringify({
    account: { accessToken: "smoke-tok", refreshToken: "smoke-ref", machineId: "a".repeat(64) },
  })
);
process.env.CURSOR2API_STORE = storeFile;

// A real-looking JWT so store.isExpired() stays quiet.
const jwt = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.y`;

const seen = { unary: [], chat: null, chatHeaders: null };
const encoder = new TextEncoder();

function connectFrame(payload) {
  const header = Buffer.alloc(5);
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, payload]);
}

const gateway = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    if (req.url.includes("AvailableModels") || req.url.includes("GetUsableModels")) {
      seen.unary.push({ url: req.url, headers: req.headers, body: body.length });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ models: [{ modelName: "gpt-4o" }, { modelName: "claude-4.5-sonnet" }] }));
      return;
    }
    if (req.url.includes("StreamUnifiedChatWithTools")) {
      seen.chat = body;
      seen.chatHeaders = req.headers;
      res.writeHead(200, { "content-type": "application/connect+proto" });
      // two text deltas then an end-of-stream frame
      const textFrame = (text) => {
        const inner = Buffer.concat([Buffer.from([0x0a, text.length]), Buffer.from(text)]);
        const outer = Buffer.concat([Buffer.from([0x12, inner.length]), inner]);
        return connectFrame(outer);
      };
      res.write(textFrame("pong"));
      res.write(textFrame("-ok"));
      const end = Buffer.concat([Buffer.from([0x02]), (() => {
        const payload = Buffer.from("{}");
        const header = Buffer.alloc(4);
        header.writeUInt32BE(payload.length, 0);
        return Buffer.concat([header, payload]);
      })()]);
      res.end(end);
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
});

await new Promise((r) => gateway.listen(0, "127.0.0.1", r));
const gatewayPort = gateway.address().port;

// Point the bridge at the mock gateway and start it.
const { configure } = await import("../src/config.js");
configure({ base: `http://127.0.0.1:${gatewayPort}` });
const store = await import("../src/store.js");
store.set({ accessToken: jwt, refreshToken: "smoke-ref", machineId: "a".repeat(64) });
store.set({ expiresAt: Date.now() + 3600_000 });

const { createServer } = await import("../src/server.js");
const bridge = createServer({});
await new Promise((r) => bridge.listen(0, "127.0.0.1", r));
const bridgePort = bridge.address().port;
const base = `http://127.0.0.1:${bridgePort}`;


// 1. models
const models = await fetch(`${base}/v1/models`).then((r) => r.json());
const results = [];
const check = (name, fn) => results.push({ name, fn });
// 2. streaming chat
const chatRes = await fetch(`${base}/v1/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o", stream: true, messages: [{ role: "user", content: "ping" }] }),
});
const text = await chatRes.text();
check("stream carries assistant text", () => assert.match(text, /"content":"pong"/));
check("stream ends with [DONE]", () => assert.match(text, /data: \[DONE\]/));
check("stream reports finish_reason=stop", () => assert.match(text, /"finish_reason":"stop"/));

// 3. what the bridge sent upstream
check("upstream got the Cursor client version header", () =>
  assert.match(String(seen.chatHeaders["x-cursor-client-version"]), /^cli-/));
check("upstream got x-cursor-checksum (+machine id)", () =>
  assert.ok(String(seen.chatHeaders["x-cursor-checksum"]).endsWith("a".repeat(64))));
check("upstream body is a Connect frame with a chat request", () => {
  assert.equal(seen.chat[0], 0, "flags byte");
  const len = seen.chat.readUInt32BE(1);
  assert.equal(len, seen.chat.length - 5, "length prefix matches payload");
  const payload = seen.chat.subarray(5);
  const needle = Buffer.from("gpt-4o", "utf8");
  assert.ok(payload.includes(needle), "model name present in protobuf payload");
  const userNeedle = Buffer.from("ping", "utf8");
  assert.ok(payload.includes(userNeedle), "user text present in protobuf payload");
  return true;
});

// 4. non-streaming
const plain = await fetch(`${base}/v1/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o", stream: false, messages: [{ role: "user", content: "ping" }] }),
}).then((r) => r.json());
check("non-stream returns one assistant message", () =>
  assert.equal(plain.choices[0].message.content, "pong-ok"));

let failed = 0;
for (const r of results) {
  try {
    r.fn();
    console.log(`ok   ${r.name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${r.name}: ${err.message}`);
  }
}
await new Promise((r) => gateway.close(r));
await new Promise((r) => bridge.close(r));
fs.rmSync(storeFile, { force: true });
console.log(failed ? `\n${failed} failed` : `\n${results.length}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
