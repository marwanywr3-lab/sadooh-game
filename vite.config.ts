import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * إعداد Vite متوافق مع GitHub Pages والاستضافة الثابتة.
 * يستخدم المسار النسبي './' افتراضيًا ليعمل تحت أي اسم مستودع (مثل https://username.github.io/repo-name/)
 * دون الحاجة لمعرفة اسم المستودع مسبقًا، مع إمكانية تخصيصه عبر متغير البيئة VITE_BASE_PATH.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
