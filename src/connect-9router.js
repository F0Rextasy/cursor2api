#!/usr/bin/env node

/**
 * Connect this bridge to a 9Router instance.
 *
 * cursor2api is already an OpenAI-compatible server, so "connecting" it means
 * creating a provider node on 9Router whose base URL is the bridge's local /v1
 * endpoint, plus one provider connection carrying the bridge's bearer key (any
 * non-empty value when the bridge was started without `--key`).
 *
 *   node src/connect-9router.js --9router-base http://localhost:20128 --9router-password 123456
 *   node src/connect-9router.js --api-key <bearer> --base-url http://127.0.0.1:8795/v1
 *
 * No dependencies: it talks to 9Router's admin API with the built-in fetch.
 */

import { pathToFileURL } from 'node:url';

const UA = 'cursor2api-9router-connector/1.0';

const DEFAULTS = {
  base: 'http://localhost:20128',
  password: '123456',
  name: 'Cursor (bridge)',
  prefix: 'cursor2api',
  baseUrl: 'http://127.0.0.1:8795/v1',
  apiKey: 'cursor2api',
};

async function login(base, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ password: password ?? DEFAULTS.password }),
  });
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  return { ok: res.ok, cookie, body: (await res.text()).slice(0, 200) };
}

async function api(base, cookie, route, init = {}) {
  const res = await fetch(`${base}${route}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* a non-JSON answer is reported as text */
  }
  return { status: res.status, ok: res.ok, json, text: text.slice(0, 400) };
}

async function ensureNode(base, cookie, { name, prefix, baseUrl }) {
  const list = await api(base, cookie, '/api/provider-nodes');
  const nodes = (list.json && list.json.nodes) || [];
  const existing = nodes.find((n) => n.prefix === prefix || n.name === name);
  if (existing) {
    console.log(`provider-node exists: ${existing.id} (prefix ${existing.prefix} · baseUrl ${existing.baseUrl || baseUrl})`);
    return existing;
  }
  const created = await api(base, cookie, '/api/provider-nodes', {
    method: 'POST',
    body: JSON.stringify({ name, prefix, apiType: 'chat', type: 'openai-compatible', baseUrl }),
  });
  if (!created.ok) throw new Error(`create node failed ${created.status}: ${created.text}`);
  console.log(`provider-node created: ${created.json.node.id}`);
  return created.json.node;
}

async function ensureConnection(base, cookie, { nodeId, name, apiKey }) {
  const list = await api(base, cookie, '/api/providers');
  const connections = (list.json && list.json.connections) || [];
  const existing = connections.find((c) => c.name === name);
  if (existing) {
    console.log(`connection exists: ${existing.id} (${existing.name})`);
    return existing;
  }
  const created = await api(base, cookie, '/api/providers', {
    method: 'POST',
    body: JSON.stringify({ provider: nodeId, apiKey, name, priority: 1 }),
  });
  if (!created.ok && created.status !== 409) throw new Error(`create connection failed ${created.status}: ${created.text}`);
  console.log(`connection created: ${(created.json && created.json.connection && created.json.connection.id) || '(conflict)'}`);
  return created.json && created.json.connection;
}

/**
 * Register the bridge with 9Router. `apiKey` is the bridge's bearer token, or
 * any non-empty placeholder when the bridge runs without `--key`.
 */
export async function connect9Router({
  base = DEFAULTS.base,
  password = DEFAULTS.password,
  apiKey = DEFAULTS.apiKey,
  name = DEFAULTS.name,
  prefix = DEFAULTS.prefix,
  baseUrl = DEFAULTS.baseUrl,
} = {}) {
  const url = String(base).replace(/\/+$/, '');
  const { ok, cookie, body } = await login(url, password);
  console.log(`9Router login: ${ok ? 'ok' : 'not required/failed'} ${ok ? '' : body}`);
  const node = await ensureNode(url, cookie, { name, prefix, baseUrl });
  const connection = await ensureConnection(url, cookie, { nodeId: node.id, name: `${prefix}-local`, apiKey: apiKey || 'local' });
  console.log(`\nDone — 9Router lists the bridge's models as ${prefix}/<model id>, straight from ${baseUrl}/models.`);
  return connection;
}

function parseArgs(argv = process.argv.slice(2)) {
  const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };
  return {
    base: arg('9router-base', arg('base')),
    password: arg('9router-password', arg('password')),
    apiKey: arg('api-key'),
    name: arg('name'),
    prefix: arg('prefix'),
    baseUrl: arg('base-url'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      'usage: node src/connect-9router.js --9router-base <url> --9router-password <pw> ' +
        '[--api-key <bearer>] [--base-url http://127.0.0.1:8795/v1] [--prefix cursor2api] [--name "Cursor (bridge)"]'
    );
    process.exit(0);
  }
  connect9Router(parseArgs(argv)).catch((e) => {
    console.error('[fatal] ' + e.message);
    process.exit(1);
  });
}
