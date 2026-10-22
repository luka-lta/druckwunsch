import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Standard-Port des API-Servers, falls in der .env keiner gesetzt ist */
const DEFAULT_API_PORT = '3000';

export default defineConfig(({ mode }) => {
  // Die .env liegt im Projektverzeichnis, nicht im Vite-Root "web".
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT ?? DEFAULT_API_PORT;

  return {
    root: 'web',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./web', import.meta.url)),
      },
    },
    build: {
      outDir: '../dist/web',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api/': `http://localhost:${apiPort}`,
      },
    },
  };
});
