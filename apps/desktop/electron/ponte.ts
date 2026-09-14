import type { Documento } from '@mapicy/core'

/**
 * Il contratto fra il processo principale e l'interfaccia. Vive in un file a
 * sé perché lo importano entrambi: se cambia una firma, il controllo dei tipi
 * lo segnala su tutti e due i lati invece di lasciare un canale IPC rotto che
 * si scopre a runtime.
 */

export interface ArchivioAperto {
  documento: Documento
  percorso: string
  salvatoIl: string
}

export interface InfoArchivio {
  percorso: string
  esiste: boolean
  salvatoIl: string
  /** Dimensione in byte, per far vedere che il backup è un file e quanto pesa. */
  dimensione: number
  cartellaCopie: string
}

export interface CopiaDiSicurezza {
  nome: string
  salvataIl: string
  dimensione: number
}

export interface Identita {
  nome: string
  email: string
  /** `google` quando l'identità arriva dall'accesso con Google Workspace, `locale` altrimenti. */
  origine: 'google' | 'locale'
}

export interface ImpostazioniApp {
  /** ID client OAuth dell'agenzia. Vuoto = accesso con profilo locale. Sta qui e non nel documento perché il documento viene esportato. */
  clientIdGoogle: string
  dominioAmmesso: string
  nomeLocale: string
}

export type FormatoEsportazione = 'json' | 'excel' | 'pdf-scheda' | 'pdf-registro' | 'pdf-controlli' | 'pdf-verbale'

export interface RichiestaEsportazione {
  formato: FormatoEsportazione
  /** Serializzato come JSON dell'ambito di `@mapicy/export`, per non far dipendere il preload da quel pacchetto. */
  ambito: { tipo: 'tutto' } | { tipo: 'cliente'; cliente: string } | { tipo: 'asset'; codiceAsset: string } | { tipo: 'campagna'; campagna: string }
  documento: Documento
  oggi: string
}

export interface EsitoEsportazione {
  percorso: string
  nomeFile: string
}

export interface FileLetto {
  nome: string
  testo: string
}

export interface ApiMapicy {
  /** Apre l'archivio predefinito. `null` se non esiste ancora: è il primo avvio. */
  apriPredefinito(): Promise<ArchivioAperto | null>
  salva(documento: Documento): Promise<{ salvatoIl: string }>
  /** Scegli un altro archivio da aprire. */
  scegliArchivio(): Promise<ArchivioAperto | null>
  /** Carica un backup JSON e lo rende l'archivio corrente. */
  ripristinaDaBackup(): Promise<ArchivioAperto | null>
  esporta(richiesta: RichiestaEsportazione): Promise<EsitoEsportazione | null>
  /** Apre un CSV o un file di testo per l'import di un'estrazione. */
  leggiFileTesto(): Promise<FileLetto | null>
  infoArchivio(): Promise<InfoArchivio>
  mostraArchivioNelSistema(): Promise<void>
  copieDiSicurezza(): Promise<CopiaDiSicurezza[]>
  ripristinaCopia(nome: string): Promise<ArchivioAperto>
  impostazioni(): Promise<ImpostazioniApp>
  salvaImpostazioni(impostazioni: ImpostazioniApp): Promise<ImpostazioniApp>
  identita(): Promise<Identita>
  accediConGoogle(): Promise<Identita>
  esci(): Promise<Identita>
}

/**
 * I nomi dei canali IPC, dichiarati una volta e importati da entrambi i lati.
 * Duplicare le stringhe fra preload e processo principale significa che un
 * refuso diventa una chiamata che non risponde mai, senza errore di compilazione.
 */
export const CANALI = {
  apriPredefinito: 'archivio:apriPredefinito',
  salva: 'archivio:salva',
  scegliArchivio: 'archivio:scegli',
  ripristinaDaBackup: 'archivio:ripristinaDaBackup',
  esporta: 'esporta',
  leggiFileTesto: 'file:leggiTesto',
  infoArchivio: 'archivio:info',
  mostraArchivioNelSistema: 'archivio:mostraNelSistema',
  copieDiSicurezza: 'copie:elenco',
  ripristinaCopia: 'copie:ripristina',
  impostazioni: 'impostazioni:leggi',
  salvaImpostazioni: 'impostazioni:salva',
  identita: 'identita:leggi',
  accediConGoogle: 'identita:accediGoogle',
  esci: 'identita:esci',
} as const satisfies Record<keyof ApiMapicy, string>

declare global {
  interface Window {
    /** Presente solo dentro Electron. Nel browser l'interfaccia usa il ponte di prova. */
    mapicy?: ApiMapicy
  }
}
