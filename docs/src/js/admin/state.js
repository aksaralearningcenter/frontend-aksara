// ============ STATE, CACHE & SESI ============
import { $ } from './ui.js';

// Satu sumber kebenaran untuk data sesi + cache halaman.
export const state = { token: localStorage.getItem('aksara_token') || '', me: null, cache: {}, cacheTime: {}, students: [] };

// Cache halaman dianggap masih segar selama CACHE_TTL ms. Selama segar, pindah
// halaman langsung tampil dari cache tanpa memanggil API (hemat kuota Apps Script);
// setelah lewat TTL, data ditarik ulang di belakang layar.
export const CACHE_TTL = 60000;
export const REQ_TIMEOUT = 25000;

// ⚡ Targeted cache invalidation — hanya hapus cache yang terpengaruh
const INVALIDATION_MAP = {
  students: ['students', 'dashboard', 'attendance', 'progress'],
  classes: ['classes', 'students', 'dashboard'],
  attendance: ['attendance', 'dashboard'],
  savings: ['savings', 'dashboard', 'transactions'],
  transactions: ['transactions', 'dashboard', 'savings'],
  registrations: ['registrations', 'dashboard'],
  users: ['users'],
  pricing: ['pricing'],
  news: ['news'],
  books: ['books'],
  settings: ['settings', 'reports'],
  reports: ['reports'],
  progress: ['progress', 'dashboard']
};

export function invalidateCache(entity) {
  const keys = INVALIDATION_MAP[entity] || [entity];
  keys.forEach(k => { delete state.cache[k]; delete state.cacheTime[k]; });
}

// Bersihkan sesi di klien lalu kembalikan ke layar login.
// Dipakai api.js saat server membalas 401, dan auth.js saat logout.
export function hardLogout() {
  state.token = ''; state.me = null; state.cache = {};
  localStorage.removeItem('aksara_token');
  $('shell').classList.remove('on');
  $('login').style.display = 'flex';
}
