import { defineConfig } from 'vite';

// Relative base so the build works on itch.io (served from a sub-path) and GitHub Pages.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
