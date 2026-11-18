/**
 * Script Sinkronisasi Data Lokal ke Firebase Cloud Firestore
 * Jalankan dengan: node scripts/sync_firebase.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { firebaseConfig } = require('../src/config/firebase');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

async function syncToFirebase() {
  console.log('=======================================================');
  console.log('🚀 Memulai Sinkronisasi Data ke Firebase Cloud Firestore');
  console.log(`📡 Project ID: ${firebaseConfig.projectId}`);
  console.log('=======================================================');

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const firestore = firebase.firestore();

  const localFile = path.resolve(__dirname, '../data/firestore_local.json');
  if (!fs.existsSync(localFile)) {
    console.error('❌ File data/firestore_local.json tidak ditemukan.');
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(localFile, 'utf8') || '{}');
  const collections = Object.keys(localData);

  let totalUploaded = 0;

  for (const colName of collections) {
    const docs = localData[colName] || {};
    const docIds = Object.keys(docs);
    console.log(`\n📂 Memproses koleksi '${colName}' (${docIds.length} dokumen)...`);

    for (const id of docIds) {
      const data = docs[id];
      try {
        await firestore.collection(colName).doc(id).set(data, { merge: true });
        console.log(`  ✅ Dokumen '${id}' berhasil disinkron ke cloud.`);
        totalUploaded++;
      } catch (err) {
        console.error(`  ❌ Gagal mengunggah dokumen '${id}':`, err.message);
        if (err.code === 'permission-denied') {
          console.error('\n⚠️ AKSES DITOLAK (permission-denied)!');
          console.error('Harap buka Firebase Console -> Firestore Database -> Rules');
          console.error('Dan perbarui aturannya menjadi:');
          console.error(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
          `);
          console.error('Setelah aturan disimpan di Firebase Console, jalankan script ini kembali.');
          process.exit(1);
        }
      }
    }
  }

  console.log('\n=======================================================');
  console.log(`🎉 Selesai! Sebanyak ${totalUploaded} dokumen berhasil disinkronkan ke Firebase Cloud.`);
  console.log('=======================================================');
  process.exit(0);
}

syncToFirebase().catch(err => {
  console.error('Terjadi error:', err);
  process.exit(1);
});

