import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig's "@/*" so components import the same way in tests.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  // Next.js sets `jsx: "preserve"` in tsconfig (its own compiler owns the
  // transform), Vite inherits that, and raw JSX would reach the runner as
  // classic React.createElement calls with no React in scope. This install
  // runs vitest on plain vite (esbuild transformer), so the automatic
  // runtime is configured HERE. NOTE from the Birmingham sibling: under
  // rolldown-vite the transformer is oxc and this esbuild key is silently
  // ignored — if the runner ever moves to rolldown, move this to
  // `oxc: { jsx: { runtime: 'automatic', importSource: 'react' } }`.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', '.next-verify'],
  },
});
