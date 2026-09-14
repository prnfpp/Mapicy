import { build } from 'esbuild'

/**
 * Il processo principale e il preload si compilano con esbuild in CommonJS.
 * Electron carica il processo principale come CJS, e i pacchetti del monorepo
 * sono TypeScript sorgente: vanno inclusi nel bundle, non risolti a runtime.
 */
const comune = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  // `electron` lo fornisce il runtime. `exceljs` resta fuori dal bundle perché
  // è una dipendenza Node normale e impacchettarla non porta vantaggi.
  external: ['electron', 'exceljs'],
  logLevel: 'info',
}

await Promise.all([
  build({ ...comune, entryPoints: ['electron/principale.ts'], outfile: 'dist-electron/principale.cjs' }),
  build({ ...comune, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' }),
])
