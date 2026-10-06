#!/usr/bin/env node
// Writes lib/icon-names.json and public/lucide/ from the Wax runtime. Without the runtime it keeps the committed copies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, '..');
const RUNTIME = process.env.WAX_RUNTIME_DIR
  ? path.resolve(process.env.WAX_RUNTIME_DIR)
  : path.resolve(DOCS, '..', 'wax', 'runtime');
const LIST = path.join(RUNTIME, 'Scripts', 'wax', 'gui', 'icons_list.lua');
const LUCIDE = path.join(RUNTIME, 'assets', 'lucide');
const SHEET = path.join(LUCIDE, 'sheet32.png');
const LICENSE = path.join(LUCIDE, 'LICENSE.txt');
const NAMES_OUT = path.join(DOCS, 'lib', 'icon-names.json');
const PUBLIC_OUT = path.join(DOCS, 'public', 'lucide');
// The sheet has 40 icons per row, each 32 pixels square.
const COLUMNS = 40;
const CELL = 32;

function fail(message) {
  console.error(`[generate-icons] ${message}`);
  process.exit(1);
}

if (![LIST, SHEET, LICENSE].every((file) => fs.existsSync(file))) {
  console.log(`[generate-icons] ${path.relative(DOCS, RUNTIME)} has no icon list or sheet: keeping the copies that are already here.`);
  process.exit(0);
}

// The Lua file returns one long string of names.
const listed = /\[\[([\s\S]*?)\]\]/.exec(fs.readFileSync(LIST, 'utf8'));
const names = listed ? listed[1].split(/\s+/).filter(Boolean) : [];
if (names.length === 0) fail(`found no names in ${LIST}.`);
const odd = names.filter((name) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name));
if (odd.length) fail(`these are not icon names: ${odd.slice(0, 5).join(', ')}`);
if (new Set(names).size !== names.length) fail('a name is listed twice.');

// Width and height are in the PNG header.
const sheet = fs.readFileSync(SHEET);
if (sheet.length < 24 || sheet.toString('latin1', 1, 4) !== 'PNG') fail(`${SHEET} is not a PNG file.`);
const width = sheet.readUInt32BE(16);
const height = sheet.readUInt32BE(20);
if (width !== COLUMNS * CELL) fail(`the sheet is ${width} wide, not ${COLUMNS} icons of ${CELL} pixels.`);
if (names.length > COLUMNS * Math.floor(height / CELL)) fail(`the sheet is too small for ${names.length} icons.`);

// A file is only written when it changes, so `npm run dev` does not reload for nothing.
function put(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(content)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

const data = { columns: COLUMNS, cell: CELL, width, height, names };
const written = [
  put(NAMES_OUT, Buffer.from(`${JSON.stringify(data, null, 2)}\n`)) && 'lib/icon-names.json',
  put(path.join(PUBLIC_OUT, 'sheet32.png'), sheet) && 'public/lucide/sheet32.png',
  put(path.join(PUBLIC_OUT, 'LICENSE.txt'), fs.readFileSync(LICENSE)) && 'public/lucide/LICENSE.txt',
].filter(Boolean);

console.log(`[generate-icons] ${names.length} icons on a ${width}x${height} sheet. ${written.length ? `Wrote ${written.join(', ')}.` : 'Nothing changed.'}`);
