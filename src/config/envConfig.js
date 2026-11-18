/**
 * Konfigurasi Terpusat Sistem BAPAS Medan
 * Menyimpan seluruh API Key, Firebase, Cloudinary & Pengaturan Sistem
 * langsung di dalam kode agar siap berjalan di Netlify tanpa perlu file .env terpisah.
 */

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  SESSION_SECRET: process.env.SESSION_SECRET || 'bapas_medan_secret_key_2026_super_secure',

  // Konfigurasi Firebase Project bapasmedan-173dd
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyADYXlJ9raZ1hNERRhHz7oAOYz3HbgLcac',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'bapasmedan-173dd.firebaseapp.com',
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://bapasmedan-173dd-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: process.env.FIREBASE_PROJECT_ID || 'bapasmedan-173dd',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'bapasmedan-173dd.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '935746123338',
    appId: process.env.FIREBASE_APP_ID || '1:935746123338:web:cae4391f8a8352eca8d8b3',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-ZFRJSECLQ8'
  },

  // Konfigurasi Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'Root',
    apiKey: process.env.CLOUDINARY_API_KEY || '314147995126986',
    apiSecret: process.env.CLOUDINARY_API_SECRET || 's973tydm6PUqzMsBsT_S5sb6VR8'
  }
};
