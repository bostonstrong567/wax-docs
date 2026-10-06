#!/usr/bin/env node
// Checks the built site in out/: every internal link, image, script and stylesheet must exist,
// and every #anchor must be an id on the page it points at. Exits 1 when something is broken.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
const base = (process.env.DOCS_BASE_PATH ?? '/wax-docs').replace(/\/+$/, '');

if (!fs.existsSync(OUT)) {
  console.error('out/ does not exist. Run "npm run build" first.');
  process.exit(1);
}

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

const decode = (text) => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const idsOf = new Map();
function ids(file) {
  if (!idsOf.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    idsOf.set(file, new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((match) => decode(match[1]))));
  }
  return idsOf.get(file);
}

// The file a site path is served from, or null.
function fileFor(sitePath) {
  const target = path.join(OUT, sitePath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  const index = path.join(target, 'index.html');
  if (fs.existsSync(index)) return index;
  if (fs.existsSync(`${target}.html`)) return `${target}.html`;
  return null;
}

const problems = [];
let checked = 0;
const pages = walk(OUT);

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const shown = path.relative(OUT, page).split(path.sep).join('/');
  const pageUrl = `${base}/${shown.replace(/index\.html$/, '')}`;
  const references = [
    ...[...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((match) => ({ kind: 'link', url: match[1] })),
    ...[...html.matchAll(/<img\b[^>]*>/g)].map((match) => ({
      kind: 'image',
      url: /\ssrc="([^"]*)"/.exec(match[0])?.[1] ?? '',
      alt: /\salt="([^"]*)"/.exec(match[0])?.[1] ?? '',
    })),
    ...[...html.matchAll(/<script\b[^>]*?\ssrc="([^"]*)"/g)].map((match) => ({ kind: 'script', url: match[1] })),
    ...[...html.matchAll(/<link\b[^>]*?\shref="([^"]*)"/g)].map((match) => ({ kind: 'asset', url: match[1] })),
  ];
  for (const reference of references) {
    const raw = decode(reference.url);
    if (/^(https?:|mailto:|data:|tel:)/.test(raw) || raw === '') continue;
    checked++;
    const url = new URL(raw, `http://site${pageUrl}`);
    const pathname = decodeURIComponent(url.pathname);
    if (base && !(pathname === base || pathname.startsWith(`${base}/`))) {
      problems.push(`${shown}: ${reference.kind} ${raw} leaves the ${base} prefix`);
      continue;
    }
    const file = fileFor(pathname.slice(base.length));
    if (!file) {
      problems.push(`${shown}: ${reference.kind} ${raw} points at nothing`);
      continue;
    }
    if (reference.kind === 'link' && url.hash.length > 1 && file.endsWith('.html')) {
      const anchor = decodeURIComponent(url.hash.slice(1));
      if (!ids(file).has(anchor)) problems.push(`${shown}: link ${raw} has no #${anchor} on the page it points at`);
    }
    if (reference.kind === 'image' && reference.alt.trim() === '') problems.push(`${shown}: image ${raw} has no alt text`);
  }
}

console.log(`[check-links] ${pages.length} pages, ${checked} internal references checked under "${base || '/'}".`);
if (problems.length) {
  console.error(`[check-links] ${problems.length} problem(s):`);
  for (const problem of [...new Set(problems)]) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('[check-links] No broken links, missing files or missing anchors.');
