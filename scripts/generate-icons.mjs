#!/usr/bin/env node
// Writes lib/icon-names.json, lib/icon-sheet.json and public/lucide/ from the Wax runtime. Without the runtime it keeps the committed copies.
import crypto from 'node:crypto';
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
const SHEET_OUT = path.join(DOCS, 'lib', 'icon-sheet.json');
const PUBLIC_OUT = path.join(DOCS, 'public', 'lucide');
// The sheet has 40 icons per row, each 32 pixels square.
const COLUMNS = 40;
const CELL = 32;

function fail(message) {
  console.error(`[generate-icons] ${message}`);
  process.exit(1);
}

if (![LIST, SHEET, LICENSE].every((file) => fs.existsSync(file))) {
  const kept = fs.existsSync(SHEET_OUT) ? JSON.parse(fs.readFileSync(SHEET_OUT, 'utf8')).sheet : '';
  if (!kept || !fs.existsSync(path.join(PUBLIC_OUT, kept))) fail(`lib/icon-sheet.json names "${kept}", and public/lucide has no such file.`);
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

// The page places each icon by its number in the list, so the list and the sheet belong together. The sheet's name
// holds a hash of both: a browser that kept an older sheet asks for this one by another name.
const data = { columns: COLUMNS, cell: CELL, width, height, names };
const namesText = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
const stamp = crypto.createHash('sha256').update(namesText).update(sheet).digest('hex').slice(0, 12);
const sheetName = `sheet32.${stamp}.png`;
const before = fs.existsSync(SHEET_OUT) ? JSON.parse(fs.readFileSync(SHEET_OUT, 'utf8')).sheet : '';
const written = [
  put(NAMES_OUT, namesText) && 'lib/icon-names.json',
  put(SHEET_OUT, Buffer.from(`${JSON.stringify({ sheet: sheetName })}\n`)) && 'lib/icon-sheet.json',
  put(path.join(PUBLIC_OUT, sheetName), sheet) && `public/lucide/${sheetName}`,
  put(path.join(PUBLIC_OUT, 'LICENSE.txt'), fs.readFileSync(LICENSE)) && 'public/lucide/LICENSE.txt',
].filter(Boolean);
// The sheet of the build before stays for pages that are still open, and so does sheet32.png, which pages
// published before the sheets had such names ask for. Older ones go.
for (const name of fs.readdirSync(PUBLIC_OUT)) {
  if (/^sheet32\.[0-9a-f]{12}\.png$/.test(name) && name !== sheetName && name !== before) fs.rmSync(path.join(PUBLIC_OUT, name));
}

console.log(`[generate-icons] ${names.length} icons on a ${width}x${height} sheet. ${written.length ? `Wrote ${written.join(', ')}.` : 'Nothing changed.'}`);
