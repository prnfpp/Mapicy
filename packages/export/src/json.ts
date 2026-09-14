import { VERSIONE_SCHEMA, type Documento } from '@mapicy/core'
import { descriviAmbito, filtra, type Ambito } from './ambito.js'

/**
 * Esportazione JSON. Con ambito `tutto` è il backup completo, ed è l'unico
 * formato che Mapicy sa rileggere: se la macchina si rompe si installa
 * l'applicativo altrove, si carica questo file e si riparte.
 *
 * Con un ambito ristretto il file resta leggibile ma non è un backup, e lo
 * dice: un archivio parziale ricaricato al posto di quello buono
 * cancellerebbe gli altri clienti.
 */
export interface EsportazioneJson {
  contenuto: string
  nomeFile: string
  reimportabile: boolean
}

export function esportaJson(documento: Documento, ambito: Ambito, oggi: string): EsportazioneJson {
  const ridotto = filtra(documento, ambito)
  const reimportabile = ambito.tipo === 'tutto'
  const involucro = reimportabile
    ? ridotto
    : {
        ...ridotto,
        // Lo schemaVersion resta, perché serve a leggere il file; il flag dice
        // che ricaricarlo non ripristina l'archivio.
        _avvertenza:
          `Estratto parziale (${descriviAmbito(ambito)}) generato il ${oggi}. ` +
          'Non è un backup: ricaricarlo in Mapicy al posto dell’archivio completo farebbe perdere gli altri asset. ' +
          'Per il backup esportare la mappatura completa.',
      }

  return {
    contenuto: JSON.stringify(involucro, null, 2),
    nomeFile: nomeFile(ambito, oggi, reimportabile ? 'backup' : 'estratto', 'json'),
    reimportabile,
  }
}

export function nomeFile(ambito: Ambito, oggi: string, prefisso: string, estensione: string): string {
  const parte =
    ambito.tipo === 'tutto'
      ? 'completa'
      : ambito.tipo === 'cliente'
        ? sicuro(ambito.cliente)
        : ambito.tipo === 'asset'
          ? sicuro(ambito.codiceAsset)
          : sicuro(ambito.campagna)
  return `mapicy-${prefisso}-${parte}-${oggi}.${estensione}`
}

/** Ripulisce un nome per usarlo in un nome di file su qualunque sistema. */
function sicuro(testo: string): string {
  return (
    testo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'estratto'
  )
}

/** La versione di schema che questa build scrive, da mostrare accanto al backup. */
export const versioneSchemaEsportata = VERSIONE_SCHEMA
