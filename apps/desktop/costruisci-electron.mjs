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
  // Solo `electron` resta fuori: lo fornisce il runtime.
  //
  // `exceljs` va dentro il bundle di proposito. In un monorepo npm le
  // dipendenze finiscono nella cartella condivisa alla radice, non in quella
  // dell'app: lasciata fuori, l'applicativo impacchettato non la troverebbe e
  // l'esportazione in Excel andrebbe in errore soltanto sulla macchina di chi
  // lo installa. Bundle più grosso, applicativo che funziona.
  external: ['electron'],
  logLevel: 'info',
}

await Promise.all([
  build({ ...comune, entryPoints: ['electron/principale.ts'], outfile: 'dist-electron/principale.cjs' }),
  build({ ...comune, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' }),
])
