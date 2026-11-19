/**
 * Cloudflare Worker Native Node.js Server for BAPAS Kelas I Medan
 * 
 * Menjalankan aplikasi Node.js Express & Firebase Firestore secara NATIVE
 * langsung di Cloudflare Edge Network (100% mandiri tanpa Netlify).
 */

import http from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import app from './server.js';

// Buat HTTP server tanpa TCP port listener untuk mencegah konflik port EADDRINUSE
const server = http.createServer(app);
const nodeHandler = httpServerHandler(server);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Sajikan aset statis HANYA jika request adalah GET/HEAD dan merupakan file statis
    const isStaticAsset = (request.method === 'GET' || request.method === 'HEAD') && (
      /\.[a-zA-Z0-9]{2,5}$/.test(url.pathname) ||
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/js/') ||
      url.pathname.startsWith('/images/') ||
      url.pathname === '/favicon.ico' ||
      url.pathname === '/favicon.png' ||
      url.pathname === '/robots.txt' ||
      url.pathname === '/sitemap.xml'
    );

    if (isStaticAsset && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      try {
        const assetResponse = await env.ASSETS.fetch(request.clone());
        if (assetResponse.status < 400) {
          return assetResponse;
        }
      } catch (err) {
        // Lanjutkan ke Express jika gagal di ASSETS
      }
    }

    // 2. Jalankan aplikasi Express Node.js secara langsung di Cloudflare
    try {
      if (env) {
        for (const [k, v] of Object.entries(env)) {
          if (typeof v === 'string') process.env[k] = v;
        }
      }
      return await nodeHandler.fetch(request, env, ctx);
    } catch (edgeErr) {
      return new Response('Server Processing Error: ' + (edgeErr.stack || edgeErr.message), {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};
