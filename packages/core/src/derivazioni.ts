import { trovaProfilo } from '@mapicy/catalogo'
import type { Accesso, AccessoDerivato, Asset, Documento, Persona } from './tipi.js'

/**
 * Perché dati trattati, attività e rischio non sono campi dell'accesso.
 *
 * Nell'Excel di partenza erano colonne compilate per riga. Il difetto emerge
 * la prima volta che si corregge la descrizione di un profilo: le righe
 * scritte prima restano con il testo vecchio, e il registro contiene due
 * versioni della stessa verità senza che si veda quale sia aggiornata.
 *
 * Qui il testo è uno solo, sta nel catalogo, e ogni lettura lo risolve. Chi ha
 * bisogno del testo congelato a una data — un'evidenza da allegare — lo ottiene
 * dall'esportazione PDF, che porta la data in cui è stata generata.
 */

export function assetPerCodice(documento: Documento, codice: string): Asset | null {
  return documento.asset.find((a) => a.codice === codice) ?? null
}

export function personaPerId(documento: Documento, id: string): Persona | null {
  return documento.persone.find((p) => p.id === id) ?? null
}

export function derivaAccesso(documento: Documento, accesso: Accesso): AccessoDerivato {
  const asset = assetPerCodice(documento, accesso.codiceAsset)
  const persona = personaPerId(documento, accesso.personaId)

  if (!asset) {
    return {
      accesso,
      asset: null,
      persona,
      datiTrattati: '',
      attivita: '',
      rischio: null,
      problema: `Il codice asset "${accesso.codiceAsset}" non è in anagrafica: senza l'asset non si sa a quale piattaforma si riferisce il profilo.`,
    }
  }
  if (!accesso.profilo) {
    return {
      accesso,
      asset,
      persona,
      datiTrattati: '',
      attivita: '',
      rischio: null,
      problema: 'Manca il profilo autorizzativo: finché non è indicato non si può dire cosa tratta questo accesso.',
    }
  }

  const profilo = trovaProfilo(asset.piattaforma, asset.tipoAsset, accesso.profilo)
  if (!profilo) {
    return {
      accesso,
      asset,
      persona,
      datiTrattati: '',
      attivita: '',
      rischio: null,
      problema: `Il profilo "${accesso.profilo}" non esiste nel catalogo per ${asset.piattaforma} / ${asset.tipoAsset}. Correggere il profilo, oppure aggiungerlo al catalogo se la piattaforma l'ha introdotto.`,
    }
  }

  return {
    accesso,
    asset,
    persona,
    datiTrattati: profilo.datiTrattati,
    attivita: profilo.attivita,
    rischio: profilo.rischio,
    problema: null,
  }
}

export function derivaTutti(documento: Documento): AccessoDerivato[] {
  return documento.accessi.map((a) => derivaAccesso(documento, a))
}

/** Il nome con cui indicare un accesso in un messaggio: «Mario Rossi su ROSSI-META-FB». */
export function etichettaAccesso(documento: Documento, accesso: Accesso): string {
  const persona = personaPerId(documento, accesso.personaId)
  const nome = persona?.nome || accesso.email || 'persona non indicata'
  return `${nome} su ${accesso.codiceAsset}`
}
