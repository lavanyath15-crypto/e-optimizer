import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest runs from WEB/ but the backend's request validation lives in
 * ../backend and is plain TypeScript with no Deno globals, so it is worth
 * covering here rather than leaving the only server-side input handling
 * untested.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@backend': path.resolve(__dirname, '../backend/src'),
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      '../backend/supabase/functions/**/*.test.ts',
    ],
  },
});
