import type { Gravita, LivelloRischio } from '@mapicy/catalogo'

/**
 * Il modello dati. Due principi lo governano.
 *
 * Primo: gli stati che la logica dei controlli interroga sono unioni di
 * stringhe con codici stabili (`'revocato'`), non le etichette italiane che
 * si vedono a schermo (`'Revocato'`). Le etichette cambiano, i codici no, e
 * un controllo che confronta etichette si rompe la prima volta che qualcuno
 * corregge una maiuscola.
 *
 * Secondo: un accesso non porta con sé la descrizione di cosa tratta. Quella
 * si deriva dal catalogo al momento della lettura. Vedi `derivazioni.ts` per
 * il perché.
 */

/** Data in formato ISO `AAAA-MM-GG`. Mai un `Date`: il core non ha fuso orario né orologio. */
export type DataIso = string

export type StatoAccesso = 'da-attivare' | 'attivo' | 'sospeso' | 'revocato'
export type StatoAsset = 'attivo' | 'dismesso'
export type StatoPersona = 'attivo' | 'sospeso' | 'cessato'
export type EsitoVerifica = 'confermato' | 'profilo-ridotto' | 'revocato' | 'da-verificare'
export type Terzieta = 'si' | 'no' | 'non-applicabile' | 'da-verificare'

export interface Persona {
  id: string
  nome: string
  /** Riferimento a `elenchi.rapportoLavoro`. Non è un'unione di tipi perché contiene la sigla dell'agenzia, che è un dato di configurazione. */
  rapportoLavoro: string
  ruoloAziendale: string
  stato: StatoPersona
  email: string
  dataCessazione: DataIso | null
  note: string
}

export interface Asset {
  id: string
  /** Chiave stabile assegnata una volta e mai modificata: lega registro, estrazioni e schede. */
  codice: string
  cliente: string
  piattaforma: string
  tipoAsset: string
  nome: string
  idPiattaforma: string
  /** Di chi è l'asset: normalmente il cliente, a volte l'agenzia. */
  proprieta: string
  titolare: string
  ruoloAgenzia: string
  baseGiuridica: string
  trasferimentoExtraUe: string
  conservazione: string
  prossimaVerifica: DataIso | null
  stato: StatoAsset
  note: string
}

export interface Accesso {
  id: string
  codiceAsset: string
  personaId: string
  /** Nome del profilo autorizzativo come sta nel catalogo. Vuoto = riga incompleta (C09). */
  profilo: string
  /** L'account con cui la persona accede davvero. È metà della chiave di riconciliazione. */
  email: string
  stato: StatoAccesso
  dataConcessione: DataIso | null
  dataUltimaVerifica: DataIso | null
  esitoUltimaVerifica: EsitoVerifica | null
  campagnaVerifica: string
  verificatoDa: string
  dataRevoca: DataIso | null
  mfaAttiva: Terzieta
  autorizzatoDa: string
  finalita: string
  note: string
}

export interface RigaEstrazione {
  id: string
  /** La piattaforma da cui arriva l'elenco. */
  fonte: string
  codiceAsset: string
  nomeAssetPiattaforma: string
  nomePersona: string
  email: string
  /** Il ruolo come lo scrive la piattaforma, non come lo chiama il catalogo. */
  ruoloDichiarato: string
  dataEstrazione: DataIso
}

export interface Campagna {
  codice: string
  apertaIl: DataIso
  chiusaIl: DataIso | null
  chiusaDa: string
  note: string
}

export interface VoceRevisione {
  id: string
  data: DataIso
  campagna: string
  codiceAsset: string
  tipoModifica: string
  personaInteressata: string
  descrizione: string
  eseguitaDa: string
  approvataDa: string
}

export interface Agenzia {
  nome: string
  referentePrivacy: string
  dpo: string
  emailContatto: string
}

export interface Impostazioni {
  /** Oltre questi giorni un accesso verificato torna «da verificare» (C07). Il template di partenza usava 180. */
  giorniValiditaVerifica: number
  /** Oltre questi giorni un'estrazione è troppo vecchia per riconciliare (C02-C05). */
  giorniValiditaEstrazione: number
  /** Dominio Google Workspace ammesso all'accesso. Vuoto = accesso con profilo locale. */
  dominioSso: string
}

export interface StatoSetup {
  completato: boolean
  /** Passo a cui si è arrivati, per poter interrompere e riprendere. */
  passoRaggiunto: number
}

export interface Documento {
  schemaVersion: number
  agenzia: Agenzia
  impostazioni: Impostazioni
  setup: StatoSetup
  campagnaCorrente: string
  campagne: Campagna[]
  persone: Persona[]
  asset: Asset[]
  accessi: Accesso[]
  estrazioni: RigaEstrazione[]
  revisioni: VoceRevisione[]
}

/** Un accesso letto assieme a quello che il catalogo dice del suo profilo. */
export interface AccessoDerivato {
  accesso: Accesso
  asset: Asset | null
  persona: Persona | null
  datiTrattati: string
  attivita: string
  rischio: LivelloRischio | null
  /** Compilato quando il profilo non si trova nel catalogo: dice perché, invece di lasciare i campi vuoti senza spiegazione. */
  problema: string | null
}

export type TipoRiferimento = 'accesso' | 'asset' | 'estrazione' | 'persona'

export interface CasoControllo {
  tipo: TipoRiferimento
  id: string
  /** Frase leggibile che dice qual è il caso, per non costringere chi legge a cercarlo a mano. */
  descrizione: string
}

export type StatoControllo = 'ok' | 'da-correggere' | 'informativo' | 'non-verificabile'

export interface EsitoControllo {
  codice: string
  titolo: string
  gravita: Gravita
  stato: StatoControllo
  casi: CasoControllo[]
  comeCorreggere: string
  /** Solo per i controlli che dipendono dalle estrazioni: gli asset su cui il controllo non ha potuto pronunciarsi. */
  assetNonCoperti: string[]
}

export type EsitoRiconciliazione =
  | 'ok'
  | 'non-censito'
  | 'profilo-diverso'
  | 'revoca-non-eseguita'
  | 'non-riscontrato'

export interface RigaRiconciliata {
  codiceAsset: string
  email: string
  esito: EsitoRiconciliazione
  accessoId: string | null
  estrazioneId: string | null
  nomePersona: string
  profiloRegistro: string
  ruoloDichiarato: string
  /** Il profilo del catalogo riconosciuto nel ruolo dichiarato, quando riconoscibile. */
  profiloRiconosciuto: string | null
}

export interface Riconciliazione {
  righe: RigaRiconciliata[]
  /** Asset attivi per cui non esiste un'estrazione abbastanza recente: su questi la riconciliazione non dice niente. */
  assetNonCoperti: string[]
  assetCoperti: string[]
}
