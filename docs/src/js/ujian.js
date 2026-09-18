// ============ HALAMAN UJIAN SISWA ============
// Satu halaman, tiga tahap: info (isi nama) → mengerjakan (timer mundur) →
// hasil (skor otomatis). Siswa tidak perlu akun; pengajar cukup membagikan
// tautan /ujian.html?id=<ID-ASESMEN>.
//
// Hal penting:
//   • Waktu resmi dihitung SERVER. Timer di sini hanya tampilan — kalau jam
//     perangkat siswa salah atau tab ditutup, server tetap tahu kapan ujian
//     dimulai dan menandai pengumpulan yang lewat batas.
//   • Kunci jawaban & pembahasan tidak pernah dikirim ke halaman ini.
//   • Jawaban disimpan berkala ke localStorage agar refresh/HP mati tidak
//     menghapus pekerjaan siswa.
const DEFAULT_API = 'https://aksara-api-mocha.vercel.app/api';

const API_URL = (function () {
  try {
    const p = new URLSearchParams(window.location.search).get('api');
    if (p) return p.replace(/\/+$/, '');
  } catch (e) { /* abaikan */ }
  return DEFAULT_API;
})();

const el = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let asesmenId = '';
let attempt = null;      // { attempt_id, judul, soal[], mulai, durasi_menit }
let jawaban = {};        // { question_id: teks jawaban }
let timer = null;

function pesan(teks, jenis) {
  const kotak = el('pesan');
  if (!kotak) return;
  if (!teks) { kotak.hidden = true; return; }
  kotak.textContent = teks;
  kotak.className = 'pesan ' + (jenis === 'err' ? 'err' : 'ok');
  kotak.hidden = false;
  clearTimeout(kotak._t);
  kotak._t = setTimeout(() => { kotak.hidden = true; }, jenis === 'err' ? 7000 : 4000);
}

async function panggil(path, opsi) {
  let res;
  try {
    res = await fetch(API_URL + path, opsi);
  } catch (e) {
    throw new Error('Tidak bisa menghubungi server. Periksa koneksi internet Anda lalu muat ulang halaman.');
  }
  const teks = await res.text();
  let data;
  try { data = teks ? JSON.parse(teks) : {}; } catch (e) { throw new Error('Respon server tidak dikenal.'); }
  if (!res.ok || data.success === false) throw new Error(data.message || ('Server error (HTTP ' + res.status + ').'));
  return data;
}

const post = (path, isi) => panggil(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(isi || {})
});

// ---------- Simpanan sementara di perangkat ----------
// Kunci per attempt_id supaya membuka dua ujian berbeda tidak saling menimpa.
const KUNCI_SIMPAN = () => 'aksara_ujian_' + (attempt && attempt.attempt_id);

function simpanSementara() {
  if (!attempt) return;
  try {
    localStorage.setItem(KUNCI_SIMPAN(), JSON.stringify({
      asesmen_id: asesmenId, attempt_id: attempt.attempt_id, judul: attempt.judul,
      soal: attempt.soal, mulai: attempt.mulai, durasi_menit: attempt.durasi_menit,
      nama: attempt.nama, jawaban: jawaban
    }));
  } catch (e) { /* localStorage penuh/diblokir — ujian tetap jalan */ }
}

function hapusSimpanan() {
  try { if (attempt) localStorage.removeItem(KUNCI_SIMPAN()); } catch (e) { /* abaikan */ }
}

function bacaSimpanan(attemptId) {
  try {
    const mentah = localStorage.getItem('aksara_ujian_' + attemptId);
    return mentah ? JSON.parse(mentah) : null;
  } catch (e) { return null; }
}

// ---------- TAHAP 1: INFO ----------
async function muatInfo() {
  if (!asesmenId) {
    el('isi').innerHTML = '<div class="kartu"><h2>⚠️ Tautan tidak lengkap</h2><p>Alamat halaman ini tidak memuat ID asesmen. Minta tautan ujian yang benar kepada pengajar Anda.</p></div>';
    return;
  }
  try {
    const info = await panggil('/asesmen/' + encodeURIComponent(asesmenId));
    document.title = info.judul + ' — Ujian';
    el('isi').innerHTML =
      '<div class="kartu">' +
        '<h1>' + esc(info.judul) + '</h1>' +
        (info.deskripsi ? '<p class="deskripsi">' + esc(info.deskripsi) + '</p>' : '') +
        '<div class="info-baris">' +
          '<div><span>Jumlah soal</span><b>' + info.jumlah_soal + '</b></div>' +
          '<div><span>Waktu</span><b>' + info.durasi_menit + ' menit</b></div>' +
        '</div>' +
        '<p class="catatan">Waktu mulai berjalan begitu Anda menekan tombol di bawah, dan tidak bisa dijeda. Saat waktu habis, jawaban otomatis terkumpul.</p>' +
        '<label class="label" for="nama">Nama lengkap</label>' +
        '<input id="nama" class="isian" placeholder="Tulis nama Anda" autocomplete="name" maxlength="80">' +
        '<button class="tombol utama besar" id="btn-mulai">▶️ Mulai Mengerjakan</button>' +
      '</div>';
    el('btn-mulai').addEventListener('click', mulai);
    const inputNama = el('nama');
    inputNama.addEventListener('keydown', (e) => { if (e.key === 'Enter') mulai(); });
    inputNama.focus();
  } catch (ex) {
    el('isi').innerHTML = '<div class="kartu"><h2>😕 Asesmen tidak bisa dibuka</h2><p>' + esc(ex.message) + '</p>' +
      '<p class="catatan">Bila ujian baru saja dibuka pengajar, minta dipastikan statusnya sudah <b>Aktif</b>.</p></div>';
  }
}

async function mulai() {
  const nama = (el('nama').value || '').trim();
  if (nama.length < 3) { pesan('Nama wajib diisi (minimal 3 huruf).', 'err'); return; }
  const tombol = el('btn-mulai');
  tombol.disabled = true;
  tombol.textContent = '⏳ Menyiapkan soal…';
  try {
    const data = await post('/asesmen/' + encodeURIComponent(asesmenId) + '/mulai', { nama: nama });
    attempt = data;
    jawaban = {};
    tampilkanUjian();
    mulaiTimer();
    pesan(data.message || 'Selamat mengerjakan!', 'ok');
  } catch (ex) {
    tombol.disabled = false;
    tombol.textContent = '▶️ Mulai Mengerjakan';
    pesan(ex.message, 'err');
  }
}

// ---------- TAHAP 2: MENGERJAKAN ----------
function htmlSoal(s) {
  const nomor = '<div class="soal-nomor"><b>' + s.no + '</b><span>' + (s.jenis === 'pg' ? 'Pilihan ganda' : (s.jenis === 'isian' ? 'Isian singkat' : 'Esai')) + '</span></div>';
  let isi = '';
  if (s.jenis === 'pg') {
    isi = '<div class="opsi-lis">' + (s.opsi || []).map(function (o) {
      const nilai = esc(o);
      return '<label class="opsi"><input type="radio" name="q_' + esc(s.id) + '" value="' + nilai + '"><span>' + nilai + '</span></label>';
    }).join('') + '</div>';
  } else if (s.jenis === 'isian') {
    isi = '<input class="isian" data-jawab="' + esc(s.id) + '" placeholder="Tulis jawaban singkat" autocomplete="off">';
  } else {
    isi = '<textarea class="isian" rows="6" data-jawab="' + esc(s.id) + '" placeholder="Tulis jawaban lengkap Anda"></textarea>';
  }
  return '<section class="kartu soal" data-soal="' + esc(s.id) + '">' + nomor +
    '<p class="teks-soal">' + esc(s.pertanyaan) + '</p>' + isi + '</section>';
}

function tampilkanUjian() {
  el('kotak-waktu').hidden = false;
  el('panel-aksi').hidden = false;
  el('isi').innerHTML =
    '<div class="judul-ujian"><h1>' + esc(attempt.judul) + '</h1><p>Dikerjakan oleh <b>' + esc(attempt.nama) + '</b> · ' + attempt.soal.length + ' soal</p></div>' +
    attempt.soal.map(htmlSoal).join('');
  pasangInput();
  segarkanKemajuan();
  el('btn-kirim').addEventListener('click', kumpulkan);
}

function pasangInput() {
  el('isi').addEventListener('change', function (e) {
    const radio = e.target.closest('input[type="radio"]');
    if (!radio) return;
    const wadah = radio.closest('[data-soal]');
    if (!wadah) return;
    jawaban[wadah.dataset.soal] = radio.value;
    wadah.classList.add('terjawab');
    simpanSementara();
    segarkanKemajuan();
  });
  el('isi').addEventListener('input', function (e) {
    const inp = e.target.closest('[data-jawab]');
    if (!inp) return;
    jawaban[inp.dataset.jawab] = inp.value;
    const wadah = inp.closest('[data-soal]');
    if (wadah) wadah.classList.toggle('terjawab', !!inp.value.trim());
    simpanSementara();
    segarkanKemajuan();
  });
}

function terisi() {
  if (!attempt) return 0;
  return attempt.soal.filter(s => String(jawaban[s.id] || '').trim() !== '').length;
}

function segarkanKemajuan() {
  const total = attempt ? attempt.soal.length : 0;
  const n = terisi();
  const k = el('kemajuan');
  if (k) k.innerHTML = 'Terjawab <b>' + n + '</b> dari <b>' + total + '</b>' + (n < total ? ' · masih ada yang kosong' : ' · lengkap');
}

function batasWaktu() {
  return new Date(attempt.mulai).getTime() + (Number(attempt.durasi_menit) || 0) * 60 * 1000;
}

function mulaiTimer() {
  clearInterval(timer);
  const perbarui = function () {
    const sisa = Math.max(0, Math.round((batasWaktu() - Date.now()) / 1000));
    const m = String(Math.floor(sisa / 60)).padStart(2, '0');
    const d = String(sisa % 60).padStart(2, '0');
    const t = el('waktu-teks');
    if (t) t.textContent = m + ':' + d;
    const kotak = el('kotak-waktu');
    if (kotak) kotak.classList.toggle('habis', sisa <= 60);
    if (sisa <= 0) {
      clearInterval(timer);
      pesan('Waktu habis — jawaban Anda langsung dikumpulkan.', 'err');
      kumpulkan(true);
    }
  };
  perbarui();
  timer = setInterval(perbarui, 1000);
}

async function kumpulkan(otomatis) {
  if (!attempt) return;
  const tombol = el('btn-kirim');
  if (tombol) { tombol.disabled = true; tombol.textContent = '⏳ Mengirim…'; }
  clearInterval(timer);
  const daftar = attempt.soal.map(s => ({ question_id: s.id, jawaban: String(jawaban[s.id] || '') }));
  try {
    const hasil = await post('/asesmen/attempts/' + encodeURIComponent(attempt.attempt_id) + '/kirim', { jawaban: daftar });
    hapusSimpanan();
    tampilkanHasil(hasil, otomatis);
  } catch (ex) {
    pesan(ex.message, 'err');
    // Gagal kirim (mis. jaringan putus): jawaban tetap tersimpan, tombol dibuka
    // lagi, dan hitungan waktu dilanjutkan supaya siswa bisa mencoba lagi.
    if (tombol) { tombol.disabled = false; tombol.textContent = '📤 Coba Kirim Lagi'; }
    if (!otomatis) mulaiTimer();
  }
}

// ---------- TAHAP 3: HASIL ----------
function tampilkanHasil(h, otomatis) {
  clearInterval(timer);
  el('kotak-waktu').hidden = true;
  el('panel-aksi').hidden = true;
  const lulus = h.nilai_lulus != null ? (Number(h.skor) >= Number(h.nilai_lulus)) : null;
  const kelasNilai = lulus === null ? '' : (lulus ? 'lulus' : 'belum');
  el('isi').innerHTML =
    '<div class="kartu hasil">' +
      '<h1>' + (otomatis ? '⏰ Waktu habis' : '✅ Jawaban terkumpul') + '</h1>' +
      '<p class="catatan">' + esc(h.message || '') + '</p>' +
      '<div class="skor-bulat ' + kelasNilai + '"><b>' + h.skor + '</b><span>skor</span></div>' +
      (lulus === null ? '' : '<p class="status-lulus ' + kelasNilai + '">' + (lulus ? '🎉 Mencapai nilai kelulusan (' + h.nilai_lulus + ')' : '📌 Belum mencapai nilai kelulusan (' + h.nilai_lulus + ')') + '</p>') +
      '<div class="info-baris">' +
        '<div><span>Benar</span><b>' + h.benar + '</b></div>' +
        '<div><span>Salah</span><b>' + h.salah + '</b></div>' +
        '<div><span>Kosong</span><b>' + h.kosong + '</b></div>' +
        (h.perlu_nilai ? '<div><span>Menunggu penilaian</span><b>' + h.perlu_nilai + '</b></div>' : '') +
      '</div>' +
      (h.lewat_waktu === 'Ya' ? '<p class="peringatan">Catatan: jawaban dikumpulkan setelah batas waktu, jadi pengajar diberi tahu hal ini.</p>' : '') +
      '<p class="catatan">Nilai sudah tersimpan dan bisa dilihat pengajar. Anda boleh menutup halaman ini.</p>' +
    '</div>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- MULAI ----------
(function init() {
  try { asesmenId = new URLSearchParams(window.location.search).get('id') || ''; } catch (e) { asesmenId = ''; }

  // Melanjutkan pengerjaan yang belum selesai di perangkat ini (refresh/HP
  // mati). Hanya simpanan untuk ASESMEN YANG SAMA yang dipulihkan — kalau siswa
  // membuka tautan ujian lain, pengerjaan lama tidak boleh ikut terbawa.
  const kunciSimpanan = asesmenId ? Object.keys(localStorage).filter(k => k.indexOf('aksara_ujian_') === 0) : [];
  for (const kunci of kunciSimpanan) {
    try {
      const simpanan = JSON.parse(localStorage.getItem(kunci));
      if (!simpanan || !simpanan.soal || !simpanan.mulai) continue;
      if (simpanan.asesmen_id !== asesmenId) continue;
      if (simpanan.attempt_id && simpanan.attempt_id !== '') {
        const sisa = new Date(simpanan.mulai).getTime() + (Number(simpanan.durasi_menit) || 0) * 60 * 1000 - Date.now();
        if (sisa > 5000) {
          attempt = simpanan;
          jawaban = simpanan.jawaban || {};
          tampilkanUjian();
          // Pulihkan pilihan yang sudah diisi sebelum refresh.
          Object.keys(jawaban).forEach(function (qid) {
            const nilai = jawaban[qid];
            // Bandingkan lewat properti .value (bukan selektor) supaya teks opsi
            // yang mengandung tanda kutip tetap aman dipulihkan.
            let terpasang = false;
            document.querySelectorAll('input[name="q_' + qid + '"]').forEach(function (r) {
              if (!terpasang && r.value === nilai) { r.checked = true; terpasang = true; }
            });
            if (!terpasang) {
              const inp = document.querySelector('[data-jawab="' + qid + '"]');
              if (inp) inp.value = nilai;
            }
            const wadah = document.querySelector('[data-soal="' + qid + '"]');
            if (wadah && String(nilai || '').trim()) wadah.classList.add('terjawab');
          });
          mulaiTimer();
          pesan('Melanjutkan pengerjaan yang belum selesai.', 'ok');
          return;
        }
        // Sudah lewat batas → bersihkan agar tidak menggantung.
        localStorage.removeItem(kunci);
      }
    } catch (e) { /* simpanan rusak → abaikan */ }
  }

  muatInfo();
})();

// Mencegah halaman tertutup tanpa sengaja saat masih mengerjakan.
window.addEventListener('beforeunload', function (e) {
  if (attempt && !el('panel-aksi').hidden && el('btn-kirim') && !el('btn-kirim').disabled) {
    simpanSementara();
    e.preventDefault();
    e.returnValue = '';
  }
});
