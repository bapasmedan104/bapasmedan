const serverless = require('serverless-http');
const app = require('../../server');

// Handler untuk Netlify Serverless Functions
module.exports.handler = serverless(app);
