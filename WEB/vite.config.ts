import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const backendDir = path.resolve(__dirname, '../backend');

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Supabase credentials live with the backend, not in the frontend folder.
    envDir: backendDir,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@backend': path.resolve(backendDir, 'src'),
        // backend/ sits outside this root, so it cannot walk up to these
        // node_modules on its own. Point it at the one installed copy.
        '@supabase/supabase-js': path.resolve(
          __dirname,
          'node_modules/@supabase/supabase-js'
        ),
      },
    },
    build: {
      rollupOptions: {
        // Multi-page app: the static landing/login pages plus the React dashboard.
        input: {
          landing: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          privacy: path.resolve(__dirname, 'privacy.html'),
          dashboard: path.resolve(__dirname, 'dashboard/index.html'),
        },
      },
    },
    server: {
      // Defaults to 3000; PORT lets a launcher assign a free port instead.
      port: Number(process.env.PORT) || 3000,
      // Open the landing page first when the dev server starts.
      open: '/',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify. File watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // The auth module lives outside this Vite root, so allow serving it.
      fs: {
        allow: [path.resolve(__dirname, '.'), backendDir],
      },
    },
  };
});
