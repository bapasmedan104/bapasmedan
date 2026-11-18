/**
 * Firebase Firestore Configuration & Resilient Adapter
 * Terhubung ke Firebase Cloud (bapasmedan-173dd) dengan fallback cerdas ke Local JSON
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { firebase: firebaseConfig } = require('./envConfig');

let admin = null;
let cloudDb = null;
let isCloudActive = false;

// 1. Coba inisialisasi Firebase Admin (Service Account) jika ada
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : path.resolve(process.cwd(), 'serviceAccountKey.json');

const hasEnvCredentials = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

try {
  admin = require('firebase-admin');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      cloudDb = admin.firestore();
      isCloudActive = true;
      console.log('🔥 Terhubung ke Firebase Cloud Firestore (via serviceAccountKey.json)');
    }
  } else if (hasEnvCredentials) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    }
    cloudDb = admin.firestore();
    isCloudActive = true;
    console.log('🔥 Terhubung ke Firebase Cloud Firestore (via Environment Variables)');
  }
} catch (err) {
  // Abaikan jika admin SDK gagal
}

// 2. Inisialisasi Firebase Client SDK (Firestore & Authentication)
let firebaseAuth = null;
try {
  const firebase = require('firebase/compat/app');
  require('firebase/compat/firestore');
  require('firebase/compat/auth');

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  if (!cloudDb) {
    cloudDb = firebase.firestore();
    isCloudActive = true;
    console.log(`🔥 Terhubung ke Firebase Cloud Project: ${firebaseConfig.projectId}`);
  }
  firebaseAuth = firebase.auth();
  console.log('🔐 Firebase Authentication siap digunakan untuk login');
} catch (err) {
  console.warn('⚠️ Gagal inisialisasi Firebase Web/Auth SDK:', err.message);
}

// ----------------------------------------------------
// LOCAL FIRESTORE EMULATOR / FALLBACK (SERVERLESS-SAFE)
// ----------------------------------------------------
const os = require('os');
const isServerless = Boolean(
  process.env.NETLIFY || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.env.LAMBDA_TASK_ROOT ||
  (process.env.NODE_ENV === 'production' && !process.env.LOCAL_ENV)
);

// Di lingkungan serverless (seperti Netlify Functions), filesystem /var/task adalah read-only.
// Direktori yang bisa ditulisi adalah os.tmpdir() (/tmp)
const dataDir = isServerless 
  ? path.join(os.tmpdir(), 'bapas_data')
  : path.resolve(process.cwd(), 'data');

const bundledDbFile = path.resolve(process.cwd(), 'data', 'firestore_local.json');
const localDbFile = path.join(dataDir, 'firestore_local.json');

let inMemoryDb = {
  admin: {},
  client: {},
  wajib_lapor: {},
  konfigurasi_sistem: {},
  history_log: {}
};

// Coba muat data awal dari bundled json jika tersedia
try {
  if (fs.existsSync(bundledDbFile)) {
    inMemoryDb = JSON.parse(fs.readFileSync(bundledDbFile, 'utf8') || '{}');
  }
} catch {
  // Tetap gunakan inMemoryDb default
}

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(localDbFile)) {
    if (fs.existsSync(bundledDbFile)) {
      try {
        fs.copyFileSync(bundledDbFile, localDbFile);
      } catch {
        // Abaikan jika copy gagal
      }
    } else {
      fs.writeFileSync(localDbFile, JSON.stringify(inMemoryDb, null, 2), 'utf8');
    }
  } else {
    // Jika file local sudah ada, perbarui inMemoryDb
    inMemoryDb = JSON.parse(fs.readFileSync(localDbFile, 'utf8') || '{}');
  }
} catch (fsErr) {
  console.warn('ℹ️ Sistem berjalan dalam mode serverless in-memory cache:', fsErr.message);
}

function readLocalDb() {
  try {
    if (fs.existsSync(localDbFile)) {
      const content = fs.readFileSync(localDbFile, 'utf8');
      return JSON.parse(content || '{}');
    }
  } catch {
    // Fallback ke in-memory jika file tidak terbaca
  }
  return inMemoryDb;
}

function writeLocalDb(data) {
  inMemoryDb = data;
  try {
    if (fs.existsSync(dataDir)) {
      fs.writeFileSync(localDbFile, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch {
    // Di serverless read-only, inMemoryDb menyimpan data state selama instance aktif
  }
}

class LocalDocumentRef {
  constructor(collName, docId) {
    this.collName = collName;
    this.id = docId;
  }

  async get() {
    const data = readLocalDb();
    const coll = data[this.collName] || {};
    const docData = coll[this.id];
    return {
      id: this.id,
      exists: Boolean(docData),
      data: () => (docData ? { ...docData, id: this.id } : undefined)
    };
  }

  async set(docData, options = {}) {
    const data = readLocalDb();
    if (!data[this.collName]) data[this.collName] = {};
    if (options.merge && data[this.collName][this.id]) {
      data[this.collName][this.id] = {
        ...data[this.collName][this.id],
        ...docData,
        id: this.id
      };
    } else {
      data[this.collName][this.id] = { ...docData, id: this.id };
    }
    writeLocalDb(data);
    return { id: this.id };
  }

  async update(docData) {
    const data = readLocalDb();
    if (!data[this.collName] || !data[this.collName][this.id]) {
      throw new Error(`Dokumen ${this.collName}/${this.id} tidak ditemukan.`);
    }
    data[this.collName][this.id] = {
      ...data[this.collName][this.id],
      ...docData,
      id: this.id
    };
    writeLocalDb(data);
    return { id: this.id };
  }

  async delete() {
    const data = readLocalDb();
    if (data[this.collName] && data[this.collName][this.id]) {
      delete data[this.collName][this.id];
      writeLocalDb(data);
    }
    return true;
  }
}

class LocalQuery {
  constructor(collName, filters = [], sorts = [], limitCount = null) {
    this.collName = collName;
    this.filters = filters;
    this.sorts = sorts;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    return new LocalQuery(this.collName, [...this.filters, { field, op, value }], this.sorts, this.limitCount);
  }

  orderBy(field, dir = 'asc') {
    return new LocalQuery(this.collName, this.filters, [...this.sorts, { field, dir: dir.toLowerCase() }], this.limitCount);
  }

  limit(n) {
    return new LocalQuery(this.collName, this.filters, this.sorts, n);
  }

  async get() {
    const dbData = readLocalDb();
    const coll = dbData[this.collName] || {};
    let items = Object.keys(coll).map(id => ({ ...coll[id], id }));

    for (const f of this.filters) {
      items = items.filter(item => {
        const val = item[f.field];
        switch (f.op) {
          case '==': return val == f.value;
          case '!=': return val != f.value;
          case '>': return val > f.value;
          case '>=': return val >= f.value;
          case '<': return val < f.value;
          case '<=': return val <= f.value;
          case 'in': return Array.isArray(f.value) && f.value.includes(val);
          case 'array-contains': return Array.isArray(val) && val.includes(f.value);
          default: return true;
        }
      });
    }

    for (const s of this.sorts) {
      items.sort((a, b) => {
        let va = a[s.field] ?? '';
        let vb = b[s.field] ?? '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return s.dir === 'desc' ? 1 : -1;
        if (va > vb) return s.dir === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (this.limitCount && this.limitCount > 0) {
      items = items.slice(0, this.limitCount);
    }

    const docs = items.map(item => ({
      id: item.id,
      exists: true,
      data: () => ({ ...item })
    }));

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: fn => docs.forEach(fn)
    };
  }
}

class LocalCollectionRef extends LocalQuery {
  constructor(collName) {
    super(collName, [], [], null);
  }

  doc(id) {
    const targetId = id || 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    return new LocalDocumentRef(this.collName, targetId);
  }

  async add(docData) {
    const newId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const docRef = this.doc(newId);
    await docRef.set(docData);
    return docRef;
  }
}

const localDb = {
  collection: (name) => new LocalCollectionRef(name),
  isLocal: true
};

// ----------------------------------------------------
// RESILIENT PROXY ADAPTER: CLOUD PRIMARY DENGAN LOCAL FALLBACK
// ----------------------------------------------------
function isPermissionError(err) {
  if (!err) return false;
  const msg = err.message || '';
  const code = err.code || '';
  return code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions');
}

let hasLoggedPermWarning = false;
function logPermissionWarningOnce(err) {
  if (!hasLoggedPermWarning) {
    hasLoggedPermWarning = true;
    console.warn('\n⚠️ ========================================================');
    console.warn('⚠️ [Firebase Cloud] Akses Firestore Ditolak (permission-denied)');
    console.warn('⚠️ Firebase Security Rules di console.firebase.google.com saat ini');
    console.warn('⚠️ belum mengizinkan read/write.');
    console.warn('⚠️ Solusi:');
    console.warn('⚠️ 1. Buka https://console.firebase.google.com/u/0/project/bapasmedan-173dd/firestore/rules');
    console.warn('⚠️ 2. Ubah rules menjadi:');
    console.warn('⚠️    allow read, write: if true;');
    console.warn('⚠️    (atau gunakan serviceAccountKey.json untuk akses admin)');
    console.warn('⚠️ 3. Sistem saat ini beralih sementara ke Local Database agar web tidak crash.');
    console.warn('⚠️ ========================================================\n');
  }
}

class ResilientDocumentRef {
  constructor(collName, docId, cloudDocRef, localDocRef) {
    this.collName = collName;
    this.id = docId;
    this.cloudDocRef = cloudDocRef;
    this.localDocRef = localDocRef;
  }

  async get() {
    if (cloudDb) {
      try {
        const snap = await this.cloudDocRef.get();
        return snap;
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
          return await this.localDocRef.get();
        }
        console.warn(`[Firebase] Get error on ${this.collName}/${this.id}:`, err.message);
        return await this.localDocRef.get();
      }
    }
    return await this.localDocRef.get();
  }

  async set(data, options = {}) {
    // Simpan selalu ke local sebagai backup
    await this.localDocRef.set(data, options);

    if (cloudDb) {
      try {
        await this.cloudDocRef.set(data, options);
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
        } else {
          console.warn(`[Firebase] Set error on ${this.collName}/${this.id}:`, err.message);
        }
      }
    }
    return { id: this.id };
  }

  async update(data) {
    await this.localDocRef.update(data);

    if (cloudDb) {
      try {
        await this.cloudDocRef.update(data);
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
        } else {
          console.warn(`[Firebase] Update error on ${this.collName}/${this.id}:`, err.message);
        }
      }
    }
    return { id: this.id };
  }

  async delete() {
    await this.localDocRef.delete();

    if (cloudDb) {
      try {
        await this.cloudDocRef.delete();
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
        } else {
          console.warn(`[Firebase] Delete error on ${this.collName}/${this.id}:`, err.message);
        }
      }
    }
    return true;
  }
}

class ResilientQuery {
  constructor(collName, cloudQuery, localQuery) {
    this.collName = collName;
    this.cloudQuery = cloudQuery;
    this.localQuery = localQuery;
  }

  where(field, op, value) {
    const nextCloud = this.cloudQuery ? this.cloudQuery.where(field, op, value) : null;
    const nextLocal = this.localQuery.where(field, op, value);
    return new ResilientQuery(this.collName, nextCloud, nextLocal);
  }

  orderBy(field, dir = 'asc') {
    const nextCloud = this.cloudQuery ? this.cloudQuery.orderBy(field, dir) : null;
    const nextLocal = this.localQuery.orderBy(field, dir);
    return new ResilientQuery(this.collName, nextCloud, nextLocal);
  }

  limit(n) {
    const nextCloud = this.cloudQuery ? this.cloudQuery.limit(n) : null;
    const nextLocal = this.localQuery.limit(n);
    return new ResilientQuery(this.collName, nextCloud, nextLocal);
  }

  async get() {
    if (cloudDb && this.cloudQuery) {
      try {
        const snap = await this.cloudQuery.get();
        // Jika cloud kosong tapi local ada data (misal baru mulai), gunakan local
        if (snap.empty) {
          const localSnap = await this.localQuery.get();
          if (!localSnap.empty) {
            return localSnap;
          }
        }
        return snap;
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
          return await this.localQuery.get();
        }
        console.warn(`[Firebase] Query error on ${this.collName}:`, err.message);
        return await this.localQuery.get();
      }
    }
    return await this.localQuery.get();
  }
}

class ResilientCollectionRef extends ResilientQuery {
  constructor(collName) {
    const cloudCol = cloudDb ? cloudDb.collection(collName) : null;
    const localCol = localDb.collection(collName);
    super(collName, cloudCol, localCol);
    this.cloudCol = cloudCol;
    this.localCol = localCol;
  }

  doc(id) {
    const docId = id || 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const cloudDoc = this.cloudCol ? this.cloudCol.doc(docId) : null;
    const localDoc = this.localCol.doc(docId);
    return new ResilientDocumentRef(this.collName, docId, cloudDoc, localDoc);
  }

  async add(data) {
    const newId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const docRef = this.doc(newId);
    await docRef.set(data);
    return docRef;
  }
}

const activeDb = {
  collection: (name) => new ResilientCollectionRef(name),
  isCloud: Boolean(cloudDb),
  rawCloudDb: cloudDb,
  rawLocalDb: localDb
};

module.exports = {
  admin,
  db: activeDb,
  cloudDb,
  firebaseAuth,
  isCloudFirebase: isCloudActive,
  firebaseConfig
};
