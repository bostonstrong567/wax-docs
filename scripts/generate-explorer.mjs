#!/usr/bin/env node
// Copies the index of the game's classes into public/explorer-data/<stamp>/ for the Explorer page, and writes two
// lists the page needs beside it: tree.json (each type's parent) and members.json (member names, by kind).
// The stamp is a hash of the data. It is written to lib/explorer-stamp.json, which the page is built with, so a
// page only ever asks for the data it was built for: other data is another folder.
// The index is made by `python scripts\gameindex.py site` in the Wax workspace. Without it the committed copy is
// kept, after a check that it still is what its stamp says.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, '..');
const SOURCE = process.env.GAME_INDEX_DIR
  ? path.resolve(process.env.GAME_INDEX_DIR)
  : path.resolve(DOCS, '..', 'build', 'game-index', 'site');
const OUT = path.join(DOCS, 'public', 'explorer-data');
const STAMP_FILE = path.join(DOCS, 'lib', 'explorer-stamp.json');
// Which data folders the site still has, newest first. The page reads it only to tell why its own data is gone.
const BUILDS_FILE = path.join(OUT, 'builds.json');
// The data of this many builds stays on the site, so a page that was opened before a publish goes on working.
const KEEP = 2;
// Until 2026-10 the data had no stamp and lay in the folder itself. Pages published then still ask for these.
// They are left as they are, and removed once two stamped builds exist.
const UNSTAMPED = ['search.json', 'tree.json', 'members.json', 'chunks'];
const FORMAT = 1;
const KINDS = { class: 'c', struct: 's', enum: 'e' };
const BUILT_IN = new Set(['integer', 'number', 'boolean', 'string', 'table', 'any', 'nil', 'delegate', 'WaxInstance']);
const LUA_KEYWORDS = new Set(
  'and break do else elseif end false for function goto if in local nil not or repeat return then true until while'.split(' '),
);

function fail(message) {
  console.error(`[generate-explorer] ${message}`);
  process.exit(1);
}

const isStamp = (name) => /^[0-9a-f]{16}$/.test(name);
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

// The stamp of a set of files: a hash of every name and content, in name order.
function stampOf(files) {
  const hash = crypto.createHash('sha256');
  for (const name of [...files.keys()].sort()) {
    const content = files.get(name);
    hash.update(`${name}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest('hex').slice(0, 16);
}

function filesUnder(dir, prefix = '', found = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`, found);
    else found.set(`${prefix}${entry.name}`, fs.readFileSync(path.join(dir, entry.name)));
  }
  return found;
}

if (!['manifest.json', 'search.json'].every((name) => fs.existsSync(path.join(SOURCE, name)))) {
  // No index here (the repository the site is published from has none): the committed data is used as it is.
  const stamp = readJson(STAMP_FILE)?.stamp;
  const folder = path.join(OUT, String(stamp));
  if (!isStamp(String(stamp)) || !fs.existsSync(path.join(folder, 'search.json'))) {
    fail(`lib/explorer-stamp.json names the data "${stamp}", and public/explorer-data has no such folder.`);
  }
  const found = stampOf(filesUnder(folder));
  if (found !== stamp) fail(`public/explorer-data/${stamp} is not the data its name says (its content gives ${found}). Run the generator where the game index is.`);
  console.log(`[generate-explorer] ${path.relative(DOCS, SOURCE)} has no game index: keeping the data that is already here (${stamp}).`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE, 'manifest.json'), 'utf8'));
if (manifest.format !== FORMAT) fail(`the index is format ${manifest.format}, and this script reads format ${FORMAT}.`);
const searchText = fs.readFileSync(path.join(SOURCE, 'search.json'));
const search = JSON.parse(searchText);
if (search.chunks.length !== manifest.chunks.length) fail('search.json and manifest.json list different chunks.');

const outputs = new Map([['search.json', searchText]]);
const types = [];
manifest.chunks.forEach((chunk, number) => {
  if (chunk.id !== search.chunks[number] || /[\\/]/.test(chunk.id)) fail(`chunk ${number} is "${chunk.id}", which is not what search.json lists.`);
  const text = fs.readFileSync(path.join(SOURCE, 'chunks', `${chunk.id}.json`));
  outputs.set(`chunks/${chunk.id}.json`, text);
  for (const type of JSON.parse(text).types) types.push(type);
});
if (types.length !== search.types.length) fail(`the chunks hold ${types.length} types and search.json lists ${search.types.length}.`);
types.forEach((type, index) => {
  const [name, , kind] = search.types[index];
  if (type.name !== name || KINDS[type.kind] !== kind) fail(`type ${index} is ${type.name} in its chunk and ${name} in search.json.`);
  if (type.name.includes('.')) fail(`${type.name} has a dot in its name, which the page's addresses cannot hold.`);
});

// The name a type goes by where another type mentions it: letters, digits and underscores only.
function identifier(name) {
  const text = name.replace(/[^0-9A-Za-z_]/g, '_');
  return text === '' || /^\d/.test(text) || LUA_KEYWORDS.has(text) ? `_${text}` : text;
}
const isNative = (type) => type.from.startsWith('/Script/');
function folders(type) {
  const parts = type.from.slice(0, type.from.lastIndexOf('.')).split('/').filter(Boolean).map(identifier);
  return isNative(type) ? parts.slice(1) : parts.slice(0, -1);
}

// Two types may share a name. The first keeps it; the others are told apart by their folder, as the editor does.
const order = ['class', 'struct', 'enum'];
const named = new Map();
types.forEach((type, index) => {
  const base = identifier(type.name);
  named.set(base, [...(named.get(base) ?? []), index]);
});
const keys = {};
const aliases = {};
const taken = new Set(named.keys());
for (const [base, indexes] of named) {
  indexes.sort((a, b) => {
    const [x, y] = [types[a], types[b]];
    return order.indexOf(x.kind) - order.indexOf(y.kind) || Number(isNative(y)) - Number(isNative(x)) || (x.from < y.from ? -1 : 1);
  });
  if (base !== types[indexes[0]].name) aliases[base] = indexes[0];
  for (const index of indexes.slice(1)) {
    const parts = folders(types[index]);
    let key = base;
    for (let depth = 1; taken.has(key); depth++) key = depth <= parts.length ? `${base}__${parts.slice(-depth).join('_')}` : `${base}__${depth}`;
    taken.add(key);
    keys[index] = key;
    aliases[key] = index;
  }
}
const lookup = (name) => (named.has(name) ? named.get(name)[0] : aliases[name]);

// A parent is given by its bare name. It is looked for among types of the same kind.
const parents = types.map((type) => {
  if (!type.parent) return -1;
  const found = (named.get(identifier(type.parent)) ?? []).filter((index) => types[index].kind === type.kind && types[index].name === type.parent);
  if (found.length === 0) fail(`${type.name} names ${type.parent} as its parent, and the index has no such ${type.kind}.`);
  return found[0];
});

// Member names for the search box: properties, functions, and delegates (the game's own events).
const members = { p: {}, f: {}, e: {} };
const unknown = new Map();
const add = (group, name, index) => (members[group][name] ??= []).push(index);
function mentioned(text) {
  for (const [word] of text.replace(/\w+\??:/g, '').matchAll(/[A-Za-z_]\w*/g)) {
    if (!BUILT_IN.has(word) && lookup(word) === undefined) unknown.set(word, (unknown.get(word) ?? 0) + 1);
  }
}
types.forEach((type, index) => {
  for (const [name, text] of type.props ?? []) {
    add(text.startsWith('delegate(') ? 'e' : 'p', name, index);
    mentioned(text);
  }
  for (const [name, params, returns] of type.funcs ?? []) {
    add('f', name, index);
    for (const [, text] of params) mentioned(text);
    if (returns) mentioned(returns);
  }
});
const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const count = (group) => Object.values(members[group]).reduce((sum, list) => sum + list.length, 0);

outputs.set(
  'tree.json',
  Buffer.from(
    `${JSON.stringify({
      format: FORMAT,
      taken: manifest.source?.written ?? '',
      counts: { ...manifest.counts, properties: count('p'), functions: count('f'), events: count('e') },
      parents,
      keys,
      aliases: sorted(aliases),
    })}\n`,
  ),
);
outputs.set('members.json', Buffer.from(`${JSON.stringify({ p: sorted(members.p), f: sorted(members.f), e: sorted(members.e) })}\n`));

// The data goes into a folder named after its content. A file is only written when it changes.
const stamp = stampOf(outputs);
const folder = path.join(OUT, stamp);
let written = 0;
function put(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(content)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  written++;
}
for (const [name, content] of outputs) put(path.join(folder, name), content);
let removed = 0;
function drop(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true });
  removed++;
}
for (const name of filesUnder(folder).keys()) if (!outputs.has(name)) drop(path.join(folder, name));

// The newest builds stay, in the order they were made. Older folders go, and with them the data without a stamp.
const before = (readJson(BUILDS_FILE)?.kept ?? []).filter((name) => isStamp(name) && name !== stamp && fs.existsSync(path.join(OUT, name)));
const kept = [stamp, ...before].slice(0, KEEP);
for (const entry of fs.readdirSync(OUT, { withFileTypes: true })) {
  if (entry.isDirectory() && isStamp(entry.name) && !kept.includes(entry.name)) drop(path.join(OUT, entry.name));
}
if (kept.length >= KEEP) for (const name of UNSTAMPED) drop(path.join(OUT, name));
put(BUILDS_FILE, Buffer.from(`${JSON.stringify({ current: stamp, kept })}\n`));
put(STAMP_FILE, Buffer.from(`${JSON.stringify({ stamp })}\n`));

const size = (pick) => [...outputs].filter(([name]) => pick(name)).reduce((sum, [, content]) => sum + content.length, 0);
const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString('en-US')} KB`;
console.log(
  `[generate-explorer] ${types.length} types in ${manifest.chunks.length} chunks (${kb(size((name) => name.startsWith('chunks/')))}), ` +
    `search.json ${kb(size((name) => name === 'search.json'))}, tree.json ${kb(size((name) => name === 'tree.json'))}, ` +
    `members.json ${kb(size((name) => name === 'members.json'))}. Data ${stamp}: ${written} file(s) changed${removed ? `, ${removed} removed` : ''}.`,
);
if (unknown.size) {
  const list = [...unknown].map(([name, times]) => `${name} (${times})`).join(', ');
  console.log(`[generate-explorer] ${unknown.size} type name(s) are mentioned and are not in the index, so the page cannot link them: ${list}`);
}
