// ============ HALAMAN: ASESMEN (bank soal + pengaturan waktu) ============
// Dua tampilan dalam satu modul:
//   • asesmen → daftar paket ujian (judul, durasi menit, jumlah soal, status)
//   • soal    → detail satu paket: atur urutan, tambah/edit/hapus soal
// Soal punya tiga jenis: pilihan ganda (kunci A–F), isian singkat (beberapa
// jawaban diterima), dan esai (dinilai manual oleh pengajar).
import { state, invalidateCache, simpanAsesmen } from '../state.js';
import { $, esc, toast } from '../ui.js';
import { api } from '../api.js';
import { app, modal, closeModal } from '../helpers.js';

const JENIS = [
  { k: 'pg', label: 'Pilihan Ganda', badge: 'b-info' },
  { k: 'isian', label: 'Isian Singkat', badge: 'b-warn' },
  { k: 'esai', label: 'Esai', badge: 'b-ok' }
];
const MAKS_OPSI = 6;

const jenisInfo = k => JENIS.filter(j => j.k === k)[0] || { k: k, label: k, badge: 'b-warn' };
const huruf = i => String.fromCharCode(65 + i);
// "A | B" atau "satu per baris" → array bersih (sama dengan sisi server).
const pisah = v => String(v == null ? '' : v).split(/[|\n]/).map(s => s.trim()).filter(Boolean);
const dariBaris = v => String(v == null ? '' : v).split('\n').map(s => s.trim()).filter(Boolean);

export const render = {
  asesmen: function(list) {
    list = list || [];
    const totalSoal = list.reduce((n, a) => n + (a.soal || 0), 0);
    const aktif = list.filter(a => (a.status || 'Draft') === 'Aktif').length;
    const rows = list.map(function(a) {
      const status = a.status || 'Draft';
      const cls = status === 'Aktif' ? 'b-ok' : (status === 'Nonaktif' ? 'b-err' : 'b-warn');
      const acak = (a.acak_soal === 'Ya' || a.acak_opsi === 'Ya');
      return '<tr>' +
        '<td><b>' + esc(a.judul) + '</b>' + (a.deskripsi ? '<div style="font-size:.75rem;">' + esc(a.deskripsi.substring(0, 90)) + '</div>' : '') + '</td>' +
        '<td>⏱️ ' + (a.durasi_menit || 0) + ' menit</td>' +
        '<td><b>' + (a.soal || 0) + '</b> soal<div style="font-size:.75rem;">' + (a.pg || 0) + ' PG · ' + (a.isian || 0) + ' isian · ' + (a.esai || 0) + ' esai</div></td>' +
        '<td>' + (a.bobot || 0) + ' bobot<div style="font-size:.75rem;">KKM ' + (a.nilai_lulus || 0) + '</div></td>' +
        '<td><span class="badge ' + cls + '">' + esc(status) + '</span>' + (acak ? ' <span class="badge b-info" title="Soal/opsi diacak">🔀</span>' : '') + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn btn-n btn-sm" data-action="open-soal" data-id="' + esc(a.id) + '">📝 Soal</button> ' +
          '<button class="btn btn-o btn-sm" data-action="edit-asesmen" data-id="' + esc(a.id) + '">✏️</button> ' +
          '<button class="btn btn-d btn-sm" data-action="del-asesmen" data-id="' + esc(a.id) + '" data-name="' + esc(a.judul) + '">🗑️</button>' +
        '</td></tr>';
    }).join('');
    $('page').innerHTML =
      '<div class="card-head" style="margin-bottom:16px;"><h2>🧪 Asesmen (' + list.length + ')</h2>' +
      '<button class="btn btn-n btn-sm" data-action="add-asesmen">➕ Buat Asesmen</button></div>' +
      '<p style="font-size:.78rem; margin-bottom:12px;">Tiap asesmen punya <b>batas waktu (menit)</b>, nilai kelulusan, dan bank soalnya sendiri. Buka tombol <b>📝 Soal</b> untuk menambah / mengedit / menghapus soal dan mengatur urutannya.</p>' +
      '<div class="grid" style="margin-bottom:16px;">' +
        '<div class="stat"><div class="n">' + list.length + '</div><div class="l">Total Asesmen</div></div>' +
        '<div class="stat"><div class="n">' + aktif + '</div><div class="l">Status Aktif</div></div>' +
        '<div class="stat"><div class="n">' + totalSoal + '</div><div class="l">Soal Tersimpan</div></div>' +
      '</div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>Judul</th><th>Waktu</th><th>Soal</th><th>Bobot &amp; KKM</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6" style="text-align:center;">Belum ada asesmen. Klik <b>➕ Buat Asesmen</b> untuk memulai.</td></tr>') +
      '</tbody></table></div></div>';
  },

  soal: function(data) {
    data = data || {};
    const a = data.assessment;
    if (!a) {
      $('page').innerHTML = '<div class="card"><div class="empty">Asesmen tidak ditemukan. <button class="btn btn-o btn-sm" data-action="kembali-asesmen" style="margin-top:12px;">⬅️ Kembali ke daftar</button></div></div>';
      return;
    }
    const soal = data.soal || [];
    const totalBobot = soal.reduce((n, s) => n + (Number(s.bobot) || 0), 0);

    const isiSoal = soal.map(function(s, i) {
      const info = jenisInfo(s.jenis);
      const opsi = pisah(s.opsi);
      const kunci = String(s.jawaban || '').toUpperCase();
      let rincian = '';
      if (s.jenis === 'pg') {
        rincian = '<ul class="soal-opsi">' + opsi.map(function(t, j) {
          const benar = huruf(j) === kunci;
          return '<li class="' + (benar ? 'benar' : '') + '">' + huruf(j) + '. ' + esc(t) + (benar ? ' ✔' : '') + '</li>';
        }).join('') + '</ul>';
      } else if (s.jenis === 'isian') {
        rincian = '<p class="soal-meta">Jawaban diterima: <b>' + esc(pisah(s.jawaban).join(' / ') || '-') + '</b></p>';
      } else {
        rincian = '<p class="soal-meta">Esai — dinilai manual oleh pengajar.</p>';
      }
      return '<div class="soal-item">' +
        '<div class="soal-head">' +
          '<span class="soal-no">' + (i + 1) + '</span>' +
          '<span class="badge ' + info.badge + '">' + esc(info.label) + '</span>' +
          '<span class="badge b-warn">' + (s.bobot || 1) + ' bobot</span>' +
          '<span class="soal-acts">' +
            '<button class="btn btn-o btn-sm" data-action="soal-up" data-id="' + esc(s.id) + '"' + (i === 0 ? ' disabled' : '') + ' title="Naikkan">↑</button>' +
            '<button class="btn btn-o btn-sm" data-action="soal-down" data-id="' + esc(s.id) + '"' + (i === soal.length - 1 ? ' disabled' : '') + ' title="Turunkan">↓</button>' +
            '<button class="btn btn-o btn-sm" data-action="edit-soal" data-id="' + esc(s.id) + '">✏️</button>' +
            '<button class="btn btn-d btn-sm" data-action="del-soal" data-id="' + esc(s.id) + '">🗑️</button>' +
          '</span>' +
        '</div>' +
        '<div class="soal-tanya">' + esc(s.pertanyaan) + '</div>' +
        rincian +
        (s.pembahasan ? '<p class="soal-meta">💡 Pembahasan: ' + esc(s.pembahasan) + '</p>' : '') +
      '</div>';
    }).join('');

    const sB = (a.status || 'Draft') === 'Aktif' ? 'b-ok' : ((a.status || 'Draft') === 'Nonaktif' ? 'b-err' : 'b-warn');
    $('page').innerHTML =
      '<div class="card-head" style="margin-bottom:16px;">' +
        '<h2>📝 ' + esc(a.judul) + '</h2>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
          '<button class="btn btn-o btn-sm" data-action="kembali-asesmen">⬅️ Daftar Asesmen</button>' +
          '<button class="btn btn-n btn-sm" data-action="add-soal">➕ Tambah Soal</button>' +
        '</div>' +
      '</div>' +
      '<div class="grid" style="margin-bottom:16px;">' +
        '<div class="stat"><div class="n">' + (a.durasi_menit || 0) + '</div><div class="l">Menit Waktu Ujian</div></div>' +
        '<div class="stat"><div class="n">' + soal.length + '</div><div class="l">Soal</div></div>' +
        '<div class="stat"><div class="n">' + totalBobot + '</div><div class="l">Total Bobot</div></div>' +
        '<div class="stat"><div class="n">' + (a.nilai_lulus || 0) + '</div><div class="l">Nilai Lulus</div></div>' +
      '</div>' +
      '<div class="card" style="margin-bottom:16px;"><div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
        '<span class="badge ' + sB + '">' + esc(a.status || 'Draft') + '</span>' +
        '<span class="badge b-info">Acak soal: ' + esc(a.acak_soal || 'Tidak') + '</span>' +
        '<span class="badge b-info">Acak opsi: ' + esc(a.acak_opsi || 'Tidak') + '</span>' +
        (a.diubah ? '<span class="soal-meta">Terakhir diubah ' + new Date(a.diubah).toLocaleString('id-ID') + '</span>' : '') +
        '<span style="margin-left:auto;"><button class="btn btn-o btn-sm" data-action="edit-asesmen" data-id="' + esc(a.id) + '">⚙️ Atur Waktu &amp; Status</button></span>' +
      '</div>' + (a.deskripsi ? '<p style="font-size:.8rem; margin-top:10px;">' + esc(a.deskripsi) + '</p>' : '') + '</div>' +
      '<div class="soal-list">' + (isiSoal || '<div class="card"><div class="empty">Belum ada soal. Klik <b>➕ Tambah Soal</b>.</div></div>') + '</div>';
  }
};

// ============ MODAL: ASESMEN (judul, waktu, status) ============
function pilihanOpsi(nilai, list) {
  const v = nilai == null || nilai === '' ? list[0] : String(nilai);
  return list.map(x => '<option value="' + esc(x) + '"' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
}

function openAsesmenModal(row) {
  row = row || {};
  modal((row.id ? '✏️ Atur' : '➕ Buat') + ' Asesmen',
    '<div class="fg"><label>Judul Asesmen *</label><input id="a-judul" value="' + esc(row.judul || '') + '" placeholder="Ulangan Harian — Penjumlahan Bersusun"></div>' +
    '<div class="fg"><label>Deskripsi / Instruksi</label><textarea id="a-desk" rows="3" placeholder="Petunjuk singkat untuk pengajar">' + esc(row.deskripsi || '') + '</textarea></div>' +
    '<div class="frow">' +
      '<div class="fg"><label>Durasi (menit) *</label><input type="number" id="a-durasi" min="1" max="600" value="' + (row.durasi_menit || 30) + '"></div>' +
      '<div class="fg"><label>Nilai Kelulusan (KKM)</label><input type="number" id="a-kkm" min="0" max="100" value="' + (row.nilai_lulus == null ? 70 : row.nilai_lulus) + '"></div>' +
    '</div>' +
    '<div class="frow">' +
      '<div class="fg"><label>Acak Urutan Soal</label><select id="a-acak-soal">' + pilihanOpsi(row.acak_soal, ['Tidak', 'Ya']) + '</select></div>' +
      '<div class="fg"><label>Acak Opsi Jawaban</label><select id="a-acak-opsi">' + pilihanOpsi(row.acak_opsi, ['Tidak', 'Ya']) + '</select></div>' +
    '</div>' +
    '<div class="fg"><label>Status</label><select id="a-status">' + pilihanOpsi(row.status, ['Draft', 'Aktif', 'Nonaktif']) + '</select></div>' +
    '<p style="font-size:.75rem;">Durasi 1–600 menit. Status <b>Draft</b> = masih disusun, <b>Aktif</b> = siap dipakai, <b>Nonaktif</b> = disimpan tapi ditutup.</p>',
    '<button class="btn btn-o btn-sm" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-n btn-sm" onclick="saveAsesmen(' + (row.id ? "'" + esc(row.id) + "'" : 'null') + ')">💾 Simpan</button>');
}

async function saveAsesmen(id) {
  const data = {
    judul: $('a-judul').value.trim(),
    deskripsi: $('a-desk').value.trim(),
    durasi_menit: parseInt($('a-durasi').value, 10),
    nilai_lulus: parseInt($('a-kkm').value, 10),
    acak_soal: $('a-acak-soal').value,
    acak_opsi: $('a-acak-opsi').value,
    status: $('a-status').value
  };
  if (!data.judul) { toast('Judul asesmen wajib diisi.', 'err'); return; }
  if (!(data.durasi_menit >= 1 && data.durasi_menit <= 600)) { toast('Durasi harus 1 sampai 600 menit.', 'err'); return; }
  if (!(data.nilai_lulus >= 0 && data.nilai_lulus <= 100)) { toast('Nilai kelulusan harus 0 sampai 100.', 'err'); return; }
  try {
    const res = id ? await api('updateAssesmen', id, data) : await api('addAssesmen', data);
    if (!res.success) { toast(res.message, 'err'); return; }
    closeModal();
    toast(res.message || 'Tersimpan.', 'ok');
    // Bila sedang membuka detail asesmen ini, header detail ikut disegarkan.
    if (id && state.currentPage === 'soal' && state.currentAsesmen === id) {
      invalidateCache('soal');
      app.loadPage('soal');
    } else {
      invalidateCache('asesmen');
      app.loadPage('asesmen');
    }
  } catch (ex) { toast(ex.message, 'err'); }
}

function editAsesmen(id) {
  const dariDaftar = (state.cache.asesmen || []).filter(a => String(a.id) === String(id))[0];
  const detail = state.cache.soal && state.cache.soal.assessment;
  const row = dariDaftar || (detail && String(detail.id) === String(id) ? detail : null);
  if (!row) { toast('Data asesmen tidak ditemukan. Muat ulang halaman.', 'err'); return; }
  openAsesmenModal(row);
}

async function delAsesmen(id, nama) {
  if (!confirm('Hapus asesmen "' + nama + '"? Semua soalnya ikut terhapus dan tidak bisa dikembalikan.')) return;
  try {
    const res = await api('deleteAssesmen', id);
    toast(res.message || 'Asesmen dihapus.', 'ok');
    if (state.currentAsesmen === id) simpanAsesmen('');
    invalidateCache('asesmen');
    invalidateCache('soal');
    app.loadPage('asesmen');
  } catch (ex) { toast(ex.message, 'err'); }
}

function openSoalList(id) {
  if (!id) return;
  simpanAsesmen(id);
  invalidateCache('soal');   // buang detail asesmen lain yang mungkin masih tercache
  app.loadPage('soal');
}

// ============ MODAL: SOAL ============
// Blok isian bergantung jenis soal. Dipisah agar bisa digambar ulang saat
// dropdown Jenis Soal diganti tanpa menutup modal.
function blokJenis(row) {
  const jenis = row.jenis || 'pg';
  if (jenis === 'pg') {
    const opsi = pisah(row.opsi);
    const kunci = String(row.jawaban || 'A').trim().toUpperCase();
    // Jumlah pilihan kunci minimal 4 (A–D), mengikuti jumlah opsi yang ada.
    const jumlah = Math.max(opsi.length, kunci.length === 1 ? kunci.charCodeAt(0) - 64 : 0, 4);
    let pilih = '';
    for (let i = 0; i < jumlah; i++) {
      pilih += '<option value="' + huruf(i) + '"' + (huruf(i) === kunci ? ' selected' : '') + '>' + huruf(i) + '</option>';
    }
    return '<div class="fg"><label>Opsi Jawaban (satu per baris) *</label>' +
        '<textarea id="s-opsi" rows="4" placeholder="Contoh:&#10;12&#10;13&#10;14&#10;15">' + esc(opsi.join('\n')) + '</textarea>' +
        '<small style="font-size:.72rem; opacity:.8;">Baris pertama = opsi A, kedua = B, dan seterusnya (maksimal ' + MAKS_OPSI + ').</small></div>' +
      '<div class="fg"><label>Kunci Jawaban *</label><select id="s-kunci">' + pilih + '</select></div>';
  }
  if (jenis === 'isian') {
    return '<div class="fg"><label>Jawaban yang Diterima (satu per baris) *</label>' +
      '<textarea id="s-jawab-isian" rows="3" placeholder="Contoh:&#10;12&#10;dua belas">' + esc(pisah(row.jawaban).join('\n')) + '</textarea>' +
      '<small style="font-size:.72rem; opacity:.8;">Isi beberapa varian ejaan bila perlu — jawaban dianggap benar jika sama dengan salah satunya.</small></div>';
  }
  return '<p style="font-size:.78rem; margin-bottom:14px;">Soal esai tidak memakai kunci otomatis: jawaban siswa dikumpulkan untuk dinilai manual oleh pengajar.</p>';
}

function jenisSoalBerubah() {
  const jenis = $('s-jenis').value;
  // Bawa teks yang sudah diketik saat berpindah jenis supaya tidak hilang.
  const opsi = $('s-opsi') ? $('s-opsi').value : '';
  const kunci = $('s-kunci') ? $('s-kunci').value : '';
  const isian = $('s-jawab-isian') ? $('s-jawab-isian').value : '';
  $('s-isi-jenis').innerHTML = blokJenis({ jenis: jenis, opsi: opsi, jawaban: jenis === 'isian' ? isian : kunci });
}

function openSoalModal(row) {
  row = row || {};
  const detail = state.cache.soal || {};
  const judulAsesmen = (detail.assessment && detail.assessment.judul) || 'Asesmen';
  modal((row.id ? '✏️ Edit' : '➕ Tambah') + ' Soal',
    '<p style="font-size:.75rem; margin-bottom:12px;">Untuk asesmen: <b>' + esc(judulAsesmen) + '</b></p>' +
    '<div class="fg"><label>Jenis Soal</label><select id="s-jenis" onchange="jenisSoalBerubah()">' +
      JENIS.map(j => '<option value="' + j.k + '"' + ((row.jenis || 'pg') === j.k ? ' selected' : '') + '>' + j.label + '</option>').join('') +
    '</select></div>' +
    '<div class="fg"><label>Pertanyaan *</label><textarea id="s-tanya" rows="3" placeholder="Tulis pertanyaan di sini">' + esc(row.pertanyaan || '') + '</textarea></div>' +
    '<div id="s-isi-jenis">' + blokJenis(row) + '</div>' +
    '<div class="frow">' +
      '<div class="fg"><label>Bobot Nilai</label><input type="number" id="s-bobot" min="1" max="100" value="' + (row.bobot || 1) + '"></div>' +
      '<div class="fg"><label>Pembahasan (opsional)</label><input id="s-bahas" value="' + esc(row.pembahasan || '') + '" placeholder="Kunci singkat untuk pengajar"></div>' +
    '</div>',
    '<button class="btn btn-o btn-sm" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-n btn-sm" onclick="saveSoal(' + (row.id ? "'" + esc(row.id) + "'" : 'null') + ')">💾 Simpan</button>');
}

async function saveSoal(id) {
  const jenis = $('s-jenis').value;
  const data = {
    jenis: jenis,
    pertanyaan: $('s-tanya').value.trim(),
    bobot: parseInt($('s-bobot').value, 10) || 1,
    pembahasan: $('s-bahas').value.trim(),
    opsi: '',
    jawaban: ''
  };
  if (!data.pertanyaan) { toast('Pertanyaan wajib diisi.', 'err'); return; }
  if (jenis === 'pg') {
    const opsi = dariBaris($('s-opsi').value);
    if (opsi.length < 2) { toast('Isi minimal 2 opsi jawaban (satu per baris).', 'err'); return; }
    data.opsi = opsi.join(' | ');
    data.jawaban = $('s-kunci').value;
  } else if (jenis === 'isian') {
    const jawab = dariBaris($('s-jawab-isian').value);
    if (!jawab.length) { toast('Isi minimal satu jawaban benar.', 'err'); return; }
    data.jawaban = jawab.join(' | ');
  }
  if (!state.currentAsesmen) { toast('Asesmen tidak dikenal. Buka ulang dari daftar asesmen.', 'err'); return; }
  try {
    const res = id ? await api('updateSoal', state.currentAsesmen, id, data) : await api('addSoal', state.currentAsesmen, data);
    if (!res.success) { toast(res.message, 'err'); return; }
    closeModal();
    toast(res.message || 'Soal tersimpan.', 'ok');
    invalidateCache('soal');
    app.loadPage('soal');
  } catch (ex) { toast(ex.message, 'err'); }
}

function editSoal(id) {
  const soal = (state.cache.soal && state.cache.soal.soal) || [];
  const row = soal.filter(s => String(s.id) === String(id))[0];
  if (!row) { toast('Soal tidak ditemukan. Muat ulang halaman.', 'err'); return; }
  openSoalModal(row);
}

async function delSoal(id) {
  if (!confirm('Hapus soal ini?')) return;
  try {
    const res = await api('deleteSoal', state.currentAsesmen, id);
    toast(res.message || 'Soal dihapus.', 'ok');
    invalidateCache('soal');
    app.loadPage('soal');
  } catch (ex) { toast(ex.message, 'err'); }
}

// Pindahkan satu soal satu langkah ke atas/bawah, lalu simpan urutan barunya
// sekaligus (satu panggilan reorder untuk seluruh daftar).
async function pindahSoal(id, arah) {
  const soal = (state.cache.soal && state.cache.soal.soal) || [];
  const ids = soal.map(s => s.id);
  const dari = ids.indexOf(id);
  const ke = dari + arah;
  if (dari === -1 || ke < 0 || ke >= ids.length) return;
  ids.splice(ke, 0, ids.splice(dari, 1)[0]);
  try {
    const res = await api('reorderSoal', state.currentAsesmen, ids);
    if (res && res.success === false) { toast(res.message, 'err'); return; }
    invalidateCache('soal');
    app.loadPage('soal');
  } catch (ex) { toast(ex.message, 'err'); }
}

export { openAsesmenModal, saveAsesmen, openSoalModal, saveSoal, jenisSoalBerubah };

export const actions = {
  'add-asesmen': function () { openAsesmenModal(null); },
  'edit-asesmen': function (id) { editAsesmen(id); },
  'del-asesmen': function (id, name) { delAsesmen(id, name); },
  'open-soal': function (id) { openSoalList(id); },
  'kembali-asesmen': function () { app.loadPage('asesmen'); },
  'add-soal': function () { openSoalModal(null); },
  'edit-soal': function (id) { editSoal(id); },
  'del-soal': function (id) { delSoal(id); },
  'soal-up': function (id) { pindahSoal(id, -1); },
  'soal-down': function (id) { pindahSoal(id, 1); }
};
