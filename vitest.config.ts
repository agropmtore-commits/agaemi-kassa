import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Dexie needs an IndexedDB implementation outside the browser
    setupFiles: ['tests/setup.ts'],
  },
});
