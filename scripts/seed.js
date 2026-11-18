/**
 * Seeder Database Firebase / Firestore
 * Mengisi database dengan Admin Default, Konfigurasi, dan Contoh Klien
 */

const { db } = require('../src/config/firebase');
const { hashPassword } = require('../src/utils/helpers');

async function seedDatabase() {
  console.log('🌱 Memulai proses seeding database Firebase...');

  // 1. Seed Konfigurasi Sistem
  const configCol = db.collection('konfigurasi_sistem');
  const existingConfig = await configCol.get();
  if (existingConfig.empty) {
    await configCol.add({
      tanggal_mulai_input: 1,
      tanggal_akhir_input: 15,
      notifikasi_tertutup: 'Periode pengisian wajib lapor telah ditutup. Silakan datang ke BAPAS untuk melakukan wajib lapor secara offline.',
      updated_at: new Date().toISOString()
    });
    console.log('✅ Konfigurasi sistem default berhasil dibuat (Tanggal 1 - 15)');
  } else {
    console.log('ℹ️ Konfigurasi sistem sudah ada');
  }

  // 2. Seed Admin Default
  const adminCol = db.collection('admin');
  const existingAdmin = await adminCol.where('username', '==', 'admin').get();
  let adminId = null;

  if (existingAdmin.empty) {
    const adminPasswordHash = await hashPassword('admin123');
    const adminDoc = await adminCol.add({
      username: 'admin',
      password: adminPasswordHash,
      nama_lengkap: 'Administrator BAPAS',
      email: 'admin@bapas.go.id',
      no_telepon: '(061) 4516516',
      status: 'aktif',
      tanggal_daftar: new Date().toISOString(),
      last_login: null
    });
    adminId = adminDoc.id;
    console.log('✅ Admin default dibuat (username: admin, password: admin123)');
  } else {
    adminId = existingAdmin.docs[0].id;
    console.log('ℹ️ Admin default sudah ada');
  }

  // 3. Seed Sample Clients
  const clientCol = db.collection('client');
  const clientPasswordHash = await hashPassword('client123');

  const sampleClients = [
    {
      username: 'budi_santoso',
      password: clientPasswordHash,
      nama_lengkap: 'Budi Santoso',
      no_register: 'REG-2025-001',
      tanggal_lahir: '1995-04-12',
      tempat_lahir: 'Medan',
      alamat: 'Jl. Gatot Subroto No. 45, Medan',
      email: 'budi.santoso@example.com',
      no_telepon: '081234567890',
      status: 'aktif',
      bulan_wajib_lapor_mulai: 1,
      tahun_wajib_lapor_mulai: 2025,
      bulan_wajib_lapor_akhir: 12,
      tahun_wajib_lapor_akhir: 2025,
      total_bulan_wajib_lapor: 12,
      foto_profil: null,
      no_hp_gmail: '081234567890 / budi.santoso@gmail.com',
      alamat_sekarang: 'Jl. Gatot Subroto No. 45, Medan',
      masa_wajib_lapor: 'Januari 2025 s/d Desember 2025',
      profil_lengkap: 1,
      profil_updated_at: new Date().toISOString(),
      created_by: adminId,
      created_at: new Date().toISOString(),
      last_login: null
    },
    {
      username: 'joko_susilo',
      password: clientPasswordHash,
      nama_lengkap: 'Joko Susilo',
      no_register: 'REG-2025-002',
      tanggal_lahir: '1992-08-20',
      tempat_lahir: 'Binjai',
      alamat: 'Jl. Sudirman No. 12, Binjai',
      email: 'joko.susilo@example.com',
      no_telepon: '082198765432',
      status: 'aktif',
      bulan_wajib_lapor_mulai: 3,
      tahun_wajib_lapor_mulai: 2025,
      bulan_wajib_lapor_akhir: 2,
      tahun_wajib_lapor_akhir: 2026,
      total_bulan_wajib_lapor: 12,
      foto_profil: null,
      no_hp_gmail: null,
      alamat_sekarang: null,
      masa_wajib_lapor: null,
      profil_lengkap: 0,
      profil_updated_at: null,
      created_by: adminId,
      created_at: new Date().toISOString(),
      last_login: null
    },
    {
      username: 'siti_rahma',
      password: clientPasswordHash,
      nama_lengkap: 'Siti Rahma',
      no_register: 'REG-2024-089',
      tanggal_lahir: '1998-11-05',
      tempat_lahir: 'Deli Serdang',
      alamat: 'Jl. Pertahanan No. 7, Patumbak',
      email: 'siti.rahma@example.com',
      no_telepon: '085211223344',
      status: 'selesai',
      bulan_wajib_lapor_mulai: 1,
      tahun_wajib_lapor_mulai: 2024,
      bulan_wajib_lapor_akhir: 12,
      tahun_wajib_lapor_akhir: 2024,
      total_bulan_wajib_lapor: 12,
      foto_profil: null,
      no_hp_gmail: '085211223344 / siti.rahma@gmail.com',
      alamat_sekarang: 'Jl. Pertahanan No. 7, Patumbak',
      masa_wajib_lapor: 'Januari 2024 s/d Desember 2024',
      profil_lengkap: 1,
      profil_updated_at: new Date().toISOString(),
      created_by: adminId,
      created_at: new Date('2024-01-02').toISOString(),
      last_login: null
    }
  ];

  let budiId = null;
  for (const client of sampleClients) {
    const existing = await clientCol.where('username', '==', client.username).get();
    if (existing.empty) {
      const doc = await clientCol.add(client);
      if (client.username === 'budi_santoso') budiId = doc.id;
      console.log(`✅ Sample client '${client.nama_lengkap}' berhasil dibuat (username: ${client.username}, password: client123)`);
    } else {
      if (client.username === 'budi_santoso') budiId = existing.docs[0].id;
      console.log(`ℹ️ Client '${client.nama_lengkap}' sudah ada`);
    }
  }

  // 4. Seed Sample Laporan Wajib Lapor untuk Budi Santoso
  if (budiId) {
    const laporCol = db.collection('wajib_lapor');
    const existingLapor = await laporCol.where('client_id', '==', budiId).get();
    if (existingLapor.empty) {
      const sampleReports = [
        {
          client_id: budiId,
          bulan: 1,
          tahun: 2025,
          aktivitas_harian: 'Bekerja sebagai staf mekanik di bengkel motor mitra BAPAS. Kondisi sehat dan mematuhi tata tertib pembimbingan.',
          rencana_mendatang: 'Melanjutkan kursus keahlian kelistrikan otomotif dan mempersiapkan pembukaan usaha mandiri.',
          foto_bukti: null,
          foto_uploaded_at: null,
          tanggal_submit: '2025-01-05T09:30:00Z',
          status: 'diterima',
          catatan_admin: 'Laporan diverifikasi dan diterima dengan baik. Pertahankan kedisiplinan.',
          verified_by: adminId,
          verified_at: '2025-01-05T14:15:00Z',
          created_at: '2025-01-05T09:00:00Z',
          updated_at: '2025-01-05T14:15:00Z'
        },
        {
          client_id: budiId,
          bulan: 2,
          tahun: 2025,
          aktivitas_harian: 'Melakukan pekerjaan rutin di bengkel dan mengikuti bimbingan kemasyarakatan dari pembimbing kemasyarakatan BAPAS Medan.',
          rencana_mendatang: 'Meningkatkan produktivitas kerja dan menabung modal usaha.',
          foto_bukti: null,
          foto_uploaded_at: null,
          tanggal_submit: '2025-02-04T10:20:00Z',
          status: 'diterima',
          catatan_admin: 'Laporan disetujui.',
          verified_by: adminId,
          verified_at: '2025-02-04T11:00:00Z',
          created_at: '2025-02-04T10:00:00Z',
          updated_at: '2025-02-04T11:00:00Z'
        },
        {
          client_id: budiId,
          bulan: new Date().getMonth() + 1,
          tahun: new Date().getFullYear(),
          aktivitas_harian: 'Menjalankan kegiatan usaha mandiri servis berkala dan aktif beribadah serta bermasyarakat di lingkungan sekitar.',
          rencana_mendatang: 'Mengembangkan kemitraan dan mengikuti pelatihan kewirausahaan.',
          foto_bukti: null,
          foto_uploaded_at: null,
          tanggal_submit: new Date().toISOString(),
          status: 'menunggu_verifikasi',
          catatan_admin: null,
          verified_by: null,
          verified_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      for (const rep of sampleReports) {
        await laporCol.add(rep);
      }
      console.log('✅ Contoh data laporan wajib lapor berhasil ditambahkan');
    }
  }

  console.log('🎉 Seeding database selesai!');
  console.log('----------------------------------------------------');
  console.log('Login Admin : username = admin, password = admin123');
  console.log('Login Client: username = budi_santoso, password = client123');
  console.log('              username = joko_susilo, password = client123');
  console.log('----------------------------------------------------');
}

seedDatabase().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Gagal seeding database:', err);
  process.exit(1);
});
