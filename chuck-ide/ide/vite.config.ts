import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '.'),
  base: '/editor/',
  build: {
    outDir: resolve(__dirname, "../dist/editor"),
    sourcemap: true,
    target:    'es2022',
  },
  server: {
    port: 3000,
    open: true,
  },
  // ── Vitest ───────────────────────────────────────────────
  test: {
    globals:     true,
    environment: 'jsdom',
    include:     ['src/tests/**/*.test.ts'],
    // Couverture de code
    coverage: {
      provider: 'v8',
      include: [
        'core/bus.ts',
        'core/memory.ts',
        'core/assembler.ts',
        'core/display.ts',
        'core/challenge-manager.ts',
        'core/storage/local-storage-adapter.ts',
        'core/storage/api-storage-adapter.ts',
        'core/storage/storage-service.ts',
        'core/base-component.ts',
      ],
      reporter: ['text', 'lcov', 'html'],
    },
 
    // Rapports
    reporters: ['verbose'],
  },
} as any);
