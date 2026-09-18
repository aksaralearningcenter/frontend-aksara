// ==================== KONFIGURASI VITE ====================
// Frontend statis Aksara: dua entry point (landing + panel admin).
//   npm run dev    → server pengembangan + hot reload
//   npm run build  → hasil siap deploy ke folder dist/
//
// base './' (relatif) supaya hasil build jalan di mana saja: root domain
// (aksaralearningcenter.github.io) maupun URL proyek
// (saepul-alam.github.io/namarepo/) — dengan base '/', asetnya akan 404 di
// alamat proyek karena browser mencarinya di root domain.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const berkas = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: berkas('index.html'),
        admin: berkas('sites/index.html')
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
