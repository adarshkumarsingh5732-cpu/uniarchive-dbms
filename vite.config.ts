import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // The frontend always calls /api; forward it to the Express server so
        // the app works on localhost and on a LAN address alike.  Override the
        // backend port locally with VITE_API_PROXY in a root `.env`
        // (gitignored) rather than editing the committed default.
        proxy: {
          '/api': {
            target: env.VITE_API_PROXY || 'http://localhost:5000',
            changeOrigin: true,
          },
        },
      },
      // `vite preview` serves the built bundle and needs the same /api proxy.
      preview: {
        port: 4173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: env.VITE_API_PROXY || 'http://localhost:5000',
            changeOrigin: true,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      // No `define` block: the old GEMINI_API_KEY substitution belonged to the
      // removed client-side geminiService. AI chat goes through the backend
      // (/api/ai/ask), so no key is inlined into the browser bundle.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Split the heavy, route-independent libraries out of the entry chunk.
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom', 'react-router-dom'],
              charts: ['recharts'],
            },
          },
        },
      },
    };
});
