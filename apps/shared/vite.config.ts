import deno from '@deno/vite-plugin';
import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import { resolve } from '@std/path';
import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';
import { fileURLToPath, URL } from 'node:url';
import tailwind from 'tailwindcss';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 9001,
    host: '127.0.0.1',
  },
  envDir: resolve(__dirname, '..', '..'),
  define: {
    'process.env': process.env,
  },
  plugins: [
    vue(),
    deno(),
    Components({
      resolvers: [
        PrimeVueResolver(),
      ],
    }),
    // @ts-ignore
    autoprefixer(),
  ],
  css: {
    postcss: {
      plugins: [
        tailwind,
        autoprefixer,
      ],
    },
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src', import.meta.url)),
      '@server': fileURLToPath(new URL('../../server/src', import.meta.url)),
    },
  },
});
