const fs = require('fs');
const path = require('path');
const {
  getClientById,
  getInfoWajibLaporClient,
  getStatistikClient,
  getRiwayatLaporClient,
  getLaporBulanIni,
  getKonfigurasi,
  cekPeriodeInput,
  cekBisaInputLapor,
  saveDraftLapor,
  updateLaporPhoto,
  submitLapor,
  updateProfilClient
} = require('../models/db');
const { getNamaBulan, formatTanggal, getFileUrl } = require('../utils/helpers');
const { isCloudinaryConfigured, uploadFile, uploadBase64 } = require('../config/cloudinary');

async function getDashboard(req, res) {
  try {
    const clientId = req.session.user.id;
    const client = await getClientById(clientId);
    const infoWajib = await getInfoWajibLaporClient(clientId);
    const stat = await getStatistikClient(clientId);
    const riwayat = await getRiwayatLaporClient(clientId);
    const recentRiwayat = riwayat.slice(0, 5);

    const now = new Date();
    const bulanIni = now.getMonth() + 1;
    const tahunIni = now.getFullYear();

    const laporBulanIni = await getLaporBulanIni(clientId, bulanIni, tahunIni);
    const config = await getKonfigurasi();
    const periodeAktif = await cekPeriodeInput();
    const bisaInput = (await cekBisaInputLapor(clientId)) && periodeAktif;

    res.render('client/dashboard', {
      pageTitle: 'Dashboard Client - BAPAS Medan',
      client,
      infoWajib,
      stat,
      riwayat: recentRiwayat,
      laporBulanIni,
      config,
      periodeAktif,
      bisaInput,
      bulanIni,
      tahunIni,
      namaBulanIni: getNamaBulan(bulanIni),
      formatTanggal,
      getNamaBulan
    });
  } catch (err) {
    console.error('Error client dashboard:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

async function postLaporBaru(req, res) {
  try {
    const clientId = req.session.user.id;
    const action = req.body.action || 'draft';
    const now = new Date();
    const bulan = parseInt(req.body.bulan, 10) || now.getMonth() + 1;
    const tahun = parseInt(req.body.tahun, 10) || now.getFullYear();

    const bisaInput = await cekBisaInputLapor(clientId);
    if (!bisaInput) {
      req.session.errorMessage = 'Anda sudah mengirimkan laporan untuk periode bulan ini.';
      return res.redirect('/client/dashboard');
    }

    const draftResult = await saveDraftLapor(clientId, {
      bulan,
      tahun,
      aktivitas_harian: req.body.aktivitas_harian || '',
      rencana_mendatang: req.body.rencana_mendatang || ''
    });

    if (!draftResult.success) {
      req.session.errorMessage = draftResult.message;
      return res.redirect('/client/dashboard');
    }

    const laporId = draftResult.id;

    if (action === 'submit') {
      const submitResult = await submitLapor(clientId, laporId);
      if (submitResult.success) {
        req.session.successMessage = submitResult.message;
      } else {
        req.session.errorMessage = submitResult.message;
      }
    } else {
      req.session.successMessage = 'Draft laporan berhasil disimpan. Anda dapat melanjutkannya kapan saja.';
    }

    return res.redirect('/client/dashboard');
  } catch (err) {
    console.error('Error post lapor baru:', err);
    req.session.errorMessage = 'Gagal menyimpan laporan: ' + err.message;
    return res.redirect('/client/dashboard');
  }
}

async function postUploadFoto(req, res) {
  try {
    const clientId = req.session.user.id;
    const now = new Date();
    const bulan = parseInt(req.body.bulan, 10) || now.getMonth() + 1;
    const tahun = parseInt(req.body.tahun, 10) || now.getFullYear();
    const action = req.body.action || 'upload'; // 'upload' atau 'capture'

    // Pastikan draft lapor tersedia
    let existingLapor = await getLaporBulanIni(clientId, bulan, tahun);
    let laporId = existingLapor ? existingLapor.id : null;

    if (!laporId) {
      const draftResult = await saveDraftLapor(clientId, {
        bulan,
        tahun,
        aktivitas_harian: '',
        rencana_mendatang: ''
      });
      laporId = draftResult.id;
    }

    let savedPathOrUrl = '';

    if (action === 'capture' && req.body.foto_base64) {
      if (isCloudinaryConfigured()) {
        try {
          const cldRes = await uploadBase64(req.body.foto_base64, {
            folder: `bapas_medan/wajib_lapor/${tahun}/${String(bulan).padStart(2, '0')}`,
            public_id: `lapor_${clientId}_${Date.now()}`
          });
          savedPathOrUrl = cldRes.secure_url;
        } catch (cldErr) {
          console.warn('⚠️ Gagal upload ke Cloudinary, fallback ke penyimpanan lokal:', cldErr.message);
        }
      }

      // Fallback lokal jika Cloudinary belum aktif atau gagal
      if (!savedPathOrUrl) {
        const yearFolder = String(tahun);
        const monthFolder = String(bulan).padStart(2, '0');
        const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
        const uploadDir = isServerless
          ? path.join(require('os').tmpdir(), 'bapas_uploads', 'wajib_lapor', yearFolder, monthFolder)
          : path.join(process.cwd(), 'public', 'uploads', 'wajib_lapor', yearFolder, monthFolder);

        try {
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const base64Data = req.body.foto_base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `lapor_${clientId}_${Date.now()}_cam.jpg`;
          const fullPath = path.join(uploadDir, filename);
          fs.writeFileSync(fullPath, buffer);
          savedPathOrUrl = `${yearFolder}/${monthFolder}/${filename}`;
        } catch (e) {
          console.warn('Fallback disk write warning:', e.message);
          savedPathOrUrl = 'camera_capture_placeholder.jpg';
        }
      }
    } else if (req.file) {
      if (isCloudinaryConfigured()) {
        try {
          const cldRes = await uploadFile(req.file.path, {
            folder: `bapas_medan/wajib_lapor/${tahun}/${String(bulan).padStart(2, '0')}`,
            public_id: `lapor_${clientId}_${Date.now()}`,
            resource_type: 'auto'
          });
          savedPathOrUrl = cldRes.secure_url;
        } catch (cldErr) {
          console.warn('⚠️ Gagal upload ke Cloudinary, fallback ke penyimpanan lokal:', cldErr.message);
        }
      }

      // Fallback lokal jika Cloudinary belum aktif atau gagal
      if (!savedPathOrUrl) {
        const yearFolder = String(tahun);
        const monthFolder = String(bulan).padStart(2, '0');
        savedPathOrUrl = `${yearFolder}/${monthFolder}/${req.file.filename}`;
      }
    } else {
      return res.status(400).json({ success: false, message: 'Tidak ada data foto/video yang diterima' });
    }

    await updateLaporPhoto(laporId, savedPathOrUrl);

    const fullUrl = getFileUrl(savedPathOrUrl, 'wajib_lapor');

    return res.json({
      success: true,
      message: 'Foto/video bukti berhasil diunggah',
      lapor_id: laporId,
      foto_url: fullUrl,
      path: savedPathOrUrl
    });
  } catch (err) {
    console.error('Error upload foto:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengunggah foto/video: ' + err.message });
  }
}

async function getProfil(req, res) {
  try {
    const clientId = req.session.user.id;
    const client = await getClientById(clientId);
    const belumLengkap = req.query.belum_lengkap === '1';

    res.render('client/profil', {
      pageTitle: 'Profil Client - BAPAS Medan',
      client,
      belumLengkap,
      formatTanggal
    });
  } catch (err) {
    console.error('Error profil client:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

async function postProfil(req, res) {
  try {
    const clientId = req.session.user.id;
    let fotoRelatif = null;

    if (req.file) {
      if (isCloudinaryConfigured()) {
        try {
          const cldRes = await uploadFile(req.file.path, {
            folder: `bapas_medan/profil/${clientId}`,
            public_id: `profil_${clientId}_${Date.now()}`,
            resource_type: 'image'
          });
          fotoRelatif = cldRes.secure_url;
        } catch (cldErr) {
          console.warn('⚠️ Gagal upload foto profil ke Cloudinary, fallback ke lokal:', cldErr.message);
          fotoRelatif = `${clientId}/${req.file.filename}`;
        }
      } else {
        fotoRelatif = `${clientId}/${req.file.filename}`;
      }
    }

    const result = await updateProfilClient(clientId, req.body, fotoRelatif);

    if (result.success) {
      req.session.user.nama_lengkap = req.body.nama_lengkap;
      req.session.user.profil_lengkap = 1;
      if (fotoRelatif) {
        req.session.user.foto_profil = fotoRelatif;
      }
      req.session.successMessage = 'Profil Anda berhasil disimpan!';
      return res.redirect('/client/dashboard');
    } else {
      req.session.errorMessage = result.message;
      return res.redirect('/client/profil');
    }
  } catch (err) {
    console.error('Error update profil client:', err);
    req.session.errorMessage = 'Gagal menyimpan profil: ' + err.message;
    return res.redirect('/client/profil');
  }
}

async function getRiwayatLapor(req, res) {
  try {
    const clientId = req.session.user.id;
    const client = await getClientById(clientId);
    let riwayat = await getRiwayatLaporClient(clientId);

    // Filter status & tahun
    const filterStatus = req.query.status || 'all';
    const filterTahun = req.query.tahun || 'all';

    if (filterStatus !== 'all') {
      riwayat = riwayat.filter(r => r.status === filterStatus);
    }
    if (filterTahun !== 'all') {
      riwayat = riwayat.filter(r => String(r.tahun) === filterTahun);
    }

    res.render('client/riwayat_lapor', {
      pageTitle: 'Riwayat Wajib Lapor - BAPAS Medan',
      client,
      riwayat,
      filterStatus,
      filterTahun,
      getNamaBulan,
      formatTanggal
    });
  } catch (err) {
    console.error('Error riwayat client:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

async function getJadwalLapor(req, res) {
  try {
    const clientId = req.session.user.id;
    const client = await getClientById(clientId);
    const infoWajib = await getInfoWajibLaporClient(clientId);
    const config = await getKonfigurasi();

    res.render('client/jadwal_lapor', {
      pageTitle: 'Jadwal & Durasi Wajib Lapor - BAPAS Medan',
      client,
      infoWajib,
      config,
      getNamaBulan
    });
  } catch (err) {
    console.error('Error jadwal client:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

module.exports = {
  getDashboard,
  postLaporBaru,
  postUploadFoto,
  getProfil,
  postProfil,
  getRiwayatLapor,
  getJadwalLapor
};
