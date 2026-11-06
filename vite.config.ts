import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Runtime models, samples and fonts live in assets/ and are served at the site root.
  publicDir: 'assets',
});
