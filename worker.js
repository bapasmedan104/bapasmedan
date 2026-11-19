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
    // 1. Sajikan aset statis (CSS, JS, logo) langsung dari edge cache jika tersedia
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status < 400) {
          return assetResponse;
        }
      } catch (err) {
        // Lanjutkan ke Express jika bukan aset statis
      }
    }

    // 2. Jalankan aplikasi Express Node.js secara langsung di Cloudflare
    return nodeHandler.fetch(request, env, ctx);
  }
};
