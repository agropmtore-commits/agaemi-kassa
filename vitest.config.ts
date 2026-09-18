import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Dexie needs an IndexedDB implementation outside the browser
    setupFiles: ['tests/setup.ts'],
  },
});
