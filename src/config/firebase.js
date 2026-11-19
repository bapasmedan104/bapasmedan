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

// 2. Inisialisasi Firebase Client SDK (Hanya Authentication untuk verifikasi login email)
let firebaseAuth = null;
try {
  const firebase = require('firebase/compat/app');
  require('firebase/compat/auth');

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  firebaseAuth = firebase.auth();
  console.log('🔐 Firebase Authentication siap digunakan untuk login');
} catch (err) {
  console.warn('⚠️ Gagal inisialisasi Firebase Auth SDK:', err.message);
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

// BUNDLED SEED DATA - embedded langsung agar tersedia di Cloudflare Workers tanpa filesystem
let bundledSeedData = null;
try {
  bundledSeedData = require('../data/seedData');
} catch (e) {
  try {
    bundledSeedData = require('../../data/firestore_local.json');
  } catch (e2) {
    bundledSeedData = null;
  }
}

let inMemoryDb = bundledSeedData || {
  admin: {},
  client: {},
  wajib_lapor: {},
  konfigurasi_sistem: {},
  history_log: {}
};

// Coba muat data terbaru dari file lokal jika tersedia (override seed data)
try {
  if (fs.existsSync(bundledDbFile)) {
    const fileContent = JSON.parse(fs.readFileSync(bundledDbFile, 'utf8') || '{}');
    // Merge file content di atas seed data, file lokal lebih prioritas
    inMemoryDb = { ...inMemoryDb, ...fileContent };
    for (const col of Object.keys(fileContent)) {
      inMemoryDb[col] = { ...(inMemoryDb[col] || {}), ...fileContent[col] };
    }
  }
} catch {
  // Tetap gunakan bundled seed data
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

function getFirestoreConfig() {
  const apiKey = (process.env.FIREBASE_API_KEY || 'AIzaSyADYXlJ9raZ1hNERRhHz7oAOYz3HbgLcac').trim();
  const projectId = (process.env.FIREBASE_PROJECT_ID || 'bapasmedan-173dd').trim();
  return { apiKey, projectId };
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const k of Object.keys(val)) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const res = {};
    const f = val.mapValue.fields || {};
    for (const k of Object.keys(f)) {
      res[k] = fromFirestoreValue(f[k]);
    }
    return res;
  }
  return null;
}

async function fetchCollectionFromCloudFirestore(collName) {
  const { apiKey, projectId } = getFirestoreConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collName}?key=${apiKey}&pageSize=300`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6500) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Firestore GET collection ${collName} failed HTTP ${res.status}`);
  const data = await res.json();
  if (!data.documents || !data.documents.length) return [];
  return data.documents.map(d => {
    const id = d.name.split('/').pop();
    const docData = { id };
    const fields = d.fields || {};
    for (const k of Object.keys(fields)) {
      docData[k] = fromFirestoreValue(fields[k]);
    }
    return docData;
  });
}

async function fetchDocFromCloudFirestore(collName, docId) {
  const { apiKey, projectId } = getFirestoreConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collName}/${encodeURIComponent(docId)}?key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET doc ${collName}/${docId} failed HTTP ${res.status}`);
  const d = await res.json();
  const id = d.name.split('/').pop();
  const docData = { id };
  const fields = d.fields || {};
  for (const k of Object.keys(fields)) {
    docData[k] = fromFirestoreValue(fields[k]);
  }
  return docData;
}

async function saveDocToCloudFirestore(collName, docId, data, merge = false) {
  const { apiKey, projectId } = getFirestoreConfig();
  let updateMask = '';
  if (merge) {
    const fieldKeys = Object.keys(data).filter(k => k !== 'id');
    if (fieldKeys.length > 0) {
      updateMask = '&' + fieldKeys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    }
  }
  const fields = {};
  for (const k of Object.keys(data)) {
    if (k === 'id') continue;
    fields[k] = toFirestoreValue(data[k]);
  }
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collName}/${encodeURIComponent(docId)}?key=${apiKey}${updateMask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(7000)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore PATCH ${collName}/${docId} failed HTTP ${res.status}: ${errText}`);
  }
  return true;
}

async function deleteFromCloudFirestore(collName, docId) {
  try {
    const { apiKey, projectId } = getFirestoreConfig();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collName}/${encodeURIComponent(docId)}?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      console.log(`🔥 [Firebase REST] Dokumen '${collName}/${docId}' BERHASIL DIHAPUS PERMANEN dari Firebase Cloud Firestore.`);
      return true;
    } else {
      const errText = await res.text();
      if (res.status === 404) {
        console.log(`ℹ️ [Firebase REST] Dokumen '${collName}/${docId}' sudah tidak ada di Cloud Firestore.`);
        return true;
      }
      console.warn(`⚠️ [Firebase REST] Gagal menghapus '${collName}/${docId}': HTTP ${res.status}`, errText);
      return false;
    }
  } catch (err) {
    console.warn(`⚠️ [Firebase REST] Error koneksi saat menghapus '${collName}/${docId}':`, err.message);
    return false;
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
    await deleteFromCloudFirestore(this.collName, this.id);
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
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore doc get timeout')), 4000)
        );
        const snap = await Promise.race([this.cloudDocRef.get(), timeoutPromise]);
        return snap;
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
        } else {
          console.warn(`[Firebase Admin] Get error on ${this.collName}/${this.id}:`, err.message);
        }
      }
    } else {
      // Cloudflare Workers REST API: Ambil dokumen langsung dari Cloud Firestore
      try {
        const cloudDoc = await fetchDocFromCloudFirestore(this.collName, this.id);
        if (cloudDoc) {
          // Sinkronkan ke local cache
          await this.localDocRef.set(cloudDoc);
          return {
            id: this.id,
            exists: true,
            data: () => ({ ...cloudDoc })
          };
        } else {
          // Dokumen tidak ada di cloud
          return {
            id: this.id,
            exists: false,
            data: () => undefined
          };
        }
      } catch (restErr) {
        console.warn(`[Firebase REST] Get doc error on ${this.collName}/${this.id}:`, restErr.message);
      }
    }
    return await this.localDocRef.get();
  }

  async set(data, options = {}) {
    // 1. Simpan selalu ke local cache
    await this.localDocRef.set(data, options);

    // 2. Simpan permanen ke Cloud Firestore
    if (cloudDb) {
      try {
        await this.cloudDocRef.set(data, options);
      } catch (err) {
        if (isPermissionError(err)) logPermissionWarningOnce(err);
        else console.warn(`[Firebase Admin] Set error on ${this.collName}/${this.id}:`, err.message);
      }
    } else {
      try {
        await saveDocToCloudFirestore(this.collName, this.id, data, Boolean(options.merge));
      } catch (restErr) {
        console.warn(`[Firebase REST] Set doc error on ${this.collName}/${this.id}:`, restErr.message);
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
        if (isPermissionError(err)) logPermissionWarningOnce(err);
        else console.warn(`[Firebase Admin] Update error on ${this.collName}/${this.id}:`, err.message);
      }
    } else {
      try {
        await saveDocToCloudFirestore(this.collName, this.id, data, true);
      } catch (restErr) {
        console.warn(`[Firebase REST] Update doc error on ${this.collName}/${this.id}:`, restErr.message);
      }
    }
    return { id: this.id };
  }

  async delete() {
    // 1. Hapus dari cache local memory
    await this.localDocRef.delete();

    // 2. Hapus permanen dari Cloud Firestore via Admin SDK jika ada
    if (cloudDb) {
      try {
        await this.cloudDocRef.delete();
      } catch (err) {
        if (isPermissionError(err)) logPermissionWarningOnce(err);
        else console.warn(`[Firebase Admin] Delete error on ${this.collName}/${this.id}:`, err.message);
      }
    }

    // 3. Hapus permanen dari Cloud Firestore via REST API
    try {
      await deleteFromCloudFirestore(this.collName, this.id);
    } catch (restErr) {
      console.warn(`[Firebase REST] Delete error on ${this.collName}/${this.id}:`, restErr.message);
    }
    return true;
  }
}

class ResilientQuery {
  constructor(collName, cloudQuery, localQuery, filters = [], sorts = [], limitCount = null) {
    this.collName = collName;
    this.cloudQuery = cloudQuery;
    this.localQuery = localQuery;
    this.filters = filters;
    this.sorts = sorts;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    const nextCloud = this.cloudQuery ? this.cloudQuery.where(field, op, value) : null;
    const nextLocal = this.localQuery.where(field, op, value);
    return new ResilientQuery(this.collName, nextCloud, nextLocal, [...this.filters, { field, op, value }], this.sorts, this.limitCount);
  }

  orderBy(field, dir = 'asc') {
    const nextCloud = this.cloudQuery ? this.cloudQuery.orderBy(field, dir) : null;
    const nextLocal = this.localQuery.orderBy(field, dir);
    return new ResilientQuery(this.collName, nextCloud, nextLocal, this.filters, [...this.sorts, { field, dir: dir.toLowerCase() }], this.limitCount);
  }

  limit(n) {
    const nextCloud = this.cloudQuery ? this.cloudQuery.limit(n) : null;
    const nextLocal = this.localQuery.limit(n);
    return new ResilientQuery(this.collName, nextCloud, nextLocal, this.filters, this.sorts, n);
  }

  async get() {
    if (cloudDb && this.cloudQuery) {
      try {
        // Timeout 4 detik agar di Cloudflare Workers tidak hang (CPU time limit)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore query timeout')), 4000)
        );
        const snap = await Promise.race([this.cloudQuery.get(), timeoutPromise]);
        return snap;
      } catch (err) {
        if (isPermissionError(err)) {
          logPermissionWarningOnce(err);
        } else {
          console.warn(`[Firebase Admin] Query error on ${this.collName}:`, err.message);
        }
      }
    } else {
      // CLOUDFLARE WORKERS REST API: Ambil data live langsung dari Cloud Firestore
      try {
        const cloudDocs = await fetchCollectionFromCloudFirestore(this.collName);
        
        // Perbarui memory cache dengan data aktual dari Cloud
        const dbData = readLocalDb();
        const freshColl = {};
        for (const item of cloudDocs) {
          freshColl[item.id] = { ...item };
        }
        dbData[this.collName] = freshColl;
        writeLocalDb(dbData);

        // Terapkan filter query secara in-memory pada data live dari cloud
        let items = [...cloudDocs];
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
      } catch (restErr) {
        console.warn(`[Firebase REST] Query error on ${this.collName}:`, restErr.message);
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
