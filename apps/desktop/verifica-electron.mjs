/**
 * Verifica dell'applicativo vero, non dell'anteprima nel browser: avvia
 * Electron, guida l'interfaccia e controlla le cose che solo il processo
 * principale può fare — scrivere l'archivio su disco, rileggerlo, tenere le
 * copie di sicurezza, e generare un PDF con il motore di stampa.
 *
 * Serve uno schermo. Dove non c'è: xvfb-run -a npm run verifica:electron
 *
 * Uso: npm run build && npm run verifica:electron
 */
import { _electron as electron } from 'playwright'
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const scatti = process.env.MAPICY_SCATTI ?? 'scatti'
await mkdir(scatti, { recursive: true })
// Una cartella dati usa e getta, per non toccare l'archivio vero di chi esegue.
const datiUsaEGetta = process.env.MAPICY_DATI ?? (await mkdtemp(join(tmpdir(), 'mapicy-verifica-')))

const problemi = []
const app = await electron.launch({
  args: ['.', `--user-data-dir=${datiUsaEGetta}`],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
})
const pagina = await app.firstWindow()
pagina.on('pageerror', (e) => problemi.push(`pageerror: ${e.message}`))
pagina.on('console', (m) => {
  if (m.type() === 'error') problemi.push(`console: ${m.text()}`)
})

const campo = (nome) =>
  pagina.locator(`label.campo:has(> span.nome-campo:text-is("${nome}"))`).locator('input, textarea, select').first()

console.log('1. la finestra si apre sulla configurazione iniziale')
await pagina.waitForSelector('text=configurazione iniziale', { timeout: 30_000 })

console.log('2. il ponte verso il processo principale è esposto')
const haPonte = await pagina.evaluate(() => typeof window.mapicy === 'object' && window.mapicy !== null)
if (!haPonte) problemi.push('window.mapicy non è esposto: il preload non ha funzionato.')

console.log('3. si compila il primo passo e si arriva in fondo')
await campo('Nome dell’agenzia').fill('Agenzia di verifica')
await campo('Referente privacy interno').fill('Elena Trentini')
await pagina.getByRole('button', { name: 'Avanti' }).click()
await pagina.getByRole('button', { name: /^(Salta per ora|Avanti)$/ }).click()

console.log('4. si crea un asset con la guida di reperimento')
await pagina.getByRole('button', { name: 'Aggiungi un asset' }).click()
await campo('Cliente / progetto').fill('Rossi Srl')
await campo('Piattaforma').selectOption('Google')
await campo('Tipo di asset').selectOption('Account Google Ads')
await campo('Nome dell’asset').fill('Google Ads Rossi')
await pagina.waitForSelector('text=ID cliente')
const codice = await campo('Codice asset').inputValue()
console.log('   codice proposto:', codice)
await pagina.getByRole('button', { name: 'Salva' }).click()
await pagina.waitForSelector(`td:has-text("${codice}")`)
await pagina.getByRole('button', { name: 'Avanti' }).click()
await pagina.getByRole('button', { name: 'Avanti' }).click()
await pagina.getByRole('button', { name: 'Entra in Mapicy' }).click()
await pagina.waitForSelector('nav[aria-label="Sezioni"]')

console.log('5. import di un CSV di Google Ads, con i ruoli in inglese')
await pagina.getByRole('button', { name: /^Importa elenchi/ }).click()
await pagina.locator('textarea').last().fill(
  'Email,Access level,Status\n' +
    'mario.rossi@agenzia.it,Admin,Active\n' +
    'sabrina.fonte@agenzia.it,Read only,Active',
)
await pagina.waitForSelector('text=Controlla l’anteprima')
const profiliRiconosciuti = await pagina
  .locator('table tbody tr td:nth-child(4)')
  .allInnerTexts()
if (!profiliRiconosciuti.includes('Accesso amministratore') || !profiliRiconosciuti.includes('Sola lettura')) {
  problemi.push(`I ruoli inglesi di Google Ads non sono stati riconosciuti: ${JSON.stringify(profiliRiconosciuti)}`)
}
await pagina.getByRole('button', { name: /Conferma l’import/ }).click()
await pagina.waitForSelector('text=Import completato')
await pagina.getByRole('button', { name: /Censisci tutti/ }).click()
await pagina.waitForTimeout(500)
await pagina.screenshot({ path: `${scatti}/electron-import.png`, fullPage: true })

console.log('6. l’archivio è stato scritto su disco dal processo principale')
await pagina.waitForTimeout(1500)
const info = await pagina.evaluate(() => window.mapicy.infoArchivio())
console.log('   percorso:', info.percorso)
if (!info.esiste || info.dimensione === 0) problemi.push('L’archivio non è stato scritto su disco.')
const archivio = JSON.parse(await readFile(info.percorso, 'utf8'))
if (archivio.agenzia?.nome !== 'Agenzia di verifica') problemi.push('L’archivio su disco non contiene i dati inseriti.')
if (archivio.accessi?.length !== 2) problemi.push(`Attesi 2 accessi nell’archivio, trovati ${archivio.accessi?.length}.`)
if (archivio.asset?.[0]?.codice !== codice) problemi.push('Il codice asset sul disco non corrisponde.')
console.log(`   ${archivio.asset.length} asset, ${archivio.accessi.length} accessi, ${(info.dimensione / 1024).toFixed(1)} kB`)

console.log('7. il secondo salvataggio distinto lascia una copia di sicurezza')
// Il salvataggio è ritardato: le modifiche ravvicinate finiscono in una sola
// scrittura, quindi la copia nasce alla seconda scrittura, non alla seconda
// modifica. Si cambia una soglia e si aspetta che la scrittura avvenga.
await pagina.getByRole('button', { name: /^Archivio e impostazioni/ }).click()
const copiePrima = (await pagina.evaluate(() => window.mapicy.copieDiSicurezza())).length
await campo('Validità di una verifica (giorni)').fill('200')
// L'indicatore «Salvato alle» è già a schermo dai salvataggi precedenti:
// aspettare quello non dimostra niente. Si aspetta il ritardo del
// salvataggio più il margine della scrittura.
await pagina.waitForTimeout(2000)
const copie = await pagina.evaluate(() => window.mapicy.copieDiSicurezza())
if (copie.length <= copiePrima) {
  problemi.push(`Le copie non sono aumentate: ${copiePrima} prima, ${copie.length} dopo.`)
}
console.log('   copie:', copiePrima, '→', copie.length)
const sulDisco = await readdir(join(datiUsaEGetta, 'copie-di-sicurezza')).catch(() => [])
if (sulDisco.length !== copie.length) problemi.push('Le copie dichiarate non corrispondono a quelle sul disco.')

console.log('8. il motore di stampa genera un PDF')
const byte = await app.evaluate(async ({ BrowserWindow }) => {
  const finestra = new BrowserWindow({ show: false, webPreferences: { offscreen: true, javascript: false } })
  try {
    await finestra.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h1>Prova di stampa</h1>'))
    const pdf = await finestra.webContents.printToPDF({ pageSize: 'A4', printBackground: true })
    return { lunghezza: pdf.length, intestazione: pdf.subarray(0, 5).toString('latin1') }
  } finally {
    finestra.destroy()
  }
})
if (byte.intestazione !== '%PDF-') problemi.push(`printToPDF non ha prodotto un PDF: ${JSON.stringify(byte)}`)
console.log(`   PDF di ${(byte.lunghezza / 1024).toFixed(1)} kB, intestazione ${byte.intestazione}`)

console.log('9. tutti i formati di esportazione producono un file valido')
// Il processo principale scrive nella cartella indicata da
// MAPICY_CARTELLA_ESPORTAZIONI invece di aprire il dialogo di sistema.
// Ogni formato si controlla per quello che deve essere, non per la sua
// dimensione: un numero di byte arbitrario è un test che si rompe appena
// cambia un testo. Per l'xlsx si cerca il nome di un foglio dentro lo zip,
// che è la prova che exceljs nel bundle ha prodotto una cartella di lavoro
// vera e non un file vuoto.
const attesi = {
  json: { inizio: '{', contiene: '"schemaVersion"' },
  excel: { inizio: 'PK', contiene: 'xl/worksheets/sheet1.xml' },
  'pdf-registro': { inizio: '%PDF-' },
  'pdf-controlli': { inizio: '%PDF-' },
  'pdf-scheda': { inizio: '%PDF-' },
}
for (const [formato, atteso] of Object.entries(attesi)) {
  const ambito = formato === 'pdf-scheda' ? { tipo: 'asset', codiceAsset: codice } : { tipo: 'tutto' }
  const esito = await pagina.evaluate(
    ([formato, ambito, documento]) =>
      window.mapicy
        .esporta({ formato, ambito, documento, oggi: '2026-09-15' })
        .catch((e) => ({ errore: String(e) })),
    [formato, ambito, archivio],
  )
  if (esito?.errore || !esito?.percorso) {
    problemi.push(`Esportazione ${formato} non riuscita: ${esito?.errore ?? 'nessun percorso'}`)
    continue
  }
  const dati = await readFile(esito.percorso)
  const testo = dati.toString('latin1')
  if (!testo.startsWith(atteso.inizio)) {
    problemi.push(`${formato}: non inizia con "${atteso.inizio}" ma con "${testo.slice(0, 8)}"`)
  } else if (atteso.contiene && !testo.includes(atteso.contiene)) {
    problemi.push(`${formato}: dentro il file manca "${atteso.contiene}"`)
  } else if (dati.length < 1024) {
    problemi.push(`${formato}: solo ${dati.length} byte, il file è troppo piccolo per contenere qualcosa`)
  } else {
    console.log(`   ${formato}: ${(dati.length / 1024).toFixed(1)} kB`)
  }
}

console.log('10. i controlli segnalano quello che l’import non poteva sapere')
await pagina.getByRole('button', { name: /^Controlli/ }).click()
await pagina.waitForSelector('text=C13')
await pagina.screenshot({ path: `${scatti}/electron-controlli.png`, fullPage: true })

console.log('11. alla chiusura la coda viene svuotata e non resta spazzatura')
// Una modifica appena prima di chiudere: il processo principale deve
// sospendere la chiusura, aspettare la scrittura, e non lasciare temporanei.
await pagina.getByRole('button', { name: /^Archivio e impostazioni/ }).click()
await campo('Validità di un’estrazione (giorni)').fill('150')
await app.close()
const residui = (await readdir(datiUsaEGetta)).filter((n) => n.endsWith('.parziale'))
if (residui.length > 0) problemi.push(`File temporanei rimasti dopo la chiusura: ${residui.join(', ')}`)
const finale = JSON.parse(await readFile(join(datiUsaEGetta, 'mapicy-archivio.json'), 'utf8'))
if (finale.impostazioni?.giorniValiditaEstrazione !== 150) {
  problemi.push(`L'ultima modifica prima della chiusura è andata persa: ${finale.impostazioni?.giorniValiditaEstrazione}`)
}
console.log('   nessun temporaneo, ultima modifica salvata')

console.log('\nproblemi:', problemi.length)
for (const p of problemi) console.log('  !', p)
if (problemi.length > 0) process.exitCode = 1
