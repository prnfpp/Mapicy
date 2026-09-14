import { documentoVuoto, type Documento } from '@mapicy/core'
import type {
  ApiMapicy,
  ArchivioAperto,
  CopiaDiSicurezza,
  EsitoEsportazione,
  FileLetto,
  Identita,
  ImpostazioniApp,
  InfoArchivio,
} from '../electron/ponte.js'

export type { ApiMapicy, ArchivioAperto, CopiaDiSicurezza, Identita, ImpostazioniApp, InfoArchivio }

/**
 * L'interfaccia parla sempre con `ponte()`, mai con `window.mapicy`
 * direttamente. Dentro Electron è il ponte vero; nel browser è quello di
 * prova, in memoria.
 *
 * Non è un espediente per i test: è quello che permette di aprire
 * l'interfaccia in un browser e vederla funzionare senza avviare Electron,
 * che è come è stata sviluppata e verificata.
 */

const CHIAVE_PROVA = 'mapicy:archivio-di-prova'

function pontePerProva(): ApiMapicy {
  const leggi = (): Documento | null => {
    try {
      const salvato = localStorage.getItem(CHIAVE_PROVA)
      return salvato ? (JSON.parse(salvato) as Documento) : null
    } catch {
      return null
    }
  }
  const scrivi = (documento: Documento) => {
    try {
      localStorage.setItem(CHIAVE_PROVA, JSON.stringify(documento))
    } catch {
      // In una finestra privata localStorage può non essere disponibile: il
      // ponte di prova resta utilizzabile, solo senza persistenza.
    }
  }
  let impostazioni: ImpostazioniApp = { clientIdGoogle: '', dominioAmmesso: '', nomeLocale: 'Profilo locale' }
  let identita: Identita = { nome: '', email: '', origine: 'locale' }
  const nonDisponibile = (cosa: string) => {
    throw new Error(`${cosa} è disponibile solo nell'applicativo installato, non nell'anteprima nel browser.`)
  }

  return {
    apriPredefinito: async (): Promise<ArchivioAperto | null> => {
      const documento = leggi()
      return documento
        ? { documento, percorso: '(anteprima nel browser)', salvatoIl: new Date().toISOString() }
        : null
    },
    salva: async (documento) => {
      scrivi(documento)
      return { salvatoIl: new Date().toISOString() }
    },
    scegliArchivio: async () => null,
    ripristinaDaBackup: async () => null,
    esporta: async (): Promise<EsitoEsportazione | null> => nonDisponibile("L'esportazione dei file"),
    leggiFileTesto: async (): Promise<FileLetto | null> =>
      nonDisponibile('La lettura di un file dal disco'),
    infoArchivio: async (): Promise<InfoArchivio> => ({
      percorso: '(anteprima nel browser)',
      esiste: leggi() !== null,
      salvatoIl: new Date().toISOString(),
      dimensione: (localStorage.getItem(CHIAVE_PROVA) ?? '').length,
      cartellaCopie: '(non disponibile nell’anteprima)',
    }),
    mostraArchivioNelSistema: async () => undefined,
    copieDiSicurezza: async (): Promise<CopiaDiSicurezza[]> => [],
    ripristinaCopia: async (): Promise<ArchivioAperto> => nonDisponibile('Il ripristino delle copie'),
    impostazioni: async () => impostazioni,
    salvaImpostazioni: async (nuove) => {
      impostazioni = nuove
      return impostazioni
    },
    identita: async () => identita,
    accediConGoogle: async () =>
      nonDisponibile("L'accesso con Google Workspace"),
    esci: async () => {
      identita = { nome: '', email: '', origine: 'locale' }
      return identita
    },
  }
}

let prova: ApiMapicy | null = null

export function ponte(): ApiMapicy {
  if (window.mapicy) return window.mapicy
  prova ??= pontePerProva()
  return prova
}

export function dentroApplicativo(): boolean {
  return Boolean(window.mapicy)
}

/**
 * La data di riferimento. È l'unico punto dell'applicativo che legge
 * l'orologio: il core la riceve come parametro, così i suoi risultati sono
 * riproducibili.
 */
export function oggi(): string {
  const adesso = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${adesso.getFullYear()}-${p(adesso.getMonth() + 1)}-${p(adesso.getDate())}`
}

export function generaId(): string {
  return crypto.randomUUID()
}

/** Documento di partenza per un archivio nuovo. */
export function nuovoDocumento(): Documento {
  return documentoVuoto()
}
