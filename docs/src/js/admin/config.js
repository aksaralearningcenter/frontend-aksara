// ============ KONFIGURASI (WAJIB DIISI) ============
// Base URL REST API backend baru (Vercel). Ganti bila domain berubah.
export const API_DEFAULT = 'https://aksara-api-mocha.vercel.app/api';

// Tes lokal: buka sites/index.html?api=http://localhost:3000/api
// Tanpa parameter itu, selalu memakai API_DEFAULT (produksi).
export const API_URL = (function () {
  try {
    const p = new URLSearchParams(window.location.search).get('api');
    if (p) return p.replace(/\/+$/, '');
  } catch (e) { /* abaikan */ }
  return API_DEFAULT;
})();
