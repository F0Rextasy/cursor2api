// Cursor wire identity: machine id, `x-cursor-checksum`, `x-client-key`.
//
// Recovered from the reverse-engineered client (see proxy-lab/out/.cursor2api/
// cxproxy/cursor_proper_protobuf.py `generate_cursor_checksum`): the timestamp
// (ms/1e6, 6 bytes big-endian) is obfuscated with a rolling XOR/add key seeded
// at 165, then base64url-encoded without padding and suffixed with the machine
// id. The server only checks that the checksum was produced by a plausible
// client, so a stable fabricated machine id is enough for a bridge.

import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64urlNoPad(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += ALPHABET[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) out += ALPHABET[c & 63];
  }
  return out;
}

/** Stable 64-hex machine id derived from the account's access token. */
export function machineIdFor(seed) {
  return crypto.createHash("sha256").update(`cursor2api:${seed}`).digest("hex");
}

/** `x-cursor-checksum`: obfuscated kilosecond timestamp + machine id. */
export function cursorChecksum(machineId, now = Date.now()) {
  const timestamp = Math.floor(now / 1e6);
  const bytes = Buffer.alloc(6);
  bytes.writeUIntBE(timestamp % 2 ** 48, 0, 6);
  let t = 165;
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = ((bytes[i] ^ t) + (i % 256)) & 0xff;
    t = bytes[i];
  }
  return `${base64urlNoPad(bytes)}${machineId}`;
}

/** `x-client-key`: the IDE sends a random-ish per-install key; a stable one wins. */
export function clientKeyFor(machineId) {
  return crypto.createHash("sha256").update(`client-key:${machineId}`).digest("hex");
}

export { base64urlNoPad };
