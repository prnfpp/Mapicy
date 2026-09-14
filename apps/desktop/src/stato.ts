import { createContext, useContext } from 'react'
import type { Documento } from '@mapicy/core'
import type { Identita, ImpostazioniApp, InfoArchivio } from './ponte.js'

export type StatoSalvataggio =
  | { fase: 'fermo' }
  | { fase: 'in-corso' }
  | { fase: 'salvato'; quando: string }
  | { fase: 'errore'; messaggio: string }

export interface Archivio {
  documento: Documento
  identita: Identita
  impostazioni: ImpostazioniApp
  info: InfoArchivio | null
  salvataggio: StatoSalvataggio
  /**
   * Applica una modifica al documento. La funzione riceve il documento
   * corrente e ne restituisce uno nuovo: il core lavora così, e passare da qui
   * garantisce che ogni modifica venga salvata.
   */
  aggiorna(modifica: (documento: Documento) => Documento): void
  ricaricaIdentita(): Promise<void>
  aggiornaImpostazioni(impostazioni: ImpostazioniApp): Promise<void>
  ricaricaInfo(): Promise<void>
  sostituisci(documento: Documento): void
  /** Chi sta lavorando, da scrivere nel registro come «verificato da». */
  operatore(): string
}

const ContestoArchivio = createContext<Archivio | null>(null)
export const FornitoreArchivio = ContestoArchivio.Provider

export function useArchivio(): Archivio {
  const archivio = useContext(ContestoArchivio)
  if (!archivio) throw new Error('useArchivio va usato dentro FornitoreArchivio.')
  return archivio
}

export type Sezione =
  | 'cruscotto'
  | 'asset'
  | 'registro'
  | 'importa'
  | 'controlli'
  | 'persone'
  | 'esporta'
  | 'archivio'
