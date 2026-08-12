import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Server code lives under supabase/functions and is written for Deno, so
    // it stays outside tsc (see tsconfig's exclude). The pure parts of it are
    // still ours to get wrong, so the Deno-free modules get tested here.
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
});
