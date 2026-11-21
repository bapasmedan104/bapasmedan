const {
  getStatistikAdmin,
  getLaporMenungguVerifikasi,
  getAllLaporAdmin,
  getAllClients,
  getClientById,
  getLaporById,
  createClient,
  updateClient,
  resetClientPassword,
  resetAdminPassword,
  deleteClient,
  deleteLapor,
  terimaLapor,
  tolakLapor,
  batalkanLapor,
  getKonfigurasi,
  updateKonfigurasi,
  getAllPesanBantuan,
  balasPesanBantuanAdmin,
  akhiriPesanBantuanAdmin,
  getAllAdmins,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  toggleAdminUserStatus,
  deleteAdminUser
} = require('../models/db');
const { invalidateConfigCache } = require('../middlewares/auth');
const { getNamaBulan, formatTanggal, formatTanggalWaktu, getFileUrl, getWibNow } = require('../utils/helpers');

async function getDashboard(req, res) {
  try {
    const tab = req.query.tab || 'overview';
    const currentAdmin = req.session.adminUser || req.session.user;
    const stat = await getStatistikAdmin(currentAdmin);
    const laporMenunggu = await getLaporMenungguVerifikasi(currentAdmin);
    const recentClients = await getAllClients({}, currentAdmin);
    const config = await getKonfigurasi();
    const pesanBantuan = await getAllPesanBantuan(50);

    res.render('admin/dashboard', {
      pageTitle: 'Dashboard Admin - BAPAS Medan',
      activeTab: tab,
      stat,
      laporMenunggu,
      clients: recentClients.slice(0, 10),
      config,
      pesanBantuan: pesanBantuan || [],
      currentAdmin,
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
    const currentAdmin = req.session.adminUser || req.session.user;
    const filters = {
      status: req.query.status || 'all',
      pos_wilayah: req.query.pos_wilayah || 'all',
      client: req.query.client || '',
      bulan: req.query.bulan || 'all',
      tahun: req.query.tahun || 'all',
      date_start: req.query.date_start || '',
      date_end: req.query.date_end || '',
      foto: req.query.foto || 'all',
      sort: req.query.sort || 'tanggal_submit_desc'
    };

    const laporList = await getAllLaporAdmin(filters, currentAdmin);
    const globalStat = await getStatistikAdmin(currentAdmin);

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
    const currentYear = getWibNow().year;
    const availableYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, 2024, 2023];

    res.render('admin/riwayat_lapor', {
      pageTitle: 'Riwayat Wajib Lapor - Admin BAPAS Medan',
      currentAdmin: req.session.adminUser,
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
    const currentAdmin = req.session.adminUser || req.session.user;
    const filters = {
      status: req.query.status || 'all',
      pos_wilayah: req.query.pos_wilayah || 'all',
      client: req.query.client || '',
      bulan: req.query.bulan || 'all',
      tahun: req.query.tahun || 'all',
      date_start: req.query.date_start || '',
      date_end: req.query.date_end || '',
      foto: req.query.foto || 'all',
      sort: req.query.sort || 'tanggal_submit_desc'
    };

    const laporList = await getAllLaporAdmin(filters, currentAdmin);

    // Generate CSV Header & Rows
    let csv = '\uFEFF'; // BOM untuk UTF-8 di Excel
    csv += 'No,Nama Klien,No Register,Pos Wilayah,Periode Bulan,Periode Tahun,Tanggal Submit,Status,Foto Bukti,Verifikator,Catatan Admin\n';

    laporList.forEach((item, index) => {
      const nama = `"${(item.nama_lengkap || '').replace(/"/g, '""')}"`;
      const noReg = `"${(item.no_register || '').replace(/"/g, '""')}"`;
      const pos = `"${(item.pos_wilayah || 'Pusat').replace(/"/g, '""')}"`;
      const bulan = `"${getNamaBulan(item.bulan)}"`;
      const tahun = `"${item.tahun}"`;
      const tglSubmit = `"${formatTanggalWaktu(item.tanggal_submit)}"`;
      const status = `"${item.status}"`;
      const foto = `"${item.foto_bukti ? 'Ada' : 'Tidak Ada'}"`;
      const adminVerif = `"${(item.admin_verifikasi || '-').replace(/"/g, '""')}"`;
      const catatan = `"${(item.catatan_admin || '-').replace(/"/g, '""')}"`;

      csv += `${index + 1},${nama},${noReg},${pos},${bulan},${tahun},${tglSubmit},${status},${foto},${adminVerif},${catatan}\n`;
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
    const currentAdmin = req.session.adminUser || req.session.user;
    const filterOptions = {
      status: req.query.status || 'all',
      pos_wilayah: req.query.pos_wilayah || 'all',
      profil_lengkap: req.query.profil_lengkap || 'all',
      search: req.query.search || ''
    };

    const clients = await getAllClients(filterOptions, currentAdmin);
    const allClients = await getAllClients({}, currentAdmin); // Untuk statistik total khusus pos ini

    const stat = {
      total: allClients.length,
      aktif: allClients.filter(c => c.status === 'aktif').length,
      selesai: allClients.filter(c => c.status === 'selesai').length,
      nonaktif: allClients.filter(c => c.status === 'nonaktif').length,
      profilLengkap: allClients.filter(c => Boolean(c.profil_lengkap)).length
    };

    res.render('admin/kelola_client', {
      pageTitle: 'Kelola Client - BAPAS Medan',
      currentAdmin,
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
    const currentAdmin = req.session.adminUser || req.session.user;
    const clients = await getAllClients({
      status: req.query.status || 'all',
      pos_wilayah: req.query.pos_wilayah || 'all',
      profil_lengkap: req.query.profil_lengkap || 'all',
      search: req.query.search || ''
    }, currentAdmin);

    let csv = '\uFEFF';
    csv += 'No,Username,Nama Lengkap,No Register,Pos Wilayah,No Telepon,Status,Masa Wajib Lapor,Total Bulan,Profil Lengkap,Tanggal Dibuat\n';

    clients.forEach((c, idx) => {
      const uname = `"${(c.username || '').replace(/"/g, '""')}"`;
      const nama = `"${(c.nama_lengkap || '').replace(/"/g, '""')}"`;
      const reg = `"${(c.no_register || '').replace(/"/g, '""')}"`;
      const pos = `"${(c.pos_wilayah || 'Semua Wilayah (Pusat)').replace(/"/g, '""')}"`;
      const telp = `"${(c.no_telepon || '').replace(/"/g, '""')}"`;
      const status = `"${c.status}"`;
      const masa = `"${getNamaBulan(c.bulan_wajib_lapor_mulai)} ${c.tahun_wajib_lapor_mulai} s/d ${getNamaBulan(c.bulan_wajib_lapor_akhir)} ${c.tahun_wajib_lapor_akhir}"`;
      const total = `"${c.total_bulan_wajib_lapor || 12} Bulan"`;
      const profil = `"${c.profil_lengkap ? 'Lengkap' : 'Belum Lengkap'}"`;
      const created = `"${formatTanggal(c.created_at)}"`;

      csv += `${idx + 1},${uname},${nama},${reg},${pos},${telp},${status},${masa},${total},${profil},${created}\n`;
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
    const adminUser = req.session.adminUser || req.session.user;
    const result = await createClient(req.body, adminUser.id, adminUser);
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
    const adminUser = req.session.adminUser || req.session.user;
    const clientId = req.body.client_id;
    const result = await updateClient(clientId, req.body, adminUser.id, adminUser);
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

async function postResetClientPassword(req, res) {
  try {
    const adminId = req.session.user.id;
    const clientId = req.body.client_id;
    const newPassword = req.body.new_password;
    const result = await resetClientPassword(clientId, newPassword, adminId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal mereset kata sandi klien: ' + err.message;
  }
  res.redirect('/admin/kelola-client');
}

async function postResetAdminPassword(req, res) {
  try {
    const adminId = req.session.user.id;
    const newPassword = req.body.new_password;
    const result = await resetAdminPassword(adminId, newPassword);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal mereset kata sandi administrator: ' + err.message;
  }
  const redirectUrl = req.headers.referer || '/admin/dashboard';
  res.redirect(redirectUrl);
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
    const catatan = req.body.catatan_admin || req.body.alasan_penolakan || req.body.alasan;
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

async function postDeleteLapor(req, res) {
  try {
    const adminId = req.session.user.id;
    const laporId = req.body.lapor_id;
    const result = await deleteLapor(laporId, adminId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal menghapus laporan: ' + err.message;
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
      notifikasi_tertutup: req.body.notifikasi_tertutup,
      teks_pengumuman: req.body.teks_pengumuman,
      status_layanan: req.body.status_layanan
    });
    if (result.success) {
      if (typeof invalidateConfigCache === 'function') {
        invalidateConfigCache();
      }
      req.session.successMessage = 'Pengumuman dan periode wajib lapor online berhasil diperbarui & langsung tampil di web utama!';
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal memperbarui konfigurasi: ' + err.message;
  }
  res.redirect('/admin/dashboard?tab=overview');
}

async function postBalasPesanBantuan(req, res) {
  try {
    const { session_id, pesan, reply_to } = req.body;
    if (!session_id || !pesan || !pesan.trim()) {
      return res.status(400).json({ success: false, message: 'Session ID dan Pesan balasan wajib diisi.' });
    }
    const adminName = req.session && req.session.adminUser ? req.session.adminUser.nama_lengkap : 'Petugas CS BAPAS Medan';
    const result = await balasPesanBantuanAdmin(session_id, pesan.trim(), adminName, reply_to || null);
    return res.json({ success: true, message: 'Balasan berhasil dikirim ke pengguna.', data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal membalas pesan: ' + err.message });
  }
}

async function postAkhiriPesanBantuanAdmin(req, res) {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Session ID wajib diisi.' });
    }
    const adminName = req.session && req.session.adminUser ? req.session.adminUser.nama_lengkap : 'Petugas CS BAPAS Medan';
    const result = await akhiriPesanBantuanAdmin(session_id, adminName);
    return res.json({ success: true, message: 'Percakapan berhasil diakhiri oleh petugas CS.', data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengakhiri percakapan: ' + err.message });
  }
}

async function getPusatBantuanListJson(req, res) {
  try {
    const list = await getAllPesanBantuan(100);
    return res.json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getDetailLaporJson(req, res) {
  try {
    const laporId = req.params.id;
    const lapor = await getLaporById(laporId);
    if (!lapor) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    const fotoUrl = lapor.foto_bukti ? getFileUrl(lapor.foto_bukti, 'wajib_lapor') : '';

    return res.json({
      success: true,
      data: {
        ...lapor,
        foto_url: fotoUrl,
        nama_bulan: getNamaBulan(lapor.bulan),
        tanggal_submit_formatted: formatTanggalWaktu(lapor.tanggal_submit),
        verified_at_formatted: formatTanggalWaktu(lapor.verified_at)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getKelolaAdmin(req, res) {
  try {
    const adminList = await getAllAdmins();
    const stat = {
      total_admin: adminList.length,
      total_aktif: adminList.filter(a => a.status === 'aktif').length,
      total_pos: adminList.filter(a => a.role === 'admin_pos').length
    };

    res.render('admin/kelola_admin', {
      pageTitle: 'Kelola Akun Admin & Petugas Pos - BAPAS Medan',
      adminList,
      stat,
      currentAdmin: req.session.adminUser,
      formatTanggalWaktu
    });
  } catch (err) {
    console.error('Error kelola admin:', err);
    res.status(500).send('Terjadi kesalahan pada sistem saat memuat data admin: ' + err.message);
  }
}

async function postCreateAdminUser(req, res) {
  try {
    const result = await createAdminUser(req.body);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal membuat akun admin: ' + err.message;
  }
  res.redirect('/admin/kelola-admin');
}

async function postUpdateAdminUser(req, res) {
  try {
    const adminId = req.body.admin_id;
    const result = await updateAdminUser(adminId, req.body);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal memperbarui data admin: ' + err.message;
  }
  res.redirect('/admin/kelola-admin');
}

async function postResetAdminUserPassword(req, res) {
  try {
    const { admin_id, new_password } = req.body;
    const result = await resetAdminUserPassword(admin_id, new_password);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal mereset kata sandi: ' + err.message;
  }
  res.redirect('/admin/kelola-admin');
}

async function postToggleAdminUserStatus(req, res) {
  try {
    const adminId = req.body.admin_id;
    const requesterId = req.session && req.session.user ? req.session.user.id : null;
    const result = await toggleAdminUserStatus(adminId, requesterId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal mengubah status admin: ' + err.message;
  }
  res.redirect('/admin/kelola-admin');
}

async function postDeleteAdminUser(req, res) {
  try {
    const adminId = req.body.admin_id;
    const requesterId = req.session && req.session.user ? req.session.user.id : null;
    const result = await deleteAdminUser(adminId, requesterId);
    if (result.success) {
      req.session.successMessage = result.message;
    } else {
      req.session.errorMessage = result.message;
    }
  } catch (err) {
    req.session.errorMessage = 'Gagal menghapus admin: ' + err.message;
  }
  res.redirect('/admin/kelola-admin');
}

module.exports = {
  getDashboard,
  getRiwayatLapor,
  getExportLaporCsv,
  getKelolaClient,
  getExportClientsCsv,
  getKelolaAdmin,
  postCreateAdminUser,
  postUpdateAdminUser,
  postResetAdminUserPassword,
  postToggleAdminUserStatus,
  postDeleteAdminUser,
  postCreateClient,
  postUpdateClient,
  postResetClientPassword,
  postResetAdminPassword,
  postDeleteClient,
  postTerimaLapor,
  postTolakLapor,
  postBatalkanLapor,
  postDeleteLapor,
  postUpdateKonfigurasi,
  getDetailLaporJson,
  postBalasPesanBantuan,
  postAkhiriPesanBantuanAdmin,
  getPusatBantuanListJson
};
