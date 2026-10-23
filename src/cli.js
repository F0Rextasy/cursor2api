#!/usr/bin/env node

// Standard CLI entry point: the same commands as the installed `cursor2api`
// binary, so a plain checkout can run `node src/cli.js serve` too.
//
// One command builds credentials — `node src/cli.js mint --count 5 [--pool proxies.txt]
// [--api-keys api-keys.txt] [--model auto]`, or `node src/cli.js --auto --count 5`.
// `--dry` prints the plan and writes nothing (no network, no files, no dirs).
import '../bin/cursor2api.js';
