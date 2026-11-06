import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Runtime models, samples and fonts live in assets/ and are served at the site root.
  publicDir: 'assets',
  // Separate dependency cache per server (the E2E server must not share it with `npm run dev`).
  cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  // Pre-bundle everything the game loads lazily, so the dev server never re-optimizes (and reloads)
  // in the middle of a song.
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      'lucide-react',
      'three',
      'three/addons/loaders/GLTFLoader.js',
      'three/addons/controls/OrbitControls.js',
      'three/addons/environments/RoomEnvironment.js',
      'three/addons/postprocessing/EffectComposer.js',
      'three/addons/postprocessing/RenderPass.js',
      'three/addons/postprocessing/UnrealBloomPass.js',
      'three/addons/postprocessing/OutputPass.js',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // Three.js in its own long-cached chunk.
        manualChunks: { three: ['three'] },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
