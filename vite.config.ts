import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any folder (itch.io, GitHub Pages, file server).
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
