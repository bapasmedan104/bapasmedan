/**
 * Cloudflare Worker Native Node.js Server for BAPAS Kelas I Medan
 * 
 * Menjalankan aplikasi Node.js Express & Firebase Firestore secara NATIVE
 * langsung di Cloudflare Edge Network (100% mandiri tanpa Netlify).
 */

import { httpServerHandler } from 'cloudflare:node';
import app from './server.js';

// Jalankan listener server Node.js internal pada port 3000
app.listen(3000);

const nodeHandler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Sajikan aset statis HANYA jika request adalah GET/HEAD dan merupakan file statis (ekstensi file atau direktori aset)
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
        // Selalu gunakan request.clone() agar stream asli tidak terkonsumsi/aborted jika 404
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
      return await nodeHandler.fetch(request, env, ctx);
    } catch (edgeErr) {
      return new Response('Cloudflare Edge Exception:\n' + (edgeErr.stack || edgeErr.message), {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};
