/**
 * dashboard.js
 * -----------------------------------------------------------------
 * Semua perpindahan konten di dashboard admin WAJIB lewat loadTab()
 * atau loadDetail() di file ini. JANGAN pernah pakai <a href="xxx.php">
 * atau window.location untuk berpindah antar menu admin, karena itu
 * yang menyebabkan halaman "lepas" dari layout dashboard (bug lama).
 * -----------------------------------------------------------------
 */

const mainContent = document.getElementById('mainContent');
const tabButtons   = document.querySelectorAll('#mainTabs [data-tab]');

// Nama tab terakhir yg aktif, dipakai tombol "Kembali" di halaman detail.
let currentTab = 'overview';

/* ============================================================
   1. LOAD TAB (Overview / Verifikasi Lapor / Kelola Client)
   ============================================================ */
function loadTab(tabName, params = {}, pushState = true) {
    currentTab = tabName;

    // Tandai tombol tab aktif
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const qs = new URLSearchParams(params).toString();
    const url = `ajax/${tabName}.php${qs ? '?' + qs : ''}`;

    showLoading();

    fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        })
        .then(html => {
            mainContent.innerHTML = html;
            if (pushState) {
                history.pushState({ tab: tabName, params }, '', `?tab=${tabName}`);
            }
        })
        .catch(err => {
            mainContent.innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${err.message}</div>`;
        });
}

/* ============================================================
   2. LOAD DETAIL LAPOR (dimuat DI DALAM shell dashboard, bukan
      halaman berdiri sendiri)
   ============================================================ */
function loadDetail(id, fromTab) {
    showLoading();

    fetch(`ajax/get_lapor_detail.php?id=${encodeURIComponent(id)}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(res => res.text())
        .then(html => {
            mainContent.innerHTML = html;
            // simpan tab asal supaya tombol "Kembali" tahu harus balik ke mana
            mainContent.dataset.fromTab = fromTab;
            history.pushState({ tab: 'detail', id, fromTab }, '', `?tab=detail&id=${id}`);
        })
        .catch(err => {
            mainContent.innerHTML = `<div class="alert alert-danger">Gagal memuat detail: ${err.message}</div>`;
        });
}

function showLoading() {
    mainContent.innerHTML = `
        <div class="text-center text-muted py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2">Memuat...</p>
        </div>`;
}

/* ============================================================
   3. PROSES VERIFIKASI / TOLAK LAPOR
      Nama "action" di sini HARUS SAMA PERSIS dengan case di
      ajax/proses_lapor.php ('terima' / 'tolak'). Inilah sumber
      "Action tidak dikenal" kalau berbeda.
   ============================================================ */
function prosesLapor(id, action, catatan = '') {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('action', action);   // <-- kontrak nama action yang konsisten
    fd.append('catatan', catatan);

    return fetch('ajax/proses_lapor.php', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: fd
    })
        .then(res => res.json());
}

/* ============================================================
   4. EVENT DELEGATION - satu listener untuk semua klik di dashboard
   ============================================================ */
document.addEventListener('click', function (e) {

    // --- Klik tab menu utama ---
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn && tabBtn.closest('#mainTabs')) {
        loadTab(tabBtn.dataset.tab);
        return;
    }

    // --- Klik "Lihat" / "Detail" pada baris tabel ---
    const detailBtn = e.target.closest('[data-action="lihat-detail"]');
    if (detailBtn) {
        loadDetail(detailBtn.dataset.id, currentTab);
        return;
    }

    // --- Tombol "Kembali" di halaman detail ---
    const backBtn = e.target.closest('[data-action="kembali"]');
    if (backBtn) {
        const fromTab = mainContent.dataset.fromTab || 'verifikasi';
        loadTab(fromTab);
        return;
    }

    // --- Tombol "Terima Lapor" ---
    const terimaBtn = e.target.closest('[data-action="terima-lapor"]');
    if (terimaBtn) {
        const doTerima = () => {
            terimaBtn.disabled = true;
            prosesLapor(terimaBtn.dataset.id, 'terima').then(res => handleProsesResult(res, terimaBtn.dataset.id));
        };
        if (typeof customConfirm === 'function') {
            customConfirm({
                title: 'Verifikasi & Terima Laporan',
                text: 'Apakah Anda yakin ingin menerima laporan ini?',
                icon: 'question',
                confirmColor: '#28a745',
                confirmText: '<i class="fas fa-check"></i> Ya, Terima Laporan',
                cancelText: 'Batal'
            }).then(r => { if (r.isConfirmed) doTerima(); });
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Verifikasi & Terima Laporan',
                text: 'Apakah Anda yakin ingin menerima laporan ini?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#64748b',
                confirmText: 'Ya, Terima Laporan',
                cancelText: 'Batal'
            }).then(r => { if (r.isConfirmed) doTerima(); });
        } else {
            doTerima();
        }
        return;
    }

    // --- Tombol "Tolak Lapor" -> tampilkan form alasan ---
    const showTolakBtn = e.target.closest('[data-action="show-form-tolak"]');
    if (showTolakBtn) {
        document.getElementById('formAlasanTolak')?.classList.remove('d-none');
        return;
    }

    // --- Batal isi alasan tolak ---
    const batalTolakBtn = e.target.closest('[data-action="batal-tolak"]');
    if (batalTolakBtn) {
        document.getElementById('formAlasanTolak')?.classList.add('d-none');
        return;
    }

    // --- Konfirmasi Penolakan ---
    const confirmTolakBtn = e.target.closest('[data-action="konfirmasi-tolak"]');
    if (confirmTolakBtn) {
        const id = confirmTolakBtn.dataset.id;
        const alasan = document.getElementById('alasanPenolakan').value.trim();
        if (!alasan) {
            if (typeof window.showToast === 'function') {
                window.showToast('Alasan penolakan wajib diisi.', 'warning');
            } else if (typeof Swal !== 'undefined') {
                Swal.fire('Perhatian', 'Alasan penolakan wajib diisi.', 'warning');
            } else {
                alert('Alasan penolakan wajib diisi.');
            }
            return;
        }
        confirmTolakBtn.disabled = true;
        prosesLapor(id, 'tolak', alasan).then(res => handleProsesResult(res, id));
        return;
    }
});

function handleProsesResult(res, fromTab) {
    if (res.success) {
        if (typeof window.showToast === 'function') {
            window.showToast('Status laporan berhasil diperbarui.', 'success');
        }
        // reload detail supaya status ter-update, tetap di dalam shell dashboard
        loadDetail(res.id, mainContent.dataset.fromTab || 'verifikasi');
    } else {
        if (typeof window.showToast === 'function') {
            window.showToast(res.message || 'Terjadi kesalahan.', 'error');
        } else if (typeof Swal !== 'undefined') {
            Swal.fire('Gagal', res.message || 'Terjadi kesalahan.', 'error');
        } else {
            alert(res.message || 'Terjadi kesalahan.');
        }
    }
}

/* ============================================================
   5. SEARCH - dipasang di Overview, Verifikasi Lapor, Kelola Client
      Event delegation juga, karena elemen input di-render ulang
      setiap kali tab dimuat via AJAX.
   ============================================================ */
let searchTimer = null;
document.addEventListener('input', function (e) {
    if (e.target.matches('[data-role="search-input"]')) {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => runSearch(e.target), 350); // debounce
    }
});
document.addEventListener('submit', function (e) {
    if (e.target.matches('[data-role="search-form"]')) {
        e.preventDefault();
        const input = e.target.querySelector('[data-role="search-input"]');
        runSearch(input);
    }
});
document.addEventListener('change', function (e) {
    if (e.target.matches('[data-role="search-filter"]')) {
        runSearch(document.querySelector(`[data-role="search-input"][data-tab="${e.target.dataset.tab}"]`));
    }
});

function runSearch(inputEl) {
    if (!inputEl) return;
    const tab = inputEl.dataset.tab; // 'overview' | 'verifikasi' | 'client'
    const q = inputEl.value.trim();
    const filterEl = document.querySelector(`[data-role="search-filter"][data-tab="${tab}"]`);
    const status = filterEl ? filterEl.value : '';

    loadTab(tab, { q, status }, false); // false = jangan pushState tiap ketik, biar history bersih
}

/* ============================================================
   6. BROWSER BACK/FORWARD BUTTON
   ============================================================ */
window.addEventListener('popstate', function (e) {
    const state = e.state;
    if (!state) {
        loadTab('overview', {}, false);
        return;
    }
    if (state.tab === 'detail') {
        loadDetail(state.id, state.fromTab);
    } else {
        loadTab(state.tab, state.params || {}, false);
    }
});

/* ============================================================
   7. INIT - baca query string awal (?tab=verifikasi) kalau ada,
      supaya link/refresh tetap membuka tab yang benar di dalam shell.
   ============================================================ */
(function init() {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') || 'overview';
    if (initialTab === 'detail' && params.get('id')) {
        loadDetail(params.get('id'), 'verifikasi');
    } else {
        loadTab(initialTab, {}, false);
    }
})();
