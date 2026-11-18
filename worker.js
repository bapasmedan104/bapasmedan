/**
 * Cloudflare Worker Gateway for BAPAS Kelas I Medan
 * 
 * Melayani aset statis dari Cloudflare Global Edge Network
 * dan meneruskan rute dinamis (Express + EJS + Firebase) ke backend serverless.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Coba layani aset statis (CSS, JS, gambar) jika binding ASSETS tersedia
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status < 400) {
          return assetResponse;
        }
      } catch (err) {
        // Lanjutkan ke proxy jika aset tidak ditemukan
      }
    }

    // 2. Proksikan permintaan dinamis ke backend utama BAPAS Medan
    const targetUrl = new URL(url.pathname + url.search, 'https://bapasmedan.netlify.app');

    const headers = new Headers(request.headers);
    headers.set('Host', 'bapasmedan.netlify.app');
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual'
      });

      const resHeaders = new Headers(response.headers);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders
      });
    } catch (proxyErr) {
      return new Response('Gateway Error: Gagal menghubungkan ke backend BAPAS Medan. ' + proxyErr.message, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};
