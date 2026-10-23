#!/usr/bin/env node

/**
 * Interactive launcher for cursor2api.
 *
 * Start the bridge, sign in, or register the running bridge with a local router
 * without remembering flags: the answers are kept in `launcher.config.json`.
 *
 * Usage: node src/launcher.js            (menu)
 *        node src/launcher.js --help
 *        node src/launcher.js --connect-9router
node src/launcher.js --connect-omniroute
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'launcher.config.json');
const BIN = path.join(ROOT, 'bin', 'cursor2api.js');

const defaults = {
  port: 8795,
  routerBase: 'http://localhost:20128',
  routerPassword: '123456',
  baseUrl: 'http://127.0.0.1:8795/v1',
  count: 5,
  poolFile: process.env.CURSOR2API_PROXIES || 'proxies.txt',
};

function loadConfig() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  } catch (e) {
    console.error(`  ! could not write ${path.basename(CONFIG)}: ${e.message}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question, fallback) => {
  const hint = fallback ? ` [${String(fallback).slice(0, 40)}]` : '';
  const answer = (await rl.question(`  ${question}${hint}: `)).trim();
  return answer || fallback || '';
};

function run(args, env = {}) {
  console.log('');
  const res = spawnSync(process.execPath, [BIN, ...args], {
    windowsHide: true,
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) console.log(`  ! exited with code ${res.status}`);
}

function banner() {
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  console.log(`\n  ${bold}cursor2api${reset}  ${dim}— a Cursor account as a local OpenAI-compatible API${reset}\n`);
}

async function serveFlow(cfg) {
  cfg.port = parseInt(await ask('Listen port for the bridge', cfg.port), 10) || cfg.port;
  cfg.baseUrl = await ask('Bridge /v1 base URL (as the router will reach it)', cfg.baseUrl);
  saveConfig(cfg);
  run(['serve', '--port', String(cfg.port)]);
}

async function loginFlow() {
  const apiKey = await ask('Cursor API key (leave empty for browser approval)');
  if (apiKey) run(['apikey', apiKey]);
  else run(['login']);
}

async function mintFlow(cfg) {
  cfg.count = parseInt(await ask('How many keys do you want (any number)', cfg.count), 10) || cfg.count;
  cfg.poolFile = await ask('Proxy list file (one proxy per line)', cfg.poolFile);
  saveConfig(cfg);
  run(['mint', '--auto', '--count', String(cfg.count), '--pool', cfg.poolFile]);
}

async function connectFlow(cfg) {
  const { connect9Router } = await import('./connect-9router.js');
  cfg.routerBase = await ask('9Router base URL', cfg.routerBase);
  cfg.routerPassword = await ask('9Router password', cfg.routerPassword);
  cfg.baseUrl = await ask('Bridge /v1 base URL (start the bridge first)', cfg.baseUrl);
  saveConfig(cfg);
  console.log('');
  await connect9Router({ base: cfg.routerBase, password: cfg.routerPassword, baseUrl: cfg.baseUrl, apiKey: 'cursor2api' });
}

async function connectFlowOmni(cfg) {
  const { connectOmniRoute } = await import('./connect-omniroute.js');
  cfg.routerBase = await ask('OmniRoute base URL', cfg.routerBase);
  cfg.routerPassword = await ask('OmniRoute password', cfg.routerPassword);
  cfg.baseUrl = await ask('Bridge /v1 base URL (start the bridge first)', cfg.baseUrl);
  saveConfig(cfg);
  console.log('');
  await connectOmniRoute({ base: cfg.routerBase, password: cfg.routerPassword, baseUrl: cfg.baseUrl, apiKey: 'cursor2api' });
}

async function main() {
  const cfg = loadConfig();
  if (process.argv.includes('--connect-9router')) {
    await connectFlow(cfg);
    rl.close();
    return;
  }

  if (process.argv.includes('--connect-omniroute')) {
    await connectFlowOmni(cfg);
    rl.close();
    return;
  }
  banner();
  console.log('  1) Start the bridge    — node bin/cursor2api.js serve');
  console.log('  2) Sign in             — browser approval or a Cursor API key');
  console.log('  3) Status              — token, plan and period usage');
  console.log('  4) Help                — CLI options and notes');
  console.log('  5) Connect to 9Router  — register this bridge with a local 9Router');
  console.log('  6) Connect to OmniRoute  — register this bridge with a local OmniRoute');
  console.log('  7) Mint keys           — bulk-convert Cursor API keys into verified credentials');
  console.log('  q) Quit\n');
  const choice = (await ask('Choose', '1')).toLowerCase();

  if (choice === '1') await serveFlow(cfg);
  else if (choice === '2') await loginFlow();
  else if (choice === '3') run(['status']);
  else if (choice === '4') run(['help']);
  else if (choice === '5') await connectFlow(cfg);
  else if (choice === '6') await connectFlowOmni(cfg);
  else if (choice === '7') await mintFlow(cfg);
  rl.close();
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Interactive launcher: run `node src/launcher.js` and pick a menu item.');
  console.log('  node src/launcher.js                       menu');
  console.log('  node src/launcher.js --connect-9router     register the bridge with a local 9Router');
  process.exit(0);
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
