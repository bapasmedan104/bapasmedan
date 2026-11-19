const { db, firebaseAuth } = require('../config/firebase');
const { hashPassword, verifyPassword, getNamaBulan } = require('../utils/helpers');

// Helper to convert Firestore snapshot to array of objects
function docsToArray(snapshot) {
  const result = [];
  snapshot.forEach(doc => {
    result.push({ ...doc.data(), id: doc.id });
  });
  return result;
}

// ============================================
// HISTORY LOG
// ============================================
async function logActivity(userType, userId, aksi, deskripsi, ipAddress = '') {
  try {
    const col = db.collection('history_log');
    await col.add({
      user_type: userType,
      user_id: userId,
      aksi: aksi,
      deskripsi: deskripsi,
      ip_address: ipAddress || '127.0.0.1',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error logging activity:', err.message);
  }
}

// ============================================
// ADMIN METHODS
// ============================================
async function getAdminByUsername(username) {
  const col = db.collection('admin');
  const snap = await col.where('username', '==', username).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function getAdminByEmail(email) {
  if (!email) return null;
  const col = db.collection('admin');
  const cleanEmail = email.trim().toLowerCase();
  let snap = await col.where('email', '==', cleanEmail).limit(1).get();
  if (snap.empty) {
    snap = await col.where('email', '==', email.trim()).limit(1).get();
  }
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function getAdminByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim();
  if (clean.includes('@')) {
    const byEmail = await getAdminByEmail(clean);
    if (byEmail) return byEmail;
  }
  return await getAdminByUsername(clean);
}

async function getAdminById(id) {
  const docRef = db.collection('admin').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return { ...snap.data(), id: snap.id };
}

async function updateAdminLastLogin(id) {
  const docRef = db.collection('admin').doc(id);
  await docRef.set({ last_login: new Date().toISOString() }, { merge: true });
}

async function loginAdmin(identifier, password) {
  if (!identifier || !password) return null;
  const cleanId = identifier.trim();

  // 1. Cek akun admin di Database (Firestore / Local JSON) terlebih dahulu
  const adminUser = await getAdminByIdentifier(cleanId);

  // Jika akun admin ditemukan di database:
  if (adminUser) {
    if (adminUser.status !== 'aktif') {
      console.log(`⚠️ Admin login ditolak: akun nonaktif (${cleanId})`);
      return null;
    }

    // Jika admin sudah memiliki sandi tersimpan di database:
    // WAJIB verifikasi kecocokan sandi terhadap hash database.
    // Jika tidak cocok, LANGSUNG TOLAK! Jangan biarkan sandi lama login lewat mana pun!
    if (adminUser.password) {
      const valid = await verifyPassword(password, adminUser.password);
      if (!valid) {
        console.log(`❌ Admin login gagal: kata sandi tidak cocok (${cleanId})`);
        return null;
      }

      await updateAdminLastLogin(adminUser.id);
      await logActivity('admin', adminUser.id, 'Login', `Admin login berhasil via Database (${adminUser.username})`);
      return adminUser;
    }
  }

  // 2. Fallback khusus jika akun belum memiliki password di database (misal pertama kali setup Firebase Auth)
  if (firebaseAuth && cleanId.includes('@')) {
    try {
      const userCred = await firebaseAuth.signInWithEmailAndPassword(cleanId, password);
      const fbUser = userCred.user;
      if (fbUser) {
        console.log(`🔐 Admin berhasil login via Firebase Auth: ${fbUser.email}`);
        let fbAdminUser = adminUser || await getAdminByEmail(fbUser.email);
        const hashedPassword = await hashPassword(password);
        if (!fbAdminUser) {
          fbAdminUser = {
            id: 'admin_' + (fbUser.uid ? fbUser.uid.substring(0, 10) : Date.now()),
            username: fbUser.email.split('@')[0],
            email: fbUser.email,
            nama_lengkap: fbUser.displayName || 'Administrator BAPAS',
            status: 'aktif',
            firebase_uid: fbUser.uid,
            password: hashedPassword,
            tanggal_daftar: new Date().toISOString()
          };
          await db.collection('admin').doc(fbAdminUser.id).set(fbAdminUser, { merge: true });
        } else {
          await db.collection('admin').doc(fbAdminUser.id).set({ password: hashedPassword }, { merge: true });
        }
        await updateAdminLastLogin(fbAdminUser.id);
        await logActivity('admin', fbAdminUser.id, 'Login', `Admin login via Firebase Auth (${fbUser.email})`);
        return fbAdminUser;
      }
    } catch (fbErr) {
      console.log(`ℹ️ Catatan Firebase Auth Login (${cleanId}): ${fbErr.code || fbErr.message}`);
    }
  }

  return null;
}

// ============================================
// CLIENT METHODS
// ============================================
async function getClientByUsername(username) {
  const col = db.collection('client');
  const snap = await col.where('username', '==', username).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function getClientByRegister(noRegister) {
  if (!noRegister) return null;
  const clean = noRegister.trim();
  const col = db.collection('client');
  let snap = await col.where('no_register', '==', clean).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { ...doc.data(), id: doc.id };
  }
  // Coba pencarian case-insensitive dan normalisasi tanda hubung/spasi
  const allSnap = await col.get();
  const cleanNorm = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const doc of allSnap.docs) {
    const data = doc.data();
    const docReg = (data.no_register || '').trim();
    if (docReg.toLowerCase() === clean.toLowerCase()) {
      return { ...data, id: doc.id };
    }
    const docNorm = docReg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanNorm && docNorm && cleanNorm === docNorm) {
      return { ...data, id: doc.id };
    }
  }
  return null;
}

async function getClientByPhone(phone) {
  if (!phone) return null;
  const cleanDigits = phone.replace(/[^0-9]/g, '');
  if (!cleanDigits) return null;
  const col = db.collection('client');
  let snap = await col.where('no_telepon', '==', phone.trim()).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { ...doc.data(), id: doc.id };
  }
  const allSnap = await col.get();
  for (const doc of allSnap.docs) {
    const data = doc.data();
    const docDigits = (data.no_telepon || '').replace(/[^0-9]/g, '');
    if (docDigits && (docDigits === cleanDigits || docDigits.endsWith(cleanDigits) || cleanDigits.endsWith(docDigits))) {
      return { ...data, id: doc.id };
    }
  }
  return null;
}

async function getClientById(id) {
  const docRef = db.collection('client').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return { ...snap.data(), id: snap.id };
}

async function loginClient(identifier, password) {
  if (!identifier || !password) return null;
  const clean = identifier.trim();

  // 1. Coba login melalui No. Register Klien
  let clientUser = await getClientByRegister(clean);

  // 2. Coba login melalui Username
  if (!clientUser) {
    clientUser = await getClientByUsername(clean);
  }

  // 3. Coba login melalui Nomor Telepon / WhatsApp
  if (!clientUser) {
    clientUser = await getClientByPhone(clean);
  }

  if (!clientUser) return null;
  if (clientUser.status !== 'aktif' && clientUser.status !== 'selesai') return null;

  const valid = await verifyPassword(password, clientUser.password);
  if (!valid) return null;

  const docRef = db.collection('client').doc(clientUser.id);
  await docRef.set({ last_login: new Date().toISOString() }, { merge: true });
  await logActivity('client', clientUser.id, 'Login', `Client login berhasil (${clientUser.nama_lengkap || clientUser.username})`);
  return clientUser;
}

async function isProfilClientLengkap(clientId) {
  const clientUser = await getClientById(clientId);
  if (!clientUser) return false;
  return Boolean(clientUser.profil_lengkap);
}

async function updateProfilClient(clientId, data, fotoRelatif = null) {
  const namaLengkap = (data.nama_lengkap || '').trim();
  const noHpGmail = (data.no_hp_gmail || '').trim();
  const alamatSekarang = (data.alamat_sekarang || '').trim();
  let masaWajibLapor = (data.masa_wajib_lapor || '').trim();

  const clientLama = await getClientById(clientId);
  if (!clientLama) {
    return { success: false, message: 'Client tidak ditemukan' };
  }

  // Otomatis isi masa_wajib_lapor dari penetapan admin jika tidak dikirim dari form
  if (!masaWajibLapor) {
    if (clientLama.masa_wajib_lapor) {
      masaWajibLapor = clientLama.masa_wajib_lapor;
    } else {
      const bMulai = clientLama.bulan_wajib_lapor_mulai || 1;
      const tMulai = clientLama.tahun_wajib_lapor_mulai || new Date().getFullYear();
      const bAkhir = clientLama.bulan_wajib_lapor_akhir || 12;
      const tAkhir = clientLama.tahun_wajib_lapor_akhir || tMulai;
      masaWajibLapor = `${getNamaBulan(bMulai)} ${tMulai} s/d ${getNamaBulan(bAkhir)} ${tAkhir}`;
    }
  }

  if (!namaLengkap || !noHpGmail || !alamatSekarang) {
    return { success: false, message: 'Nama lengkap, nomor HP/WA, dan alamat domisili wajib diisi!' };
  }

  const sudahAdaFoto = Boolean(clientLama.foto_profil);
  if (!fotoRelatif && !sudahAdaFoto) {
    return { success: false, message: 'Harap pilih atau ambil foto profil wajah Anda terlebih dahulu!' };
  }

  const updatePayload = {
    nama_lengkap: namaLengkap,
    no_hp_gmail: noHpGmail,
    alamat_sekarang: alamatSekarang,
    masa_wajib_lapor: masaWajibLapor,
    profil_lengkap: 1,
    profil_updated_at: new Date().toISOString()
  };

  if (fotoRelatif) {
    updatePayload.foto_profil = fotoRelatif;
  }

  const docRef = db.collection('client').doc(clientId);
  await docRef.set(updatePayload, { merge: true });

  await logActivity('client', clientId, 'Update Profil', 'Client melengkapi/memperbarui profil');
  return { success: true, message: 'Profil berhasil disimpan' };
}

async function createClient(data, adminId) {
  let username = (data.username || '').trim();
  const password = (data.password || '').trim();
  const namaLengkap = (data.nama_lengkap || '').trim();
  const noRegister = (data.no_register || '').trim();

  if (!noRegister) {
    return { success: false, message: 'Nomor Register wajib diisi!' };
  }
  if (!namaLengkap) {
    return { success: false, message: 'Nama lengkap klien wajib diisi!' };
  }
  if (!password) {
    return { success: false, message: 'Kata sandi klien wajib diisi!' };
  }

  // Jika username tidak diisi admin, gunakan nomor register sebagai username default
  if (!username) {
    username = noRegister.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  const existingRegister = await getClientByRegister(noRegister);
  if (existingRegister) {
    return { success: false, message: `Nomor Register "${noRegister}" sudah terdaftar!` };
  }

  const existingUsername = await getClientByUsername(username);
  if (existingUsername) {
    username = username + '_' + Math.floor(Math.random() * 1000);
  }

  const bMulai = parseInt(data.bulan_mulai, 10) || 1;
  const tMulai = parseInt(data.tahun_mulai, 10) || new Date().getFullYear();
  const bAkhir = parseInt(data.bulan_akhir, 10) || 12;
  const tAkhir = parseInt(data.tahun_akhir, 10) || tMulai;
  const totalBulan = parseInt(data.total_bulan, 10) || 12;
  const autoMasaWajib = `${getNamaBulan(bMulai)} ${tMulai} s/d ${getNamaBulan(bAkhir)} ${tAkhir}`;

  const hashedPassword = await hashPassword(password);
  const newClient = {
    username,
    password: hashedPassword,
    password_plain: password, // Menyimpan sandi awal agar admin dapat mengingatkan klien jika lupa
    nama_lengkap: namaLengkap,
    no_register: noRegister,
    tanggal_lahir: data.tanggal_lahir || '',
    tempat_lahir: data.tempat_lahir || '',
    alamat: data.alamat || '',
    email: data.email || '',
    no_telepon: (data.no_telepon || '').trim(),
    status: 'aktif',
    bulan_wajib_lapor_mulai: bMulai,
    tahun_wajib_lapor_mulai: tMulai,
    bulan_wajib_lapor_akhir: bAkhir,
    tahun_wajib_lapor_akhir: tAkhir,
    total_bulan_wajib_lapor: totalBulan,
    foto_profil: null,
    no_hp_gmail: (data.no_telepon || '').trim() || data.email || null,
    alamat_sekarang: data.alamat || null,
    masa_wajib_lapor: autoMasaWajib,
    profil_lengkap: 0,
    created_by: adminId || null,
    created_at: new Date().toISOString(),
    last_login: null
  };

  const docRef = await db.collection('client').add(newClient);
  await logActivity('admin', adminId, 'Buat Client', `Admin membuat client baru: ${namaLengkap} (${noRegister})`);
  return { success: true, id: docRef.id, message: `Klien "${namaLengkap}" (${noRegister}) berhasil ditambahkan!` };
}

async function updateClient(clientId, data, adminId) {
  const docRef = db.collection('client').doc(clientId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { success: false, message: 'Client tidak ditemukan' };
  }

  const updatePayload = {
    nama_lengkap: data.nama_lengkap || snap.data().nama_lengkap,
    tanggal_lahir: data.tanggal_lahir !== undefined ? data.tanggal_lahir : snap.data().tanggal_lahir,
    no_telepon: data.no_telepon !== undefined ? data.no_telepon : snap.data().no_telepon,
    status: data.status || snap.data().status
  };

  if (data.password && data.password.trim()) {
    updatePayload.password = await hashPassword(data.password.trim());
    updatePayload.password_plain = data.password.trim();
  }

  if (data.total_bulan) {
    updatePayload.total_bulan_wajib_lapor = parseInt(data.total_bulan, 10);
  }
  if (data.bulan_mulai) updatePayload.bulan_wajib_lapor_mulai = parseInt(data.bulan_mulai, 10);
  if (data.tahun_mulai) updatePayload.tahun_wajib_lapor_mulai = parseInt(data.tahun_mulai, 10);
  if (data.bulan_akhir) updatePayload.bulan_wajib_lapor_akhir = parseInt(data.bulan_akhir, 10);
  if (data.tahun_akhir) updatePayload.tahun_wajib_lapor_akhir = parseInt(data.tahun_akhir, 10);

  const bMulai = updatePayload.bulan_wajib_lapor_mulai || snap.data().bulan_wajib_lapor_mulai || 1;
  const tMulai = updatePayload.tahun_wajib_lapor_mulai || snap.data().tahun_wajib_lapor_mulai || new Date().getFullYear();
  const bAkhir = updatePayload.bulan_wajib_lapor_akhir || snap.data().bulan_wajib_lapor_akhir || 12;
  const tAkhir = updatePayload.tahun_wajib_lapor_akhir || snap.data().tahun_wajib_lapor_akhir || tMulai;
  updatePayload.masa_wajib_lapor = `${getNamaBulan(bMulai)} ${tMulai} s/d ${getNamaBulan(bAkhir)} ${tAkhir}`;

  await docRef.set(updatePayload, { merge: true });
  await logActivity('admin', adminId, 'Update Client', `Admin update client ID: ${clientId}`);
  return { success: true, message: 'Client berhasil diupdate' };
}

async function resetClientPassword(clientId, newPassword, adminId) {
  const cleanPass = (newPassword || '').trim();
  if (!cleanPass) {
    return { success: false, message: 'Kata sandi baru tidak boleh kosong' };
  }
  const docRef = db.collection('client').doc(clientId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { success: false, message: 'Data klien tidak ditemukan' };
  }
  const clientData = snap.data();
  const hashedPassword = await hashPassword(cleanPass);
  await docRef.set({
    password: hashedPassword,
    password_plain: cleanPass,
    password_reset_at: new Date().toISOString()
  }, { merge: true });

  await logActivity('admin', adminId, 'Reset Sandi Klien', `Admin mereset kata sandi klien ${clientData.nama_lengkap || clientId} (${clientData.no_register || '-'})`);
  return {
    success: true,
    newPassword: cleanPass,
    clientName: clientData.nama_lengkap || 'Klien',
    message: `Kata sandi klien "${clientData.nama_lengkap || 'Klien'}" (${clientData.no_register || ''}) berhasil direset menjadi: "${cleanPass}"`
  };
}

async function resetAdminPassword(adminId, newPassword) {
  const cleanPass = (newPassword || '').trim();
  if (!cleanPass || cleanPass.length < 5) {
    return { success: false, message: 'Kata sandi baru admin minimal 5 karakter' };
  }
  const docRef = db.collection('admin').doc(adminId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { success: false, message: 'Akun administrator tidak ditemukan' };
  }
  const hashedPassword = await hashPassword(cleanPass);
  await docRef.set({
    password: hashedPassword,
    password_reset_at: new Date().toISOString()
  }, { merge: true });

  await logActivity('admin', adminId, 'Reset Sandi Admin', `Admin mereset kata sandi akunnya sendiri`);
  return {
    success: true,
    message: 'Kata sandi administrator berhasil diperbarui! Silakan gunakan kata sandi baru untuk login selanjutnya.'
  };
}

async function deleteClient(clientId, adminId) {
  // 1. Hapus semua laporan client dari koleksi wajib_lapor
  const laporCol = db.collection('wajib_lapor');
  const snap = await laporCol.where('client_id', '==', clientId).get();
  for (const doc of snap.docs) {
    await laporCol.doc(doc.id).delete();
  }

  // 2. Query langsung ke Cloud Firestore via REST jika ada laporan tersisa di cloud
  try {
    const apiKey = (process.env.FIREBASE_API_KEY || 'AIzaSyADYXlJ9raZ1hNERRhHz7oAOYz3HbgLcac').trim();
    const projectId = (process.env.FIREBASE_PROJECT_ID || 'bapasmedan-173dd').trim();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/wajib_lapor?key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.documents && data.documents.length) {
        for (const d of data.documents) {
          const docId = d.name.split('/').pop();
          const cId = d.fields && d.fields.client_id && d.fields.client_id.stringValue;
          if (cId === clientId) {
            await laporCol.doc(docId).delete();
          }
        }
      }
    }
  } catch (err) {
    // Lanjutkan proses penghapusan
  }

  // 3. Hapus dokumen client secara permanen
  await db.collection('client').doc(clientId).delete();
  await logActivity('admin', adminId, 'Hapus Client Permanen', `Admin menghapus permanen client ID: ${clientId} dari Firebase`);
  return { success: true, message: 'Data klien beserta seluruh berkas laporan berhasil DIHAPUS PERMANEN dari Firebase' };
}

async function deleteLapor(laporId, adminId) {
  await db.collection('wajib_lapor').doc(laporId).delete();
  await logActivity('admin', adminId, 'Hapus Laporan Permanen', `Admin menghapus permanen laporan ID: ${laporId} dari Firebase`);
  return { success: true, message: 'Laporan berhasil DIHAPUS PERMANEN dari Firebase' };
}

async function getAllClients(filterOptions = {}) {
  const col = db.collection('client');
  const snap = await col.get();
  let clients = docsToArray(snap);

  // Sorting default by created_at desc
  clients.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Terapkan filter opsional
  if (filterOptions.status && filterOptions.status !== 'all') {
    clients = clients.filter(c => c.status === filterOptions.status);
  }

  if (filterOptions.profil_lengkap !== undefined && filterOptions.profil_lengkap !== 'all') {
    const isLengkap = filterOptions.profil_lengkap === '1' || filterOptions.profil_lengkap === true;
    clients = clients.filter(c => Boolean(c.profil_lengkap) === isLengkap);
  }

  if (filterOptions.search) {
    const q = filterOptions.search.toLowerCase();
    clients = clients.filter(c =>
      (c.nama_lengkap && c.nama_lengkap.toLowerCase().includes(q)) ||
      (c.no_register && c.no_register.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.no_telepon && c.no_telepon.toLowerCase().includes(q))
    );
  }

  return clients;
}

// ============================================
// WAJIB LAPOR METHODS
// ============================================
async function getLaporById(id) {
  const docRef = db.collection('wajib_lapor').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const laporData = { ...snap.data(), id: snap.id };

  // Ambil data client terkait
  if (laporData.client_id) {
    const clientUser = await getClientById(laporData.client_id);
    if (clientUser) {
      laporData.nama_lengkap = clientUser.nama_lengkap;
      laporData.no_register = clientUser.no_register;
      laporData.email = clientUser.email;
      laporData.no_telepon = clientUser.no_telepon;
      laporData.foto_profil = clientUser.foto_profil;
    }
  }

  // Ambil data admin verifikator jika ada
  if (laporData.verified_by) {
    const adminUser = await getAdminById(laporData.verified_by);
    if (adminUser) {
      laporData.admin_verifikasi = adminUser.nama_lengkap;
    }
  }

  return laporData;
}

async function getLaporBulanIni(clientId, bulan, tahun) {
  const col = db.collection('wajib_lapor');
  const snap = await col
    .where('client_id', '==', clientId)
    .where('bulan', '==', parseInt(bulan, 10))
    .where('tahun', '==', parseInt(tahun, 10))
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function cekBisaInputLapor(clientId) {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  const lapor = await getLaporBulanIni(clientId, bulan, tahun);
  if (!lapor) return true;
  // Jika masih draft atau ditolak, masih bisa input/edit dan kirim ulang
  if (lapor.status === 'draft' || lapor.status === 'ditolak') return true;
  // Jika sudah menunggu verifikasi atau diterima, tidak bisa input baru lagi
  return false;
}

async function saveDraftLapor(clientId, data) {
  const bulan = parseInt(data.bulan, 10);
  const tahun = parseInt(data.tahun, 10);
  const aktivitasHarian = data.aktivitas_harian || '';
  const rencanaMendatang = data.rencana_mendatang || '';

  const col = db.collection('wajib_lapor');
  const existing = await getLaporBulanIni(clientId, bulan, tahun);

  if (existing) {
    const docRef = col.doc(existing.id);
    await docRef.set({
      aktivitas_harian: aktivitasHarian,
      rencana_mendatang: rencanaMendatang,
      updated_at: new Date().toISOString()
    }, { merge: true });

    return { success: true, id: existing.id, message: 'Draft berhasil diperbarui' };
  } else {
    const newDoc = {
      client_id: clientId,
      bulan,
      tahun,
      aktivitas_harian: aktivitasHarian,
      rencana_mendatang: rencanaMendatang,
      foto_bukti: null,
      foto_uploaded_at: null,
      tanggal_submit: null,
      status: 'draft',
      catatan_admin: null,
      verified_by: null,
      verified_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const docRef = await col.add(newDoc);
    return { success: true, id: docRef.id, message: 'Draft berhasil disimpan' };
  }
}

async function updateLaporPhoto(laporId, photoPath) {
  const docRef = db.collection('wajib_lapor').doc(laporId);
  await docRef.set({
    foto_bukti: photoPath,
    foto_uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { merge: true });
}

async function submitLapor(clientId, laporId) {
  const docRef = db.collection('wajib_lapor').doc(laporId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { success: false, message: 'Laporan tidak ditemukan' };
  }

  const existingData = snap.data() || {};
  const updatePayload = {
    status: 'menunggu_verifikasi',
    tanggal_submit: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Jika sebelumnya ditolak, arsipkan catatan penolakan sebelumnya
  if (existingData.status === 'ditolak' && existingData.catatan_admin) {
    updatePayload.catatan_penolakan_sebelumnya = existingData.catatan_admin;
  }

  await docRef.set(updatePayload, { merge: true });

  await logActivity('client', clientId, 'Submit Lapor', `Client submit lapor ID: ${laporId}`);
  return { success: true, message: 'Lapor berhasil dikirim untuk verifikasi admin' };
}

async function getRiwayatLaporClient(clientId) {
  const col = db.collection('wajib_lapor');
  const snap = await col.where('client_id', '==', clientId).get();
  let list = docsToArray(snap);

  // Filter yang bukan draft (atau bisa sertakan draft tergantung riwayat)
  list = list.filter(item => ['menunggu_verifikasi', 'diterima', 'ditolak', 'dibatalkan', 'draft'].includes(item.status));

  // Sort by tahun desc, bulan desc
  list.sort((a, b) => {
    if (b.tahun !== a.tahun) return b.tahun - a.tahun;
    return b.bulan - a.bulan;
  });

  return list;
}

async function getInfoWajibLaporClient(clientId) {
  const clientUser = await getClientById(clientId);
  if (!clientUser) return null;

  const riwayat = await getRiwayatLaporClient(clientId);
  const laporanSelesai = riwayat.filter(r => ['diterima', 'menunggu_verifikasi'].includes(r.status));
  const totalLapor = laporanSelesai.length;
  const totalHarus = clientUser.total_bulan_wajib_lapor || 12;

  return {
    nama: clientUser.nama_lengkap,
    no_register: clientUser.no_register,
    status: clientUser.status,
    bulan_mulai: clientUser.bulan_wajib_lapor_mulai,
    tahun_mulai: clientUser.tahun_wajib_lapor_mulai,
    bulan_akhir: clientUser.bulan_wajib_lapor_akhir,
    tahun_akhir: clientUser.tahun_wajib_lapor_akhir,
    total_bulan_harus: totalHarus,
    total_sudah_lapor: totalLapor,
    sisa_lapor: Math.max(0, totalHarus - totalLapor)
  };
}

// ============================================
// ADMIN WAJIB LAPOR & ADVANCED FILTERING
// ============================================
async function getAllLaporAdmin(filters = {}) {
  const col = db.collection('wajib_lapor');
  const snap = await col.get();
  let allLapor = docsToArray(snap);

  // Cache clients & admins untuk performa join cepat
  const clientsSnap = await db.collection('client').get();
  const clientsMap = {};
  clientsSnap.forEach(c => {
    clientsMap[c.id] = c.data();
  });

  const adminsSnap = await db.collection('admin').get();
  const adminsMap = {};
  adminsSnap.forEach(a => {
    adminsMap[a.id] = a.data();
  });

  // Attach relational data
  allLapor = allLapor.map(item => {
    const client = clientsMap[item.client_id] || {};
    const admin = adminsMap[item.verified_by] || {};
    return {
      ...item,
      nama_lengkap: client.nama_lengkap || 'Klien Tidak Diketahui',
      no_register: client.no_register || '-',
      email: client.email || '',
      no_telepon: client.no_telepon || '',
      admin_verifikasi: admin.nama_lengkap || '-'
    };
  });

  // Terapkan Filter yang Lengkap:
  // 1. Filter Status
  if (filters.status && filters.status !== 'all') {
    allLapor = allLapor.filter(item => item.status === filters.status);
  }

  // 2. Filter Client Search (Nama, Register, ID)
  if (filters.client && filters.client.trim()) {
    const q = filters.client.trim().toLowerCase();
    allLapor = allLapor.filter(item =>
      (item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(q)) ||
      (item.no_register && item.no_register.toLowerCase().includes(q)) ||
      (item.client_id && item.client_id.toLowerCase().includes(q))
    );
  }

  // 3. Filter Bulan
  if (filters.bulan && filters.bulan !== 'all') {
    const b = parseInt(filters.bulan, 10);
    allLapor = allLapor.filter(item => parseInt(item.bulan, 10) === b);
  }

  // 4. Filter Tahun
  if (filters.tahun && filters.tahun !== 'all') {
    const t = parseInt(filters.tahun, 10);
    allLapor = allLapor.filter(item => parseInt(item.tahun, 10) === t);
  }

  // 5. Filter Foto Bukti (ada / tidak ada)
  if (filters.foto && filters.foto !== 'all') {
    if (filters.foto === 'ada') {
      allLapor = allLapor.filter(item => Boolean(item.foto_bukti));
    } else if (filters.foto === 'tidak_ada') {
      allLapor = allLapor.filter(item => !item.foto_bukti);
    }
  }

  // 6. Filter Rentang Tanggal Submit (Start Date & End Date)
  if (filters.date_start) {
    const start = new Date(filters.date_start + 'T00:00:00');
    allLapor = allLapor.filter(item => {
      if (!item.tanggal_submit) return false;
      return new Date(item.tanggal_submit) >= start;
    });
  }

  if (filters.date_end) {
    const end = new Date(filters.date_end + 'T23:59:59');
    allLapor = allLapor.filter(item => {
      if (!item.tanggal_submit) return false;
      return new Date(item.tanggal_submit) <= end;
    });
  }

  // 7. Pengurutan / Sorting
  const sortBy = filters.sort || 'tanggal_submit_desc';
  allLapor.sort((a, b) => {
    switch (sortBy) {
      case 'tanggal_submit_asc':
        return new Date(a.tanggal_submit || 0) - new Date(b.tanggal_submit || 0);
      case 'nama_asc':
        return (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '');
      case 'nama_desc':
        return (b.nama_lengkap || '').localeCompare(a.nama_lengkap || '');
      case 'periode_desc':
        return (b.tahun * 100 + b.bulan) - (a.tahun * 100 + a.bulan);
      case 'periode_asc':
        return (a.tahun * 100 + a.bulan) - (b.tahun * 100 + b.bulan);
      case 'tanggal_submit_desc':
      default:
        return new Date(b.tanggal_submit || b.created_at || 0) - new Date(a.tanggal_submit || a.created_at || 0);
    }
  });

  return allLapor;
}

async function getLaporMenungguVerifikasi() {
  return getAllLaporAdmin({ status: 'menunggu_verifikasi' });
}

async function terimaLapor(laporId, adminId) {
  const docRef = db.collection('wajib_lapor').doc(laporId);
  await docRef.set({
    status: 'diterima',
    verified_by: adminId,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { merge: true });

  await logActivity('admin', adminId, 'Terima Lapor', `Admin menerima lapor ID: ${laporId}`);
  return { success: true, message: 'Lapor berhasil diterima' };
}

async function tolakLapor(laporId, adminId, catatan) {
  const docRef = db.collection('wajib_lapor').doc(laporId);
  const alasanFinal = (catatan && catatan.trim()) ? catatan.trim() : 'Laporan tidak sesuai ketentuan / bukti foto tidak valid';

  await docRef.set({
    status: 'ditolak',
    catatan_admin: alasanFinal,
    alasan_penolakan: alasanFinal,
    catatan_petugas: alasanFinal,
    verified_by: adminId,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { merge: true });

  await logActivity('admin', adminId, 'Tolak Lapor', `Admin menolak lapor ID: ${laporId} dengan alasan: ${alasanFinal}`);
  return { success: true, message: 'Laporan berhasil ditolak dan catatan alasan telah diteruskan ke klien' };
}

async function batalkanLapor(laporId, adminId, catatan) {
  const docRef = db.collection('wajib_lapor').doc(laporId);
  await docRef.set({
    status: 'dibatalkan',
    catatan_admin: catatan || 'Laporan dibatalkan',
    verified_by: adminId,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { merge: true });

  await logActivity('admin', adminId, 'Batalkan Lapor', `Admin membatalkan lapor ID: ${laporId}`);
  return { success: true, message: 'Lapor berhasil dibatalkan' };
}

// ============================================
// KONFIGURASI SISTEM
// ============================================
async function getKonfigurasi() {
  const col = db.collection('konfigurasi_sistem');
  const snap = await col.limit(1).get();
  if (snap.empty) {
    const defaultConfig = {
      tanggal_mulai_input: 1,
      tanggal_akhir_input: 15,
      notifikasi_tertutup: 'Periode pengisian wajib lapor telah ditutup. Silakan datang ke BAPAS untuk melakukan wajib lapor secara offline.',
      updated_at: new Date().toISOString()
    };
    const ref = await col.add(defaultConfig);
    return { ...defaultConfig, id: ref.id };
  }
  const doc = snap.docs[0];
  return { ...doc.data(), id: doc.id };
}

async function updateKonfigurasi(id, data) {
  const docRef = db.collection('konfigurasi_sistem').doc(id);
  await docRef.set({
    tanggal_mulai_input: parseInt(data.tanggal_mulai_input, 10),
    tanggal_akhir_input: parseInt(data.tanggal_akhir_input, 10),
    notifikasi_tertutup: data.notifikasi_tertutup,
    updated_at: new Date().toISOString()
  }, { merge: true });
  return { success: true, message: 'Konfigurasi berhasil disimpan' };
}

async function cekPeriodeInput() {
  const config = await getKonfigurasi();
  const tanggalSekarang = new Date().getDate();
  const mulai = parseInt(config.tanggal_mulai_input, 10);
  const akhir = parseInt(config.tanggal_akhir_input, 10);
  return tanggalSekarang >= mulai && tanggalSekarang <= akhir;
}

// ============================================
// STATISTIK
// ============================================
async function getStatistikAdmin() {
  const clientsSnap = await db.collection('client').get();
  const clients = docsToArray(clientsSnap);

  const laporSnap = await db.collection('wajib_lapor').get();
  const laporList = docsToArray(laporSnap);

  const stat = {
    total_client: clients.length,
    client_aktif: clients.filter(c => c.status === 'aktif').length,
    lapor_menunggu: laporList.filter(l => l.status === 'menunggu_verifikasi').length,
    lapor_diterima: laporList.filter(l => l.status === 'diterima').length,
    lapor_ditolak: laporList.filter(l => l.status === 'ditolak').length,
    lapor_dibatalkan: laporList.filter(l => l.status === 'dibatalkan').length
  };

  return stat;
}

async function getStatistikClient(clientId) {
  const col = db.collection('wajib_lapor');
  const snap = await col.where('client_id', '==', clientId).get();
  const list = docsToArray(snap);

  return {
    lapor_menunggu: list.filter(l => l.status === 'menunggu_verifikasi').length,
    lapor_diterima: list.filter(l => l.status === 'diterima').length,
    lapor_ditolak: list.filter(l => l.status === 'ditolak').length
  };
}

module.exports = {
  logActivity,
  getAdminByUsername,
  getAdminById,
  loginAdmin,
  getClientByUsername,
  getClientByRegister,
  getClientById,
  loginClient,
  isProfilClientLengkap,
  updateProfilClient,
  createClient,
  updateClient,
  resetClientPassword,
  resetAdminPassword,
  deleteClient,
  deleteLapor,
  getAllClients,
  getLaporById,
  getLaporBulanIni,
  cekBisaInputLapor,
  saveDraftLapor,
  updateLaporPhoto,
  submitLapor,
  getRiwayatLaporClient,
  getInfoWajibLaporClient,
  getAllLaporAdmin,
  getLaporMenungguVerifikasi,
  terimaLapor,
  tolakLapor,
  batalkanLapor,
  getKonfigurasi,
  updateKonfigurasi,
  cekPeriodeInput,
  getStatistikAdmin,
  getStatistikClient
};
