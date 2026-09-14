import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  esportaExcel,
  esportaJson,
  htmlControlli,
  htmlRegistro,
  htmlSchedaAsset,
  htmlVerbaleCampagna,
  nomeFile,
} from '@mapicy/export'
import type { Documento } from '@mapicy/core'
import * as archivio from './archivio.js'
import { ErroreAccesso, accediConGoogle } from './sso.js'
import { CANALI, CHIUSURA, type EsitoEsportazione, type FileLetto, type Identita, type ImpostazioniApp, type RichiestaEsportazione } from './ponte.js'

const INDIRIZZO_SVILUPPO = process.env.MAPICY_DEV_URL
let finestra: BrowserWindow | null = null

/**
 * L'identità vive in memoria e non su disco: alla chiusura dell'applicativo si
 * riparte dal profilo locale, e chi vuole timbrare il registro con l'account
 * aziendale rifà l'accesso. Tenere una sessione persistente su una macchina
 * condivisa vorrebbe dire firmare le verifiche a nome di chi ha acceduto per
 * ultimo.
 */
let identitaCorrente: Identita = { nome: '', email: '', origine: 'locale' }

async function identitaLocale(): Promise<Identita> {
  if (identitaCorrente.origine === 'google') return identitaCorrente
  const impostazioni = await archivio.leggiImpostazioni()
  return { nome: impostazioni.nomeLocale, email: '', origine: 'locale' }
}

function creaFinestra(): void {
  finestra = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Mapicy',
    backgroundColor: '#f6f6f4',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (INDIRIZZO_SVILUPPO) void finestra.loadURL(INDIRIZZO_SVILUPPO)
  else void finestra.loadFile(join(__dirname, '..', 'dist', 'index.html'))

  // L'applicativo è locale: nessun collegamento deve aprirsi dentro la
  // finestra, e i collegamenti esterni vanno al browser del sistema.
  finestra.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  finestra.webContents.on('will-navigate', (evento, url) => {
    const consentito = INDIRIZZO_SVILUPPO ? url.startsWith(INDIRIZZO_SVILUPPO) : url.startsWith('file://')
    if (!consentito) {
      evento.preventDefault()
      if (url.startsWith('https://')) void shell.openExternal(url)
    }
  })

  /**
   * Alla chiusura il salvataggio dell'interfaccia può essere ancora in coda:
   * si scrive su disco poco dopo l'ultima modifica, non a ogni tasto. Qui la
   * chiusura viene sospesa, si chiede all'interfaccia di svuotare la coda, e
   * solo dopo la conferma la finestra si chiude. Con un limite di tempo: una
   * finestra che non si chiude più è peggio di un'ultima modifica persa.
   */
  let chiusuraConsentita = false
  finestra.on('close', (evento) => {
    if (chiusuraConsentita || !finestra) return
    evento.preventDefault()
    const questa = finestra
    const chiudiDavvero = () => {
      chiusuraConsentita = true
      questa.close()
    }
    const scadenza = setTimeout(chiudiDavvero, 5000)
    ipcMain.once(CHIUSURA.pronta, () => {
      clearTimeout(scadenza)
      chiudiDavvero()
    })
    questa.webContents.send(CHIUSURA.richiesta)
  })

  finestra.on('closed', () => {
    finestra = null
  })
}

/**
 * Electron dichiara due firme separate per i dialoghi, con e senza finestra
 * genitore, e non accetta `undefined` al posto della finestra. Questi due
 * involucri scelgono la firma giusta, così il resto del file non se ne occupa.
 */
function dialogoSalva(opzioni: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  return finestra ? dialog.showSaveDialog(finestra, opzioni) : dialog.showSaveDialog(opzioni)
}

function dialogoApri(opzioni: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  return finestra ? dialog.showOpenDialog(finestra, opzioni) : dialog.showOpenDialog(opzioni)
}

/** Converte l'HTML di un'esportazione in PDF con il motore di stampa di Chromium. */
async function htmlInPdf(html: string): Promise<Buffer> {
  const nascosta = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, javascript: false, contextIsolation: true, nodeIntegration: false },
  })
  try {
    await nascosta.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await nascosta.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.55, bottom: 0.55, left: 0.5, right: 0.5 },
    })
  } finally {
    nascosta.destroy()
  }
}

async function eseguiEsportazione(richiesta: RichiestaEsportazione): Promise<EsitoEsportazione | null> {
  const { formato, ambito, documento, oggi } = richiesta

  let contenuto: string | Uint8Array
  let nome: string
  let filtri: Electron.FileFilter[]

  switch (formato) {
    case 'json': {
      const e = esportaJson(documento, ambito, oggi)
      contenuto = e.contenuto
      nome = e.nomeFile
      filtri = [{ name: 'Archivio Mapicy', extensions: ['json'] }]
      break
    }
    case 'excel': {
      contenuto = await esportaExcel(documento, ambito, oggi)
      nome = nomeFile(ambito, oggi, 'mappatura', 'xlsx')
      filtri = [{ name: 'Cartella di lavoro Excel', extensions: ['xlsx'] }]
      break
    }
    default: {
      const html = generaHtml(formato, documento, ambito, oggi)
      contenuto = await htmlInPdf(html)
      nome = nomeFile(ambito, oggi, prefissoPdf(formato), 'pdf')
      filtri = [{ name: 'Documento PDF', extensions: ['pdf'] }]
    }
  }

  const scelta = await dialogoSalva({
    title: 'Salva l’esportazione',
    defaultPath: nome,
    filters: filtri,
  })
  if (scelta.canceled || !scelta.filePath) return null

  if (typeof contenuto === 'string') await writeFile(scelta.filePath, contenuto, 'utf8')
  else await writeFile(scelta.filePath, contenuto)
  return { percorso: scelta.filePath, nomeFile: nome }
}

function generaHtml(
  formato: RichiestaEsportazione['formato'],
  documento: Documento,
  ambito: RichiestaEsportazione['ambito'],
  oggi: string,
): string {
  switch (formato) {
    case 'pdf-scheda':
      if (ambito.tipo !== 'asset') throw new Error('La scheda asset richiede di scegliere un singolo asset.')
      return htmlSchedaAsset(documento, ambito.codiceAsset, oggi)
    case 'pdf-registro':
      return htmlRegistro(documento, ambito, oggi)
    case 'pdf-controlli':
      return htmlControlli(documento, oggi)
    case 'pdf-verbale':
      if (ambito.tipo !== 'campagna') throw new Error('Il verbale richiede di scegliere una campagna.')
      return htmlVerbaleCampagna(documento, ambito.campagna, oggi)
    default:
      throw new Error(`Formato non gestito: ${formato}`)
  }
}

function prefissoPdf(formato: RichiestaEsportazione['formato']): string {
  return {
    'pdf-scheda': 'scheda-asset',
    'pdf-registro': 'registro-accessi',
    'pdf-controlli': 'controlli',
    'pdf-verbale': 'verbale-campagna',
  }[formato as 'pdf-scheda' | 'pdf-registro' | 'pdf-controlli' | 'pdf-verbale']
}

/**
 * Registra un gestore IPC avvolgendo gli errori in un messaggio leggibile:
 * un'eccezione non gestita qui diventa una finestra bianca, che per chi sta
 * compilando è indistinguibile da un guasto.
 *
 * Il cast sugli argomenti è confinato in questa funzione: IPC li consegna
 * come `unknown[]` e la firma del gestore è ciò che dichiara la loro forma.
 */
function gestisci<A extends unknown[], R>(canale: string, gestore: (...argomenti: A) => Promise<R> | R): void {
  ipcMain.handle(canale, async (_evento, ...argomenti) => {
    try {
      return await gestore(...(argomenti as A))
    } catch (errore) {
      throw new Error(errore instanceof Error ? errore.message : String(errore))
    }
  })
}

function registraGestori(): void {
  gestisci(CANALI.apriPredefinito, () => archivio.apriPredefinito())
  gestisci(CANALI.salva, (documento: Documento) => archivio.salva(documento))
  gestisci(CANALI.infoArchivio, () => archivio.infoArchivio())
  gestisci(CANALI.copieDiSicurezza, () => archivio.copieDiSicurezza())
  gestisci(CANALI.ripristinaCopia, (nome: string) => archivio.ripristinaCopia(nome))
  gestisci(CANALI.impostazioni, () => archivio.leggiImpostazioni())
  gestisci(CANALI.salvaImpostazioni, (impostazioni: ImpostazioniApp) => archivio.salvaImpostazioni(impostazioni))
  gestisci(CANALI.esporta, (richiesta: RichiestaEsportazione) => eseguiEsportazione(richiesta))

  gestisci(CANALI.scegliArchivio, async () => {
    const scelta = await dialogoApri({
      title: 'Apri un archivio Mapicy',
      filters: [{ name: 'Archivio Mapicy', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (scelta.canceled || scelta.filePaths.length === 0) return null
    return archivio.apriDa(scelta.filePaths[0])
  })

  gestisci(CANALI.ripristinaDaBackup, async () => {
    const scelta = await dialogoApri({
      title: 'Ripristina da un backup JSON',
      message: 'L’archivio di lavoro attuale verrà conservato fra le copie di sicurezza.',
      filters: [{ name: 'Backup Mapicy', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (scelta.canceled || scelta.filePaths.length === 0) return null
    const aperto = await archivio.apriDa(scelta.filePaths[0])
    await archivio.salva(aperto.documento)
    return { ...aperto, percorso: archivio.percorsoArchivio() }
  })

  gestisci(CANALI.leggiFileTesto, async (): Promise<FileLetto | null> => {
    const scelta = await dialogoApri({
      title: 'Apri l’elenco utenti esportato dalla piattaforma',
      filters: [
        { name: 'Elenchi', extensions: ['csv', 'tsv', 'txt'] },
        { name: 'Tutti i file', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (scelta.canceled || scelta.filePaths.length === 0) return null
    const percorso = scelta.filePaths[0]
    return { nome: percorso.split(/[/\\]/).pop() ?? percorso, testo: await readFile(percorso, 'utf8') }
  })

  gestisci(CANALI.mostraArchivioNelSistema, async () => {
    const info = await archivio.infoArchivio()
    if (info.esiste) shell.showItemInFolder(info.percorso)
    else await shell.openPath(info.cartellaCopie)
  })

  gestisci(CANALI.identita, () => identitaLocale())
  gestisci(CANALI.accediConGoogle, async () => {
    try {
      identitaCorrente = await accediConGoogle(await archivio.leggiImpostazioni())
      return identitaCorrente
    } catch (errore) {
      if (errore instanceof ErroreAccesso) throw new Error(errore.message)
      throw errore
    }
  })
  gestisci(CANALI.esci, async () => {
    identitaCorrente = { nome: '', email: '', origine: 'locale' }
    return identitaLocale()
  })
}

// Una sola istanza: due finestre sullo stesso archivio si sovrascriverebbero a vicenda.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (finestra) {
      if (finestra.isMinimized()) finestra.restore()
      finestra.focus()
    }
  })

  void app.whenReady().then(async () => {
    await archivio.pulisciResidui()
    registraGestori()
    creaFinestra()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) creaFinestra()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
