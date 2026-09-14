import { normalizza, tipoAssetPer } from '@mapicy/catalogo'
import { dataValida } from './date.js'
import type { Documento } from './tipi.js'

/**
 * Versione dello schema del documento. Si incrementa quando un cambiamento
 * renderebbe illeggibile un archivio salvato prima, e si aggiunge il gradino
 * corrispondente in `MIGRAZIONI`.
 */
export const VERSIONE_SCHEMA = 1

export function documentoVuoto(): Documento {
  return {
    schemaVersion: VERSIONE_SCHEMA,
    agenzia: { nome: '', referentePrivacy: '', dpo: '', emailContatto: '' },
    impostazioni: { giorniValiditaVerifica: 180, giorniValiditaEstrazione: 180, dominioSso: '' },
    setup: { completato: false, passoRaggiunto: 0 },
    campagnaCorrente: '',
    campagne: [],
    persone: [],
    asset: [],
    accessi: [],
    estrazioni: [],
    revisioni: [],
  }
}

/**
 * Gradini di migrazione, uno per versione. Ognuno riceve il documento come
 * l'ha scritto la versione precedente e lo porta alla successiva.
 */
const MIGRAZIONI: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // Il primo gradino comparirà con lo schema 2. Tenere la mappa vuota è
  // deliberato: serve che il meccanismo esista e sia testato dal principio,
  // perché aggiungerlo dopo, con archivi già in giro, è la parte difficile.
}

export class ErroreDocumento extends Error {}

/**
 * Apre un documento arrivato da disco. Aggiorna gli archivi vecchi; rifiuta
 * quelli scritti da una versione più nuova, invece di leggerli male e
 * sovrascriverli perdendo i campi che non conosce.
 */
export function apriDocumento(grezzo: unknown): Documento {
  if (typeof grezzo !== 'object' || grezzo === null) {
    throw new ErroreDocumento('Il file non contiene un archivio Mapicy.')
  }
  const d = grezzo as Record<string, unknown>
  const versione = d.schemaVersion
  if (typeof versione !== 'number' || !Number.isInteger(versione) || versione < 1) {
    throw new ErroreDocumento(
      'Il file non dichiara una versione dello schema: non è un archivio Mapicy, oppure è danneggiato.',
    )
  }
  if (versione > VERSIONE_SCHEMA) {
    throw new ErroreDocumento(
      `Questo archivio è stato salvato con una versione più recente di Mapicy (schema ${versione}, ` +
        `questa versione legge fino al ${VERSIONE_SCHEMA}). Aggiornare Mapicy invece di aprirlo: ` +
        'aprirlo adesso farebbe perdere i dati dei campi che questa versione non conosce.',
    )
  }

  let corrente = d
  for (let v = versione; v < VERSIONE_SCHEMA; v++) {
    const gradino = MIGRAZIONI[v]
    if (!gradino) {
      throw new ErroreDocumento(
        `Manca la migrazione dallo schema ${v} al ${v + 1}: l'archivio non può essere aggiornato in sicurezza.`,
      )
    }
    corrente = gradino(corrente)
    corrente.schemaVersion = v + 1
  }

  return completaConPredefiniti(corrente)
}

/**
 * Riempie i campi assenti con i valori del documento vuoto. Serve per gli
 * archivi scritti prima che un campo opzionale esistesse: la migrazione si
 * occupa dei cambiamenti di forma, questa dei campi aggiunti senza cambiarla.
 */
function completaConPredefiniti(d: Record<string, unknown>): Documento {
  const base = documentoVuoto()
  const elenco = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const oggetto = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  return {
    schemaVersion: VERSIONE_SCHEMA,
    agenzia: { ...base.agenzia, ...oggetto(d.agenzia) },
    impostazioni: { ...base.impostazioni, ...oggetto(d.impostazioni) },
    setup: { ...base.setup, ...oggetto(d.setup) },
    campagnaCorrente: typeof d.campagnaCorrente === 'string' ? d.campagnaCorrente : '',
    campagne: elenco(d.campagne),
    persone: elenco(d.persone),
    asset: elenco(d.asset),
    accessi: elenco(d.accessi),
    estrazioni: elenco(d.estrazioni),
    revisioni: elenco(d.revisioni),
  }
}

/**
 * Propone il codice di un nuovo asset riusando la sigla che il catalogo già
 * assegna al tipo di asset: `ROSSI-META-FB`. Il codice si può correggere a
 * mano prima di salvare, ma la proposta deve essere buona, perché è quella
 * che nella pratica resta.
 */
export function proponiCodiceAsset(
  cliente: string,
  piattaforma: string,
  tipoAsset: string,
  codiciEsistenti: readonly string[],
): string {
  const siglaCliente =
    normalizza(cliente)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
      .slice(0, 12) || 'CLIENTE'
  const voce = tipoAssetPer(piattaforma, tipoAsset)
  const siglaAsset = (voce?.codice ?? normalizza(piattaforma).toUpperCase()).replace(/_/g, '-')
  const proposta = `${siglaCliente}-${siglaAsset}`
  const presi = new Set(codiciEsistenti.map((c) => c.toUpperCase()))
  if (!presi.has(proposta)) return proposta
  for (let n = 2; n < 1000; n++) {
    const tentativo = `${proposta}-${n}`
    if (!presi.has(tentativo)) return tentativo
  }
  throw new Error(`Non è stato possibile proporre un codice libero a partire da ${proposta}.`)
}

/**
 * Perché un codice asset non si può cambiare dopo: è la chiave con cui gli
 * accessi e le estrazioni puntano all'asset. Cambiarlo scollegherebbe le
 * righe senza dirlo. L'interfaccia chiama questa funzione per sapere se
 * bloccare il campo.
 */
export function codiceAssetModificabile(documento: Documento, codice: string): boolean {
  const usato =
    documento.accessi.some((a) => a.codiceAsset === codice) ||
    documento.estrazioni.some((e) => e.codiceAsset === codice)
  return !usato
}

/** Controlli di forma sul documento, per non salvare un archivio incoerente. */
export function verificaDocumento(documento: Documento): string[] {
  const problemi: string[] = []
  const codici = new Map<string, number>()
  for (const a of documento.asset) {
    if (!a.codice) problemi.push(`Un asset (${a.nome || a.id}) non ha codice.`)
    codici.set(a.codice, (codici.get(a.codice) ?? 0) + 1)
    if (a.prossimaVerifica && !dataValida(a.prossimaVerifica)) {
      problemi.push(`L'asset ${a.codice} ha una data di prossima verifica non valida: ${a.prossimaVerifica}.`)
    }
  }
  for (const [codice, quante] of codici) {
    if (quante > 1) problemi.push(`Il codice asset ${codice} è usato da ${quante} asset: deve essere univoco.`)
  }
  const idPersone = new Set(documento.persone.map((p) => p.id))
  for (const a of documento.accessi) {
    for (const [campo, valore] of [
      ['data di concessione', a.dataConcessione],
      ['data di ultima verifica', a.dataUltimaVerifica],
      ['data di revoca', a.dataRevoca],
    ] as const) {
      if (valore && !dataValida(valore)) {
        problemi.push(`Un accesso su ${a.codiceAsset} ha una ${campo} non valida: ${valore}.`)
      }
    }
    if (a.personaId && !idPersone.has(a.personaId)) {
      problemi.push(`Un accesso su ${a.codiceAsset} punta a una persona che non è in anagrafica.`)
    }
  }
  return problemi
}
