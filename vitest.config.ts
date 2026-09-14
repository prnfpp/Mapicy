import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const percorso = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@mapicy/catalogo': percorso('./packages/catalogo/src/index.ts'),
      '@mapicy/core': percorso('./packages/core/src/index.ts'),
      '@mapicy/export': percorso('./packages/export/src/index.ts'),
    },
  },
  test: {
    globals: true,
    include: ['packages/*/test/**/*.test.ts'],
  },
})
