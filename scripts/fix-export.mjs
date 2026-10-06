#!/usr/bin/env node
// Runs after `next build`. On Windows, Next 16 writes the small files the browser prefetches for each part of
// a page into nested folders (out/docs/x/__next.docs/$oc$slug/__PAGE__.txt), but the browser asks for them by a
// flat name (out/docs/x/__next.docs.$oc$slug.__PAGE__.txt), so every prefetch is a 404. A build on Linux
// already uses the flat names. This moves the files to where they are asked for; elsewhere it finds nothing to do.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
if (!fs.existsSync(OUT)) process.exit(0);

function filesUnder(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, found);
    else found.push(full);
  }
  return found;
}

let moved = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (!entry.name.startsWith('__next.')) {
      visit(full);
      continue;
    }
    for (const file of filesUnder(full)) {
      const flat = path.relative(dir, file).split(path.sep).join('.');
      fs.renameSync(file, path.join(dir, flat));
      moved++;
    }
    fs.rmSync(full, { recursive: true });
  }
}
visit(OUT);

if (moved) console.log(`[fix-export] moved ${moved} prefetch file(s) to the names the browser asks for.`);
