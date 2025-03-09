import deno from '@deno/vite-plugin';
import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import { resolve } from '@std/path';
import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';
import { fileURLToPath, URL } from 'node:url';
import tailwind from 'tailwindcss';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import vueDevTools from 'vite-plugin-vue-devtools';

const APP_CONFIG = {
  name: 'admin',
  port: 3001,
  host: 'localhost',
};

export default defineConfig({
  build: {
    outDir: `../../dist/${APP_CONFIG.name}`,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo?.name?.split('.');
          const ext = info?.[info.length - 1];

          // Put all assets in admin/assets subdirectory
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `${APP_CONFIG.name}/assets/images/[name]-[hash][extname]`;
          }
          return `${APP_CONFIG.name}/assets/[name]-[hash][extname]`;
        },
        entryFileNames: `${APP_CONFIG.name}/assets/[name]-[hash].js`,
        chunkFileNames: `${APP_CONFIG.name}/assets/[name]-[hash].js`,
      },
    },
  },
  server: {
    port: APP_CONFIG.port,
    host: APP_CONFIG.host,
    fs: {
      allow: [
        resolve(__dirname, '..', '..'),
        resolve(__dirname, '..', '..', 'node_modules'),
        resolve(__dirname, '..', '..', 'server', 'src'),
        resolve(__dirname, '..', '..', 'dist', 'admin'),
      ],
    },
  },
  plugins: [
    vue(),
    deno(),
    // @ts-ignore
    vueDevTools({
      launchEditor: 'cursor',
    }),
    Components({
      resolvers: [
        PrimeVueResolver(),
      ],
    }),
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
      '@src': resolve('./src'),
      '@shared': resolve('../shared/src'),
      '@server': fileURLToPath(new URL('../../server/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['zod'],
  },
});
