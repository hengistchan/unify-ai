import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@unify-ai/core': path.resolve(__dirname, '../core/src'),
      '@unify-ai/core/discovery': path.resolve(__dirname, '../core/src/discovery'),
      '@unify-ai/core/adapters': path.resolve(__dirname, '../core/src/adapters'),
      '@unify-ai/core/converter': path.resolve(__dirname, '../core/src/converter'),
      '@unify-ai/core/core': path.resolve(__dirname, '../core/src/core'),
    },
  },
});
