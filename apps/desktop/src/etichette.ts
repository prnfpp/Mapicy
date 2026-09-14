import type {
  Accesso,
  Asset,
  EsitoControllo,
  EsitoRiconciliazione,
  EsitoVerifica,
  Persona,
} from '@mapicy/core'
import type { Gravita, LivelloRischio } from '@mapicy/catalogo'

/**
 * I codici interni e le parole che si vedono a schermo, tenuti separati.
 * La logica confronta `'revocato'`; l'interfaccia scrive «Revocato». Chi
 * corregge una maiuscola qui non rompe un controllo.
 */

export const STATO_ACCESSO: Record<Accesso['stato'], string> = {
  'da-attivare': 'Da attivare',
  attivo: 'Attivo',
  sospeso: 'Sospeso',
  revocato: 'Revocato',
}

export const STATO_ASSET: Record<Asset['stato'], string> = { attivo: 'Attivo', dismesso: 'Dismesso' }

export const STATO_PERSONA: Record<Persona['stato'], string> = {
  attivo: 'In forza',
  sospeso: 'Sospesa',
  cessato: 'Cessata',
}

export const MFA: Record<Accesso['mfaAttiva'], string> = {
  si: 'Sì',
  no: 'No',
  'non-applicabile': 'Non applicabile',
  'da-verificare': 'Da verificare',
}

export const RISCHIO: Record<LivelloRischio, string> = { alto: 'Alto', medio: 'Medio', basso: 'Basso' }

export const GRAVITA: Record<Gravita, string> = {
  bloccante: 'Bloccante',
  alta: 'Alta',
  media: 'Media',
  informativo: 'Informativo',
}

export const STATO_CONTROLLO: Record<EsitoControllo['stato'], string> = {
  ok: 'A posto',
  'da-correggere': 'Da correggere',
  informativo: 'Da guardare',
  'non-verificabile': 'Non verificabile',
}

export const ESITO_VERIFICA: Record<EsitoVerifica, string> = {
  confermato: 'Confermato',
  'profilo-ridotto': 'Profilo ridotto',
  revocato: 'Revocato',
  'da-verificare': 'Da verificare',
}

export const ESITO_CONFRONTO: Record<EsitoRiconciliazione, string> = {
  ok: 'Coincide',
  'non-censito': 'Non censito nel registro',
  'profilo-diverso': 'Profilo diverso dal registro',
  'revoca-non-eseguita': 'Revoca non eseguita',
  'non-riscontrato': 'Non riscontrato sulla piattaforma',
}

/** Spiegazione dell'esito del confronto, per chi non l'ha mai visto. */
export const SPIEGA_CONFRONTO: Record<EsitoRiconciliazione, string> = {
  ok: 'Il registro e la piattaforma dicono la stessa cosa.',
  'non-censito':
    'La piattaforma dà accesso a una persona che nel registro non c’è. È il caso più grave: un accesso mai autorizzato o mai documentato.',
  'profilo-diverso':
    'La persona c’è in entrambi, ma con un permesso diverso. Il privilegio è cambiato senza autorizzazione, oppure il registro è rimasto indietro.',
  'revoca-non-eseguita':
    'Nel registro l’accesso non è attivo, ma la piattaforma lo elenca ancora: la revoca è stata annotata e non eseguita.',
  'non-riscontrato':
    'Il registro dichiara un accesso attivo che la piattaforma non ha. Probabilmente è già stato rimosso e il registro non è stato aggiornato.',
}

export const CLASSE_CONFRONTO: Record<EsitoRiconciliazione, string> = {
  ok: 'ok',
  'non-censito': 'alto',
  'profilo-diverso': 'medio',
  'revoca-non-eseguita': 'medio',
  'non-riscontrato': 'medio',
}

export const CLASSE_CONTROLLO: Record<EsitoControllo['stato'], string> = {
  ok: 'ok',
  'da-correggere': 'alto',
  informativo: 'neutra',
  'non-verificabile': 'medio',
}

export function numero(n: number, singolare: string, plurale: string): string {
  return `${n} ${n === 1 ? singolare : plurale}`
}
