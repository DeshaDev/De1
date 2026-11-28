import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(rootDir, '.'),
        '@mediapipe/face_mesh': path.resolve(
          rootDir,
          'src/shims/mediapipe-legacy-shims.ts'
        ),
        '@mediapipe/face_detection': path.resolve(
          rootDir,
          'src/shims/mediapipe-legacy-shims.ts'
        ),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/@supabase/')) {
              return 'supabase-vendor';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'motion-vendor';
            }
            if (id.includes('node_modules/zod/')) {
              return 'zod-vendor';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'icons-vendor';
            }
          },
        },
      },
    },
  };
});
