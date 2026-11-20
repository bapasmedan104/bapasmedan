/**
 * Public Controller
 * Mengelola halaman publik dengan optimasi SEO & Metadata
 */

const {
  kirimPesanBantuan,
  getPesanBantuanBySession,
  getClientByRegister
} = require('../models/db');
const { getNamaBulan } = require('../utils/helpers');

function getHomePage(req, res) {
  res.render('public/beranda', {
    pageTitle: 'BAPAS 1 MEDAN',
    pageDescription: 'Situs Resmi Balai Pemasyarakatan (BAPAS) Kelas I Medan, Kementerian Imigrasi dan Pemasyarakatan RI. Layanan Wajib Lapor Klien Online, pembimbingan kemasyarakatan terintegrasi, transparan, dan profesional.',
    pageKeywords: 'BAPAS Medan, Balai Pemasyarakatan Kelas I Medan, Wajib Lapor Online, Klien Pemasyarakatan, Pembimbing Kemasyarakatan, Kemenimipas, Litmas, Asimilasi, Pembebasan Bersyarat, CB, CMB, PB',
    canonicalUrl: '/',
    activePage: 'beranda',
    sub: ''
  });
}

function getBeritaPage(req, res) {
  const sub = req.query.sub || 'berita-utama';
  const titleMap = {
    'berita-utama': 'Berita Utama & Kegiatan',
    'berita-terkini': 'Kabar & Informasi Terkini'
  };
  const title = titleMap[sub] || 'Berita';

  res.render('public/berita', {
    pageTitle: `${title} - BAPAS Kelas I Medan`,
    pageDescription: `Informasi dan warta kegiatan resmi Balai Pemasyarakatan Kelas I Medan terkait pembimbingan klien pemasyarakatan, bakti sosial, dan program integrasi sosial.`,
    pageKeywords: 'berita bapas medan, kegiatan bapas kelas 1 medan, pembimbingan kemasyarakatan sumut, kemenimipas sumut',
    canonicalUrl: `/berita${sub ? '?sub=' + sub : ''}`,
    activePage: 'berita',
    sub
  });
}

function getProfilPage(req, res) {
  const sub = req.query.sub || 'profil-pejabat';
  const titleMap = {
    'profil-pejabat': 'Profil Pejabat Struktural',
    'sejarah-bapas': 'Sejarah Singkat',
    'tugas-fungsi': 'Tugas Pokok & Fungsi',
    'visi-misi': 'Visi & Misi',
    'struktur-organisasi': 'Struktur Organisasi'
  };
  const title = titleMap[sub] || 'Profil';

  res.render('public/profil', {
    pageTitle: `${title} - Profil BAPAS Kelas I Medan`,
    pageDescription: `Profil lengkap Balai Pemasyarakatan Kelas I Medan: Visi, Misi, Sejarah, Tugas & Fungsi, serta Struktur Organisasi Pejabat Struktural BAPAS Medan.`,
    pageKeywords: 'profil bapas medan, pejabat bapas kelas 1 medan, visi misi bapas medan, sejarah bapas medan',
    canonicalUrl: `/profil${sub ? '?sub=' + sub : ''}`,
    activePage: 'profil',
    sub
  });
}

function getInformasiPage(req, res) {
  const sub = req.query.sub || 'layanan-integrasi';
  const titleMap = {
    'layanan-integrasi': 'Layanan Integrasi Pemasyarakatan',
    'alur-serah-terima': 'Alur Serah Terima Klien',
    'alur-wajib-lapor': 'Alur & Tata Cara Wajib Lapor Online',
    'informasi-lkip': 'Laporan Kinerja Instansi Pemerintah (LKIP)',
    'laporan-keuangan': 'Laporan Keuangan & Akuntabilitas'
  };
  const title = titleMap[sub] || 'Informasi Publik';

  res.render('public/informasi', {
    pageTitle: `${title} - Informasi Publik BAPAS Medan`,
    pageDescription: `Pusat informasi publik dan panduan layanan Balai Pemasyarakatan Kelas I Medan, meliputi alur serah terima klien, tata cara wajib lapor digital, serta laporan kinerja (LKIP).`,
    pageKeywords: 'alur wajib lapor bapas medan, layanan integrasi pb cb cmb, lkip bapas medan, alur serah terima klien pemasyarakatan',
    canonicalUrl: `/informasi${sub ? '?sub=' + sub : ''}`,
    activePage: 'informasi',
    sub
  });
}

function getPrivasiPage(req, res) {
  res.render('public/privasi', {
    pageTitle: 'Kebijakan Privasi - Balai Pemasyarakatan Kelas I Medan',
    pageDescription: 'Kebijakan Privasi resmi Balai Pemasyarakatan Kelas I Medan mengenai pelindungan data pribadi klien pemasyarakatan dan tata kelola informasi wajib lapor online.',
    pageKeywords: 'kebijakan privasi bapas medan, pelindungan data pribadi klien pemasyarakatan, kerahasiaan wajib lapor bapas',
    canonicalUrl: '/privasi',
    activePage: 'privasi',
    sub: '',
    tahunBerlaku: new Date().getFullYear()
  });
}

function getSyaratKetentuanPage(req, res) {
  res.render('public/syarat_ketentuan', {
    pageTitle: 'Syarat & Ketentuan - Balai Pemasyarakatan Kelas I Medan',
    pageDescription: 'Syarat dan Ketentuan resmi penggunaan sistem informasi dan portal wajib lapor online Balai Pemasyarakatan Kelas I Medan.',
    pageKeywords: 'syarat ketentuan wajib lapor bapas medan, tata tertib klien pemasyarakatan, ketentuan integrasi bapas medan',
    canonicalUrl: '/syarat-ketentuan',
    activePage: 'syarat-ketentuan',
    sub: '',
    tahunBerlaku: new Date().getFullYear()
  });
}

function getRobotsTxt(req, res) {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /client/
Disallow: /logout

Sitemap: https://bapas1medan.com/sitemap.xml
`);
}

function getSitemapXml(req, res) {
  res.type('application/xml');
  const now = new Date().toISOString().split('T')[0];
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://bapas1medan.com/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/profil</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/profil?sub=visi-misi</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/profil?sub=tugas-fungsi</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/profil?sub=struktur-organisasi</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/profil?sub=sejarah-bapas</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/informasi</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/informasi?sub=alur-wajib-lapor</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/informasi?sub=layanan-integrasi</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/informasi?sub=alur-serah-terima</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/informasi?sub=informasi-lkip</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/berita</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/berita?sub=berita-utama</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/login</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/privasi</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://bapas1medan.com/syarat-ketentuan</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`);
}

async function postCekRegistrasiClient(req, res) {
  try {
    const { no_register } = req.body;
    if (!no_register || !no_register.trim()) {
      return res.status(400).json({ success: false, message: 'Harap masukkan nomor registrasi klien.' });
    }

    const client = await getClientByRegister(no_register.trim());
    if (!client) {
      return res.json({
        success: true,
        found: false,
        message: 'Nomor register tidak ditemukan dalam database BAPAS Medan. Silakan periksa kembali nomor register Anda (contoh: REG-2026).'
      });
    }

    let masaLapor = client.masa_wajib_lapor;
    if (!masaLapor && client.bulan_wajib_lapor_mulai && client.tahun_wajib_lapor_mulai) {
      masaLapor = `${getNamaBulan(client.bulan_wajib_lapor_mulai)} ${client.tahun_wajib_lapor_mulai} s/d ${getNamaBulan(client.bulan_wajib_lapor_akhir)} ${client.tahun_wajib_lapor_akhir}`;
    }

    return res.json({
      success: true,
      found: true,
      client: {
        id: client.id,
        nama_lengkap: client.nama_lengkap || 'Klien Binaan',
        no_register: client.no_register,
        status: client.status || 'aktif',
        no_telepon: client.no_telepon || '-',
        masa_wajib_lapor: masaLapor || 'Belum diatur',
        alamat: client.alamat_sekarang || client.alamat || '-'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem: ' + err.message });
  }
}

async function postKirimPesanBantuan(req, res) {
  try {
    const { session_id, nama, kontak, pesan, is_verified, detail_klien, tipe_pesan } = req.body;
    if (!pesan || !pesan.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong.' });
    }
    const cleanSessionId = session_id || `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const senderName = (nama || (req.session && req.session.clientUser ? req.session.clientUser.nama_lengkap : 'Pengunjung')).trim();
    const senderKontak = (kontak || (req.session && req.session.clientUser ? req.session.clientUser.no_hp : '-')).trim();

    const pesanData = await kirimPesanBantuan({
      session_id: cleanSessionId,
      nama: senderName,
      kontak: senderKontak,
      pesan: pesan.trim(),
      pengirim: req.session && req.session.adminUser ? 'admin' : (req.body.pengirim || 'user'),
      admin_name: req.session && req.session.adminUser ? req.session.adminUser.nama_lengkap : '',
      is_verified: Boolean(is_verified),
      detail_klien: detail_klien || null,
      tipe_pesan: tipe_pesan || 'text'
    });

    // Balasan otomatis instan dari Asisten BAPAS pada pesan pertama sesi
    const existingMessages = await getPesanBantuanBySession(cleanSessionId);
    if (existingMessages.length <= 1) {
      setTimeout(async () => {
        try {
          const sambutan = is_verified && detail_klien
            ? `Halo ${senderName}! Identitas registrasi Anda (${detail_klien.no_register || '-'}) telah terverifikasi resmi oleh sistem BAPAS Medan. Petugas Customer Service kami telah menerima rincian data Anda dan siap melayani kendala wajib lapor Anda.`
            : `Halo ${senderName}! Terima kasih telah menghubungi Customer Service Resmi BAPAS Kelas I Medan. Pesan Anda telah kami terima dan terhubung ke petugas kami. Petugas kami siap merespons percakapan Anda secara langsung di sini.`;

          await kirimPesanBantuan({
            session_id: cleanSessionId,
            nama: 'Asisten Layanan BAPAS',
            kontak: 'BAPAS Kelas I Medan',
            pesan: sambutan,
            pengirim: 'bot',
            admin_name: 'Asisten Virtual BAPAS'
          });
        } catch (e) {}
      }, 700);
    }

    return res.json({ success: true, message: 'Pesan berhasil dikirim', data: pesanData, session_id: cleanSessionId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengirim pesan: ' + err.message });
  }
}

async function getPesanBantuanJson(req, res) {
  try {
    const sessionId = req.params.sessionId || req.query.session_id;
    if (!sessionId) {
      return res.json({ success: true, data: [] });
    }
    const messages = await getPesanBantuanBySession(sessionId);
    return res.json({ success: true, data: messages });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getHomePage,
  getBeritaPage,
  getProfilPage,
  getInformasiPage,
  getPrivasiPage,
  getSyaratKetentuanPage,
  getRobotsTxt,
  getSitemapXml,
  postCekRegistrasiClient,
  postKirimPesanBantuan,
  getPesanBantuanJson
};
