# Aksara Learning Center — Frontend

Landing page dan panel admin **statis** untuk Aksara Learning Center.

Tanpa framework: HTML + CSS + modul ES. Vite hanya dipakai sebagai dev server
dan untuk build opsional (minify). **Karena itu, berkas di repo ini bisa
langsung dilayani GitHub Pages tanpa langkah build.**

Seluruh situs ada di dalam folder **`docs/`** — itulah yang dilayani GitHub Pages:

- `docs/index.html` — landing page (halaman publik)
- `docs/sites/index.html` — panel admin
- `docs/src/styles/` — `landing.css`, `admin.css`
- `docs/src/js/landing/` — modul landing (nav, konten, flipbook, galeri, chatbot, pendaftaran)
- `docs/src/js/admin/` — modul panel admin (`main.js` entry point, `auth.js`, `api.js`, `state.js`, `ui.js`, `config.js`)
- `docs/.nojekyll` — agar GitHub Pages menyajikan berkas apa adanya (tidak diproses Jekyll)

Backend (REST API) ada di repo terpisah: **`Saepul-alam/backend-nodejs`**,
dijalankan sebagai fungsi serverless di Vercel. Folder `server/` di komputer
Anda sudah punya repo git sendiri, jadi sengaja tidak diikutkan ke repo ini.

## Menjalankan di lokal

Cara paling sederhana — tidak perlu install apa pun:

```bash
cd <folder-ini>
python3 -m http.server 8080
```

Lalu buka:

- Landing: <http://localhost:8080/docs/index.html>
- Admin:   <http://localhost:8080/docs/sites/index.html>

Alternatif dengan Vite (ada hot reload):

```bash
npm install
npm run dev        # http://localhost:5173 (langsung ke folder docs/)
npm run build      # versi ter-minify → dist/ (opsional)
```

## Menghubungkan ke backend

Secara bawaan frontend memakai API produksi:
`https://aksara-api-mocha.vercel.app/api`

Untuk mengarahkan ke backend lain (mis. server lokal), tambahkan parameter
`?api=` pada URL — tidak perlu mengedit berkas:

```
http://localhost:8080/docs/sites/index.html?api=http://localhost:3000/api
```

> ⚠️ Backend produksi memakai database Supabase yang **nyata**. Saat menguji di
> lokal, hindari menu Maintenance (unseed) karena bisa menghapus konten asli.

## Deploy ke GitHub Pages

Repo yang dipakai: **`aksaralearningcenter/frontend-aksara`**
(situs uji: <https://aksaralearningcenter.github.io/frontend-aksara/>).

Bila ingin memakai repo lain:

1. **Buat repo** di GitHub, **jangan** centang "Add a README".
2. **Hubungkan & kirim** dari folder ini:

   ```bash
   git init -b main
   git add -A
   git commit -m "Frontend Aksara Learning Center"
   git remote add origin https://github.com/<username>/<namarepo>.git
   git push -u origin main
   ```

3. Buka repo → **Settings** → **Pages**.
4. Bagian **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` — folder **`/docs`**
   - klik **Save**

   > Situs sengaja diletakkan di folder `docs/` karena pada beberapa akun
   > pilihan `/ (root)` tidak muncul di dropdown GitHub Pages — hanya `/docs`.
   > Semua tautan di dalam HTML bersifat relatif, jadi lokasinya tidak masalah.
5. Tunggu 1–2 menit. Situs tayang di:

   ```
   https://<username>.github.io/<namarepo>/
   ```

   Panel admin: `https://<username>.github.io/<namarepo>/sites/`

Semua path aset sudah **relatif**, jadi situs ini jalan baik di alamat proyek
(`/namarepo/`) maupun di alamat utama (`<username>.github.io/`).

### Bila tampilannya belum berubah

- Cek tab **Actions** di repo untuk melihat status deploy.
- Lakukan *hard refresh* (Ctrl/Cmd + Shift + R) — GitHub Pages punya cache
  sekitar 10 menit.
