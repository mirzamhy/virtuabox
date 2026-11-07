// Photo sharing for Virtua Box: the booth uploads the finished strip, and guests open it
// on their phone by scanning a QR code.
//
// Runs two ways:
//  - inside the Vite dev/preview server (vite.config.ts), for demos on a laptop;
//  - on its own with `node server/share.mjs` behind nginx on the VPS (see deploy/).
//
// Environment:
//   SHARE_DIR       where photos are stored (default ./shares)
//   SHARE_TTL_DAYS  photos older than this are deleted (default 7)
//   SHARE_BASE_URL  fixed base for QR links, e.g. https://photo.mirz.app (optional)
//   SHARE_HOST      LAN address to use for laptop demos (optional)
//   PORT            port for the standalone server (default 8790, listens on 127.0.0.1)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 25 * 1024 * 1024;
const ID = /^[a-z0-9]{10}$/;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const DIR = path.resolve(process.env.SHARE_DIR || 'shares');
const TTL_MS = Number(process.env.SHARE_TTL_DAYS || 7) * 24 * 3600 * 1000;

// Simple per-address limit so the endpoint can't be used as free image hosting.
const LIMIT = 40;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function allowed(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= LIMIT) return false;
  list.push(now);
  hits.set(ip, list);
  return true;
}

function cleanup() {
  if (!fs.existsSync(DIR)) return;
  const now = Date.now();
  for (const f of fs.readdirSync(DIR)) {
    const file = path.join(DIR, f);
    try {
      if (now - fs.statSync(file).mtimeMs > TTL_MS) fs.unlinkSync(file);
    } catch {
      /* already gone */
    }
  }
  for (const [ip, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(ip);
}

/** LAN address phones should use when the booth runs on a laptop. Prefers the Windows
 *  hotspot (192.168.137.1), then Wi-Fi, and skips virtual adapters. */
function lanHost() {
  if (process.env.SHARE_HOST) return process.env.SHARE_HOST;
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) found.push({ name, address: a.address });
  }
  const real = found.filter((f) => !/vethernet|virtualbox|vmware|wsl|docker|hyper-v|tailscale|zerotier/i.test(f.name));
  const hotspot = real.find((f) => f.address === '192.168.137.1');
  const wifi = real.find((f) => /wi-?fi|wlan|wireless/i.test(f.name));
  return (hotspot || wifi || real[0] || found[0])?.address || 'localhost';
}

/** Base URL for the QR link: the site's own domain when deployed, the laptop's LAN
 *  address when the booth is opened on localhost. */
function baseUrl(req) {
  if (process.env.SHARE_BASE_URL) return process.env.SHARE_BASE_URL.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (!host || LOCAL.test(host)) {
    const port = /:(\d+)$/.exec(host)?.[1];
    return `http://${lanHost()}${port ? `:${port}` : ''}`;
  }
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

function page(id) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Foto Virtua Box</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; background: #17110f; color: #f4ece4; font: 16px/1.5 system-ui, sans-serif;
         display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px 16px 40px; box-sizing: border-box; }
  h1 { font-size: 18px; letter-spacing: .12em; text-transform: uppercase; margin: 0; }
  img { max-width: min(100%, 520px); max-height: 70vh; border-radius: 4px; box-shadow: 0 10px 40px #0008; }
  a { background: #e2b04a; color: #1a1208; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 999px; }
  p { margin: 0; opacity: .7; font-size: 14px; text-align: center; max-width: 360px; }
</style>
</head>
<body>
  <h1>Virtua Box</h1>
  <img src="/s/${id}.png" alt="Strip foto kamu">
  <a href="/s/${id}.png" download="virtua-box-${id}.png">Unduh foto</a>
  <p>Kalau tombol tidak jalan, tekan lama fotonya lalu pilih simpan gambar.</p>
  <p>Foto ini dihapus otomatis setelah beberapa hari.</p>
</body>
</html>`;
}

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(body);
}

/** Connect-style middleware: handles POST /api/share and GET /s/<id>[.png], else next(). */
export function shareHandler() {
  cleanup();
  setInterval(cleanup, 3600 * 1000).unref();

  return (req, res, next) => {
    const url = (req.url || '').split('?')[0];

    if (req.method === 'POST' && url === '/api/share') {
      const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
      if (!allowed(ip)) return send(res, 429, 'text/plain; charset=utf-8', 'Terlalu banyak unggahan, coba lagi nanti.');
      const chunks = [];
      let size = 0;
      let tooBig = false;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) tooBig = true;
        else chunks.push(c);
      });
      req.on('end', () => {
        if (tooBig) return send(res, 413, 'text/plain; charset=utf-8', 'Foto terlalu besar.');
        const body = Buffer.concat(chunks);
        // Only PNG files are accepted.
        if (body.length < 8 || body.readUInt32BE(0) !== 0x89504e47) return send(res, 400, 'text/plain; charset=utf-8', 'Bukan PNG.');
        fs.mkdirSync(DIR, { recursive: true });
        const id = Array.from(crypto.randomBytes(10), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
        fs.writeFileSync(path.join(DIR, `${id}.png`), body);
        send(res, 200, 'application/json', JSON.stringify({ id, url: `${baseUrl(req)}/s/${id}` }));
      });
      return;
    }

    const m = /^\/s\/([a-z0-9]+)(\.png)?$/.exec(url);
    if ((req.method === 'GET' || req.method === 'HEAD') && m && ID.test(m[1])) {
      const file = path.join(DIR, `${m[1]}.png`);
      if (!fs.existsSync(file)) return send(res, 404, 'text/plain; charset=utf-8', 'Foto tidak ditemukan atau sudah dihapus.');
      res.setHeader('X-Robots-Tag', 'noindex');
      if (m[2]) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        fs.createReadStream(file).pipe(res);
      } else {
        send(res, 200, 'text/html; charset=utf-8', page(m[1]));
      }
      return;
    }
    next();
  };
}

/** Vite plugin: adds the share routes to `vite` and `vite preview`. */
export function shareServer() {
  return {
    name: 'virtuabox-share',
    configureServer(server) {
      server.middlewares.use(shareHandler());
    },
    configurePreviewServer(server) {
      server.middlewares.use(shareHandler());
    },
  };
}

// Standalone mode: `node server/share.mjs` (used on the VPS behind nginx).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8790);
  const handle = shareHandler();
  http
    .createServer((req, res) => handle(req, res, () => send(res, 404, 'text/plain; charset=utf-8', 'Not found')))
    .listen(port, '127.0.0.1', () => console.log(`virtuabox share server on 127.0.0.1:${port}, photos in ${DIR}`));
}
