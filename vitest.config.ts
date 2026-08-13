import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Worker entry (Durable Object, D1) stays outside tsc — cloudflare:workers
    // is not an Expo type. Pure seams under workers/src are tested here.
    include: ['src/**/*.test.ts', 'workers/**/*.test.ts'],
  },
});
