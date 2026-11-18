const serverless = require('serverless-http');
const app = require('../../server');

// Handler untuk Netlify Serverless Functions (mendukung respon binary gambar & media)
module.exports.handler = serverless(app, {
  binary: ['image/*', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream']
});
