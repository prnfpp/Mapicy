import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const percorso = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  // I percorsi nel pacchetto sono relativi: l'app viene caricata da file://.
  base: './',
  resolve: {
    alias: {
      '@mapicy/catalogo': percorso('../../packages/catalogo/src/index.ts'),
      '@mapicy/core': percorso('../../packages/core/src/index.ts'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5199 },
})
