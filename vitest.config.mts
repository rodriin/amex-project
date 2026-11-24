import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node by default; component tests opt into jsdom with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
