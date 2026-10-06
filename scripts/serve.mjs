#!/usr/bin/env node
// Serves out/ the way GitHub Pages serves a project site: under a path prefix, with 404.html for misses.
//   node scripts/serve.mjs [--port 4173] [--base /wax-docs]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at !== -1 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};
const port = Number(option('port', process.env.PORT ?? 4173));
const base = option('base', process.env.DOCS_BASE_PATH ?? '/wax-docs').replace(/\/+$/, '');
if (/[:\\]/.test(base)) {
  // Git Bash rewrites an argument such as /wax-docs into a Windows path.
  console.error(`"${base}" is not a URL prefix. In Git Bash, leave --base out or set DOCS_BASE_PATH instead.`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

if (!fs.existsSync(OUT)) {
  console.error('out/ does not exist. Run "npm run build" first.');
  process.exit(1);
}

function send(request, response, status, file) {
  response.writeHead(status, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': fs.statSync(file).size,
  });
  // A HEAD request gets the headers only.
  if (request.method === 'HEAD') return response.end();
  fs.createReadStream(file).pipe(response);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === base && base !== '') {
    response.writeHead(301, { Location: `${base}/` });
    return response.end();
  }
  if (base !== '' && !pathname.startsWith(`${base}/`)) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    return response.end(`Nothing is served outside ${base}/`);
  }
  pathname = pathname.slice(base.length);
  const target = path.join(OUT, pathname);
  if (!target.startsWith(OUT)) {
    response.writeHead(403);
    return response.end();
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    if (!pathname.endsWith('/')) {
      response.writeHead(301, { Location: `${base}${pathname}/${url.search}` });
      return response.end();
    }
    const index = path.join(target, 'index.html');
    if (fs.existsSync(index)) return send(request, response, 200, index);
  } else if (fs.existsSync(target)) {
    return send(request, response, 200, target);
  }
  const missing = path.join(OUT, '404.html');
  if (fs.existsSync(missing)) return send(request, response, 404, missing);
  response.writeHead(404, { 'Content-Type': 'text/plain' });
  response.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving out/ at http://localhost:${port}${base}/  (Ctrl+C to stop)`);
});
