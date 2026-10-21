// Minimal protobuf wire helpers — just what the Cursor chat RPC needs.
//
// The field numbers used by src/cursor.js come from the generated descriptor in
// `server_full_pb2.py` (aiserver.v1), read with proxy-lab/.cursor-proto-dump.py:
//
//   StreamUnifiedChatRequestWithTools { 1 stream_unified_chat_request, 2 client_side_tool_v2_result }
//   StreamUnifiedChatRequest { 2 conversation[], 7 model_details, 9 request_id,
//                              15 conversation_id, 26 desired_max_tokens,
//                              33 use_unified_chat_prompt, 35 use_full_inputs_context,
//                              46 unified_mode, 54 unified_mode_name }
//   ConversationMessage { 1 text, 2 type }     type: 1 human, 2 ai
//   ModelDetails { 1 model_name, 3 enable_ghost_mode, 5 enable_slow_pool }
//   StreamUnifiedChatResponseWithTools { 1 client_side_tool_v2_call, 2 stream_unified_chat_response }
//   StreamUnifiedChatResponse { 1 text, 7 intermediate_text, 14 should_break_ai_message, 25 thinking }

export function varint(n) {
  const bytes = [];
  let value = BigInt(n);
  while (value > 0x7fn) {
    bytes.push(Number(value & 0x7fn) | 0x80);
    value >>= 7n;
  }
  bytes.push(Number(value));
  return Buffer.from(bytes);
}

export function tag(field, wire) {
  return varint((field << 3) | wire);
}

export function str(field, value) {
  if (value === undefined || value === null) return Buffer.alloc(0);
  const body = Buffer.from(String(value), "utf8");
  return Buffer.concat([tag(field, 2), varint(body.length), body]);
}

export function bytes(field, value) {
  const body = Buffer.from(value || []);
  return Buffer.concat([tag(field, 2), varint(body.length), body]);
}

export function int(field, value) {
  if (value === undefined || value === null) return Buffer.alloc(0);
  return Buffer.concat([tag(field, 0), varint(value)]);
}

export function bool(field, value) {
  return value ? int(field, 1) : Buffer.alloc(0);
}

/** Reads a protobuf message into `{ fieldNumber: [values] }` (wire 0 varint, 2 bytes). */
export function readMessage(buf) {
  const fields = new Map();
  let i = 0;
  while (i < buf.length) {
    let shift = 0;
    let tagValue = 0;
    for (;;) {
      const byte = buf[i++];
      if (byte === undefined) return fields;
      tagValue |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    const field = tagValue >>> 3;
    const wire = tagValue & 7;
    if (wire === 0) {
      let value = 0n;
      let s = 0n;
      for (;;) {
        const byte = buf[i++];
        if (byte === undefined) return fields;
        value |= BigInt(byte & 0x7f) << s;
        if ((byte & 0x80) === 0) break;
        s += 7n;
      }
      push(fields, field, Number(value));
    } else if (wire === 2) {
      let len = 0;
      let s = 0;
      for (;;) {
        const byte = buf[i++];
        if (byte === undefined) return fields;
        len |= (byte & 0x7f) << s;
        if ((byte & 0x80) === 0) break;
        s += 7;
      }
      push(fields, field, buf.subarray(i, i + len));
      i += len;
    } else if (wire === 5) {
      push(fields, field, buf.readUInt32LE(i));
      i += 4;
    } else if (wire === 1) {
      push(fields, field, buf.readBigUInt64LE(i));
      i += 8;
    } else {
      return fields;
    }
  }
  return fields;
}

function push(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function firstText(fields, field) {
  const list = fields.get(field);
  const value = list && list[0];
  return Buffer.isBuffer(value) ? value.toString("utf8") : undefined;
}

/** Connect frame: `[flags][len:4 BE][payload]`; flags 1/3 mean gzip. */
export function connectFrame(payload, { gzip, gzipSync } = {}) {
  let body = payload;
  let flags = 0;
  if (gzip && gzipSync) {
    body = gzipSync(payload);
    flags = 1;
  }
  const header = Buffer.alloc(5);
  header[0] = flags;
  header.writeUInt32BE(body.length, 1);
  return Buffer.concat([header, body]);
}

/** Splits a Connect stream buffer into `{flags, payload}` frames (partial tail kept). */
export function splitFrames(buffer) {
  const frames = [];
  let rest = buffer;
  while (rest.length >= 5) {
    const flags = rest[0];
    const len = rest.readUInt32BE(1);
    if (rest.length < 5 + len) break;
    frames.push({ flags, payload: rest.subarray(5, 5 + len) });
    rest = rest.subarray(5 + len);
  }
  return { frames, rest };
}
