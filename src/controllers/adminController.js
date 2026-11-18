const {
  getStatistikAdmin,
  getLaporMenungguVerifikasi,
  getAllLaporAdmin,
  getAllClients,
  getClientById,
  getLaporById,
  createClient,
  updateClient,
  deleteClient,
  terimaLapor,
  tolakLapor,
  batalkanLapor,
  getKonfigurasi,
  updateKonfigurasi
} = require('../models/db');
const { getNamaBulan, formatTanggal, formatTanggalWaktu } = require('../utils/helpers');

async function getDashboard(req, res) {
  try {
    const tab = req.query.tab || 'overview';
    const stat = await getStatistikAdmin();
    const laporMenunggu = await getLaporMenungguVerifikasi();
    const recentClients = await getAllClients();
    const config = await getKonfigurasi();

    res.render('admin/dashboard', {
      pageTitle: 'Dashboard Admin - BAPAS Medan',
      activeTab: tab,
      stat,
      laporMenunggu,
      clients: recentClients.slice(0, 10),
      config,
      getNamaBulan,
      formatTanggal,
      formatTanggalWaktu
    });
  } catch (err) {
    console.error('Error admin dashboard:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

async function getRiwayatLapor(req, res) {
  try {
    const filters = {
      status: req.query.status || 'all',
      client: req.query.client || '',
      bulan: req.query.bulan || 'all',
      tahun: req.query.tahun || 'all',
      date_start: req.query.date_start || '',
      date_end: req.query.date_end || '',
      foto: req.query.foto || 'all',
      sort: req.query.sort || 'tanggal_submit_desc'
    };

    const laporList = await getAllLaporAdmin(filters);
    const globalStat = await getStatistikAdmin();

    // Statistik lokal sesuai data yang terfilter saat ini
    const filterStat = {
      total: laporList.length,
      menunggu: laporList.filter(l => l.status === 'menunggu_verifikasi').length,
      diterima: laporList.filter(l => l.status === 'diterima').length,
      ditolak: laporList.filter(l => l.status === 'ditolak').length,
      dibatalkan: laporList.filter(l => l.status === 'dibatalkan').length,
      adaFoto: laporList.filter(l => Boolean(l.foto_bukti)).length
    };

    // Daftar tahun yang ada dalam data untuk dropdown filter
    const currentYear = new Date().getFullYear();
    const availableYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, 2024, 2023];

    res.render('admin/riwayat_lapor', {
      pageTitle: 'Riwayat Wajib Lapor - Admin BAPAS Medan',
      laporList,
      filters,
      globalStat,
      filterStat,
      availableYears,
      getNamaBulan,
      formatTanggal,
      formatTanggalWaktu
    });
  } catch (err) {
    console.error('Error admin riwayat lapor:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

async function getExportLaporCsv(req, res) {
  try {
    const filters = {
      status: req.query.status || 'all',
      client: req.query.client || '',
      bulan: req.query.bulan || 'all',
      tahun: req.query.tahun || 'all',
      date_start: req.query.date_start || '',
      date_end: req.query.date_end || '',
      foto: req.query.foto || 'all',
      sort: req.query.sort || 'tanggal_submit_desc'
    };

    const laporList = await getAllLaporAdmin(filters);

    // Generate CSV Header & Rows
    let csv = '\uFEFF'; // BOM untuk UTF-8 di Excel
    csv += 'No,Nama Klien,No Register,Periode Bulan,Periode Tahun,Tanggal Submit,Status,Foto Bukti,Verifikator,Catatan Admin\n';

    laporList.forEach((item, index) => {
      const nama = `"${(item.nama_lengkap || '').replace(/"/g, '""')}"`;
      const noReg = `"${(item.no_register || '').replace(/"/g, '""')}"`;
      const bulan = `"${getNamaBulan(item.bulan)}"`;
      const tahun = `"${item.tahun}"`;
      const tglSubmit = `"${formatTanggalWaktu(item.tanggal_submit)}"`;
      const status = `"${item.status}"`;
      const foto = `"${item.foto_bukti ? 'Ada' : 'Tidak Ada'}"`;
      const adminVerif = `"${(item.admin_verifikasi || '-').replace(/"/g, '""')}"`;
      const catatan = `"${(item.catatan_admin || '-').replace(/"/g, '""')}"`;

      csv += `${index + 1},${nama},${noReg},${bulan},${tahun},${tglSubmit},${status},${foto},${adminVerif},${catatan}\n`;
    });

    const filename = `Rekap_Wajib_Lapor_BAPAS_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('Error export CSV:', err);
    res.status(500).send('Gagal membuat file export.');
  }
}

async function getKelolaClient(req, res) {
  try {
    const filterOptions = {
      status: req.query.status || 'all',
      profil_lengkap: req.query.profil_lengkap || 'all',
      search: req.query.search || ''
    };

    const clients = await getAllClients(filterOptions);
    const allClients = await getAllClients({}); // Untuk statistik total

    const stat = {
      total: allClients.length,
      aktif: allClients.filter(c => c.status === 'aktif').length,
      selesai: allClients.filter(c => c.status === 'selesai').length,
      nonaktif: allClients.filter(c => c.status === 'nonaktif').length,
      profilLengkap: allClients.filter(c => Boolean(c.profil_lengkap)).length
    };

    res.render('admin/kelola_client', {
      pageTitle: 'Kelola Client - BAPAS Medan',
      clients,
      filterOptions,
      stat,
      getNamaBulan,
      formatTanggal
    });
  } catch (err) {
    console.error('Error admin kelola client:', err);
    res.status(500).send('Terjadi kesalahan pada sistem.');
  }
}

async function getExportClientsCsv(req, res) {
  try {
    const clients = await getAllClients({
      status: req.query.status || 'all',
      profil_lengkap: req.query.profil_lengkap || 'all',
      search: req.query.search || ''
    });

    let csv = '\uFEFF';
    csv += 'No,Username,Nama Lengkap,No Register,No Telepon,Status,Masa Wajib Lapor,Total Bulan,Profil Lengkap,Tanggal Dibuat\n';

    clients.forEach((c, idx) => {
      const uname = `"${(c.username || '').replace(/"/g, '""')}"`;
      const nama = `"${(c.nama_lengkap || '').replace(/"/g, '""')}"`;
      const reg = `"${(c.no_register || '').replace(/"/g, '""')}"`;
      const telp = `"${(c.no_telepon || '').replace(/"/g, '""')}"`;
      const status = `"${c.status}"`;
      const masa = `"${getNamaBulan(c.bulan_wajib_lapor_mulai)} ${c.tahun_wajib_lapor_mulai} s/d ${getNamaBulan(c.bulan_wajib_lapor_akhir)} ${c.tahun_wajib_lapor_akhir}"`;
      const total = `"${c.total_bulan_wajib_lapor || 12} Bulan"`;
      const profil = `"${c.profil_lengkap ? 'Lengkap' : 'Belum Lengkap'}"`;
      const created = `"${formatTanggal(c.created_at)}"`;

      csv += `${idx + 1},${uname},${nama},${reg},${telp},${status},${masa},${total},${profil},${created}\n`;
    });

    const filename = `Daftar_Klien_BAPAS_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('Error export clients CSV:', err);
    res.status(500).send('Gagal membuat file export.');
  }
}

async function postCreateClient(req, res) {
  try {
    const adminId = req.session.user.id;
    const result = await createClient(req.body, adminId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal menambahkan client: ' + err.message;
  }
  res.redirect('/admin/kelola-client');
}

async function postUpdateClient(req, res) {
  try {
    const adminId = req.session.user.id;
    const clientId = req.body.client_id;
    const result = await updateClient(clientId, req.body, adminId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal mengupdate client: ' + err.message;
  }
  res.redirect('/admin/kelola-client');
}

async function postDeleteClient(req, res) {
  try {
    const adminId = req.session.user.id;
    const clientId = req.body.client_id;
    const result = await deleteClient(clientId, adminId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal menghapus client: ' + err.message;
  }
  res.redirect('/admin/kelola-client');
}

async function postTerimaLapor(req, res) {
  try {
    const adminId = req.session.user.id;
    const laporId = req.body.lapor_id;
    const result = await terimaLapor(laporId, adminId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal menerima lapor: ' + err.message;
  }

  const redirectUrl = req.body.redirect_to || '/admin/dashboard?tab=lapor';
  res.redirect(redirectUrl);
}

async function postTolakLapor(req, res) {
  try {
    const adminId = req.session.user.id;
    const laporId = req.body.lapor_id;
    const catatan = req.body.catatan_admin;
    const result = await tolakLapor(laporId, adminId, catatan);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal menolak lapor: ' + err.message;
  }

  const redirectUrl = req.body.redirect_to || '/admin/dashboard?tab=lapor';
  res.redirect(redirectUrl);
}

async function postBatalkanLapor(req, res) {
  try {
    const adminId = req.session.user.id;
    const laporId = req.body.lapor_id;
    const catatan = req.body.catatan_admin;
    const result = await batalkanLapor(laporId, adminId, catatan);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal membatalkan lapor: ' + err.message;
  }

  const redirectUrl = req.body.redirect_to || '/admin/riwayat-lapor';
  res.redirect(redirectUrl);
}

async function postUpdateKonfigurasi(req, res) {
  try {
    const configId = req.body.config_id;
    const result = await updateKonfigurasi(configId, {
      tanggal_mulai_input: req.body.tanggal_mulai_input,
      tanggal_akhir_input: req.body.tanggal_akhir_input,
      notifikasi_tertutup: req.body.notifikasi_tertutup
    });
    if (result.success) {
      req.session.successMessage = 'Konfigurasi sistem berhasil diperbarui.';
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal memperbarui konfigurasi: ' + err.message;
  }
  res.redirect('/admin/dashboard?tab=overview');
}

async function getDetailLaporJson(req, res) {
  try {
    const laporId = req.params.id;
    const lapor = await getLaporById(laporId);
    if (!lapor) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    return res.json({
      success: true,
      data: {
        ...lapor,
        nama_bulan: getNamaBulan(lapor.bulan),
        tanggal_submit_formatted: formatTanggalWaktu(lapor.tanggal_submit),
        verified_at_formatted: formatTanggalWaktu(lapor.verified_at)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getDashboard,
  getRiwayatLapor,
  getExportLaporCsv,
  getKelolaClient,
  getExportClientsCsv,
  postCreateClient,
  postUpdateClient,
  postDeleteClient,
  postTerimaLapor,
  postTolakLapor,
  postBatalkanLapor,
  postUpdateKonfigurasi,
  getDetailLaporJson
};
