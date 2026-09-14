/**
 * Verifica dell'interfaccia dal principio alla fine, con un browser vero.
 *
 * L'applicativo gira in Electron, che qui non si può avviare senza schermo. Ma
 * l'interfaccia è scritta per funzionare anche con il ponte di prova in
 * memoria (vedi src/ponte.ts), quindi si può servire la build e guidarla:
 * configurazione iniziale, import di un elenco, censimento automatico,
 * verifica di un accesso, controlli. Alla fine controlla che la console non
 * abbia riportato errori e lascia gli scatti di ogni passaggio.
 *
 * Uso: npm run build && npm run verifica:ui
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const RADICE = new URL('dist/', import.meta.url).pathname
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }
const server = createServer(async (req, res) => {
  const percorso = join(RADICE, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]))
  try {
    const dati = await readFile(percorso)
    res.writeHead(200, { 'Content-Type': TIPI[extname(percorso)] ?? 'application/octet-stream' })
    res.end(dati)
  } catch {
    res.writeHead(404).end('non trovato')
  }
})
await new Promise((r) => server.listen(4173, '127.0.0.1', r))

const dir = process.env.MAPICY_SCATTI ?? 'scatti'
await mkdir(dir, { recursive: true })
// Il percorso del browser si lascia risolvere a Playwright; MAPICY_CHROMIUM
// serve solo dove il browser è installato fuori dai suoi percorsi soliti.
const browser = await chromium.launch(
  process.env.MAPICY_CHROMIUM ? { executablePath: process.env.MAPICY_CHROMIUM } : {},
)
const page = await browser.newPage({ viewport: { width: 1400, height: 980 }, locale: 'it-IT' })

const problemi = []
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) problemi.push(`console: ${m.text()}`) })
page.on('pageerror', (e) => problemi.push(`pageerror: ${e.message}`))

const campo = (nome) => page.locator(`label.campo:has(> span.nome-campo:text-is("${nome}"))`).locator('input, textarea, select').first()
const scatta = async (nome) => { await page.screenshot({ path: `${dir}/ui-${nome}.png`, fullPage: true }); console.log('  scatto', nome) }

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
console.log('1. setup — passo agenzia')
await page.waitForSelector('text=configurazione iniziale')
await scatta('01-setup-agenzia')

await campo("Nome dell’agenzia").fill('Agenzia di comunicazione')
await campo("Referente privacy interno").fill('Elena Trentini')
await campo("DPO").fill('Studio legale esterno')
await page.getByRole('button', { name: 'Avanti' }).click()

console.log('2. persone — incollaggio in blocco')
await page.getByRole('button', { name: 'Incolla un elenco' }).click()
await campo("Elenco").fill(
  'Mario Rossi\tDipendente\tDigital\tmario.rossi@agenzia.it\n' +
  'Sabrina Fonte\tP.IVA\tDesign\tsabrina.fonte@agenzia.it\n' +
  'Luca Pedrazzoli\tDipendente\tDesign\tluca.pedrazzoli@agenzia.it'
)
await page.waitForSelector('text=3 persone riconosciute')
await scatta('02-setup-incolla-persone')
await page.getByRole('button', { name: /Aggiungi 3 persone/ }).click()
await page.waitForSelector('td:has-text("mario.rossi@agenzia.it")')
await page.getByRole('button', { name: 'Avanti' }).click()

console.log('3. asset — editor con guida di reperimento')
await page.getByRole('button', { name: 'Aggiungi un asset' }).click()
await campo("Cliente / progetto").fill('Rossi Srl')
await campo("Piattaforma").selectOption('Meta')
await campo("Tipo di asset").selectOption('Pagina Facebook')
await campo("Nome dell’asset").fill('Pagina Facebook Rossi')
await campo("Identificativo sulla piattaforma").fill('102938475610293')
await page.waitForSelector('text=Dove trovare queste informazioni')
await scatta('03-setup-nuovo-asset')
const codice = await campo("Codice asset").inputValue()
console.log('  codice proposto:', codice)
await page.getByRole('button', { name: 'Salva' }).click()
await page.waitForSelector(`td:has-text("${codice}")`)
await page.getByRole('button', { name: 'Avanti' }).click()

console.log('4. accessi — spiegazione del metodo')
await page.waitForSelector('text=Non scriverli a mano')
await scatta('04-setup-accessi')
await page.getByRole('button', { name: 'Avanti' }).click()

console.log('5. fine — apertura campagna')
await page.waitForSelector('text=Tutto pronto')
await scatta('05-setup-fine')
await page.getByRole('button', { name: 'Entra in Mapicy' }).click()

console.log('6. cruscotto')
await page.waitForSelector('nav[aria-label="Sezioni"]')
await scatta('06-cruscotto-vuoto')

console.log('7. import di un elenco incollato')
await page.getByRole('button', { name: /^Importa elenchi/ }).click()
await page.waitForSelector('text=Scegli l’asset da confrontare')
await page.locator('textarea').last().fill(
  'Nome,Email,Ruolo\n' +
  'Mario Rossi,mario.rossi@agenzia.it,Full control\n' +
  'Sabrina Fonte,sabrina.fonte@agenzia.it,Partial access\n' +
  'Marco Cantelli,marco.cantelli@agenzia.it,Editor'
)
await page.waitForSelector('text=Controlla l’anteprima')
await scatta('07-import-anteprima')
await page.getByRole('button', { name: /Conferma l’import/ }).click()
await page.waitForSelector('text=Import completato')

console.log('8. censimento automatico dalle righe non censite')
await page.waitForSelector('text=Censisci tutti i 3 non censiti')
await scatta('08-import-confronto')
await page.getByRole('button', { name: /Censisci tutti/ }).click()
await page.waitForTimeout(400)
await scatta('09-import-dopo-censimento')

console.log('9. registro')
await page.getByRole('button', { name: /^Registro accessi/ }).click()
await page.waitForSelector('text=Registro accessi (3 di 3)')
await scatta('10-registro')

console.log('10. verifica di un accesso')
await page.getByRole('button', { name: 'Verifica' }).first().click()
await page.waitForSelector('text=Decisione')
await scatta('11-verifica')
await page.getByRole('button', { name: /Registra la verifica/ }).click()
await page.waitForTimeout(300)

console.log('11. controlli')
await page.getByRole('button', { name: /^Controlli/ }).click()
await page.waitForSelector('text=C01')
await scatta('12-controlli')

console.log('12. cruscotto con dati')
await page.getByRole('button', { name: /^Cruscotto/ }).click()
await page.waitForTimeout(300)
await scatta('13-cruscotto-pieno')

console.log('13. esportazioni')
await page.getByRole('button', { name: /^Esporta/ }).click()
await page.waitForSelector('text=Backup JSON')
await scatta('14-esporta')

console.log('\nerrori in console:', problemi.length)
for (const p of problemi) console.log('  !', p)

await browser.close()
server.close()

// Esce con errore se la console ha riportato qualcosa: così lo script serve da
// controllo, non solo da generatore di scatti.
if (problemi.length > 0) process.exitCode = 1
