import { definizioneControllo } from '@mapicy/catalogo'
import { giorniFra, primaDi } from './date.js'
import { derivaAccesso, etichettaAccesso, personaPerId } from './derivazioni.js'
import { riconcilia } from './riconciliazione.js'
import type {
  CasoControllo,
  DataIso,
  Documento,
  EsitoControllo,
  Riconciliazione,
} from './tipi.js'

/**
 * I diciassette controlli, nell'ordine e con la gravità del template di
 * partenza. Ognuno restituisce **l'elenco dei casi**, non un conteggio: un
 * controllo che dice «ci sono tre problemi» senza dire quali costringe a
 * cercarli a mano, e allora tanto valeva il foglio di calcolo.
 *
 * Quattro controlli (C02-C05) dipendono dalle estrazioni. Su questi, zero casi
 * non significa «tutto bene» se le estrazioni mancano: significa «non ho
 * guardato». Lo stato `non-verificabile` tiene separati i due, perché
 * confonderli era il difetto più insidioso del file da cui nasce il progetto.
 */

function componi(
  codice: string,
  casi: CasoControllo[],
  assetNonCoperti: string[] = [],
): EsitoControllo {
  const definizione = definizioneControllo(codice)
  if (!definizione) throw new Error(`Il controllo ${codice} non è definito nel catalogo.`)
  let stato: EsitoControllo['stato']
  if (definizione.gravita === 'informativo') stato = casi.length > 0 ? 'informativo' : 'ok'
  else if (casi.length > 0) stato = 'da-correggere'
  else if (assetNonCoperti.length > 0) stato = 'non-verificabile'
  else stato = 'ok'
  return {
    codice,
    titolo: definizione.titolo,
    gravita: definizione.gravita,
    stato,
    casi,
    comeCorreggere: definizione.comeCorreggere,
    assetNonCoperti,
  }
}

export function eseguiControlli(documento: Documento, oggi: DataIso): EsitoControllo[] {
  const r = riconcilia(documento, oggi)
  const attivi = documento.accessi.filter((a) => a.stato === 'attivo')
  const assetAttivi = documento.asset.filter((a) => a.stato === 'attivo')
  const codiciAsset = new Set(documento.asset.map((a) => a.codice))
  const daRiconciliazione = (
    esito: Riconciliazione['righe'][number]['esito'],
    descrivi: (riga: Riconciliazione['righe'][number]) => string,
  ): CasoControllo[] =>
    r.righe
      .filter((x) => x.esito === esito)
      .map((x) => ({
        tipo: x.estrazioneId ? ('estrazione' as const) : ('accesso' as const),
        id: x.estrazioneId ?? x.accessoId ?? '',
        descrizione: descrivi(x),
      }))

  // C01 — la persona non c'è più, l'accesso sì.
  const c01 = attivi
    .filter((a) => personaPerId(documento, a.personaId)?.stato === 'cessato')
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: `${etichettaAccesso(documento, a)}: la persona è cessata e l'accesso è ancora attivo.`,
    }))

  // C02 — la piattaforma ha qualcuno che il registro non prevede.
  const c02 = daRiconciliazione(
    'non-censito',
    (x) =>
      `${x.email}${x.nomePersona ? ` (${x.nomePersona})` : ''} ha accesso a ${x.codiceAsset} come "${x.ruoloDichiarato}" senza risultare nel registro.`,
  )

  // C03 — il registro dichiara un accesso che sulla piattaforma non c'è più.
  const c03 = daRiconciliazione(
    'non-riscontrato',
    (x) =>
      `${x.nomePersona || x.email} risulta attivo su ${x.codiceAsset} nel registro, ma non compare nell'estrazione.`,
  )

  // C04 — il privilegio è cambiato senza autorizzazione, o il registro è disallineato.
  const c04 = daRiconciliazione(
    'profilo-diverso',
    (x) =>
      `${x.nomePersona || x.email} su ${x.codiceAsset}: il registro dice "${x.profiloRegistro}", la piattaforma "${x.ruoloDichiarato}".`,
  )

  // C05 — revoca dichiarata ma non eseguita.
  const c05 = daRiconciliazione(
    'revoca-non-eseguita',
    (x) =>
      `${x.nomePersona || x.email} non ha un accesso attivo a ${x.codiceAsset} nel registro, ma la piattaforma lo elenca ancora come "${x.ruoloDichiarato}".`,
  )

  // C06 — accessi attivi senza verifica in due passaggi.
  const c06 = attivi
    .filter((a) => a.mfaAttiva === 'no' || a.mfaAttiva === 'da-verificare')
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione:
        a.mfaAttiva === 'no'
          ? `${etichettaAccesso(documento, a)}: l'account usato non ha la verifica in due passaggi.`
          : `${etichettaAccesso(documento, a)}: non è stato verificato se l'account ha la verifica in due passaggi.`,
    }))

  // C07 — accessi attivi mai verificati o verificati troppo tempo fa.
  const soglia = documento.impostazioni.giorniValiditaVerifica
  const c07 = attivi
    .filter((a) => !a.dataUltimaVerifica || giorniFra(a.dataUltimaVerifica, oggi) > soglia)
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: a.dataUltimaVerifica
        ? `${etichettaAccesso(documento, a)}: verificato ${giorniFra(a.dataUltimaVerifica, oggi)} giorni fa, oltre la soglia di ${soglia}.`
        : `${etichettaAccesso(documento, a)}: mai verificato.`,
    }))

  // C08 — la stessa persona due volte attiva sullo stesso asset.
  const perCoppia = new Map<string, typeof attivi>()
  for (const a of attivi) {
    const k = `${a.personaId}|${a.codiceAsset}`
    const gruppo = perCoppia.get(k)
    if (gruppo) gruppo.push(a)
    else perCoppia.set(k, [a])
  }
  const c08: CasoControllo[] = []
  for (const gruppo of perCoppia.values()) {
    if (gruppo.length < 2 || !gruppo[0].personaId) continue
    for (const a of gruppo) {
      c08.push({
        tipo: 'accesso',
        id: a.id,
        descrizione: `${etichettaAccesso(documento, a)}: ${gruppo.length} accessi attivi sullo stesso asset (profili: ${gruppo.map((x) => x.profilo || 'non indicato').join(', ')}).`,
      })
    }
  }

  // C09 — c'è la persona ma non il profilo.
  const c09 = documento.accessi
    .filter((a) => a.personaId && !a.profilo && a.stato !== 'revocato')
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: `${etichettaAccesso(documento, a)}: manca il profilo autorizzativo.`,
    }))

  // C10 — profilo che il catalogo non conosce.
  const c10 = documento.accessi
    .filter((a) => a.stato !== 'revocato' && a.profilo && codiciAsset.has(a.codiceAsset))
    .map((a) => ({ accesso: a, derivato: derivaAccesso(documento, a) }))
    .filter((x) => x.derivato.rischio === null)
    .map((x) => ({
      tipo: 'accesso' as const,
      id: x.accesso.id,
      descrizione: `${etichettaAccesso(documento, x.accesso)}: ${x.derivato.problema}`,
    }))

  // C11 — accesso che punta a una persona che non è in anagrafica.
  const c11 = documento.accessi
    .filter((a) => a.stato !== 'revocato' && (!a.personaId || !personaPerId(documento, a.personaId)))
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: `Accesso a ${a.codiceAsset} con account ${a.email || 'non indicato'}: la persona non è in anagrafica.`,
    }))

  // C12 — codice asset che non esiste in anagrafica.
  const c12 = documento.accessi
    .filter((a) => !codiciAsset.has(a.codiceAsset))
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: `L'accesso di ${personaPerId(documento, a.personaId)?.nome || a.email} usa il codice asset "${a.codiceAsset}", che non è in anagrafica.`,
    }))

  // C13 — accesso attivo senza data di concessione.
  const c13 = attivi
    .filter((a) => !a.dataConcessione)
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: `${etichettaAccesso(documento, a)}: manca la data in cui l'accesso è stato concesso.`,
    }))

  // C14 — accesso revocato senza data di revoca: manca l'evidenza.
  const c14 = documento.accessi
    .filter((a) => a.stato === 'revocato' && !a.dataRevoca)
    .map((a) => ({
      tipo: 'accesso' as const,
      id: a.id,
      descrizione: `${etichettaAccesso(documento, a)}: risulta revocato ma senza data di revoca, che è l'evidenza della rimozione.`,
    }))

  // C15 — asset senza titolare del trattamento.
  const c15 = assetAttivi
    .filter((a) => !a.titolare.trim())
    .map((a) => ({
      tipo: 'asset' as const,
      id: a.id,
      descrizione: `${a.codice} (${a.nome}): manca il titolare del trattamento.`,
    }))

  // C16 — asset attivo con verifica scaduta o mai pianificata.
  const c16 = assetAttivi
    .filter((a) => !a.prossimaVerifica || primaDi(a.prossimaVerifica, oggi))
    .map((a) => ({
      tipo: 'asset' as const,
      id: a.id,
      descrizione: a.prossimaVerifica
        ? `${a.codice}: la verifica accessi era prevista per il ${a.prossimaVerifica} ed è scaduta.`
        : `${a.codice}: non è stata pianificata la prossima verifica accessi.`,
    }))

  // C17 — non è un errore: è l'elenco da guardare in ottica di minimizzazione.
  const c17 = attivi
    .map((a) => ({ accesso: a, derivato: derivaAccesso(documento, a) }))
    .filter((x) => x.derivato.rischio === 'alto')
    .map((x) => ({
      tipo: 'accesso' as const,
      id: x.accesso.id,
      descrizione: `${etichettaAccesso(documento, x.accesso)} con profilo "${x.accesso.profilo}": rischio privacy alto.`,
    }))

  return [
    componi('C01', c01),
    componi('C02', c02, r.assetNonCoperti),
    componi('C03', c03, r.assetNonCoperti),
    componi('C04', c04, r.assetNonCoperti),
    componi('C05', c05, r.assetNonCoperti),
    componi('C06', c06),
    componi('C07', c07),
    componi('C08', c08),
    componi('C09', c09),
    componi('C10', c10),
    componi('C11', c11),
    componi('C12', c12),
    componi('C13', c13),
    componi('C14', c14),
    componi('C15', c15),
    componi('C16', c16),
    componi('C17', c17),
  ]
}

export function controlliBloccantiAperti(esiti: readonly EsitoControllo[]): EsitoControllo[] {
  return esiti.filter((e) => e.gravita === 'bloccante' && e.stato === 'da-correggere')
}

export function anomalieAperte(esiti: readonly EsitoControllo[]): number {
  return esiti.filter((e) => e.stato === 'da-correggere').length
}

export function controlliNonVerificabili(esiti: readonly EsitoControllo[]): EsitoControllo[] {
  return esiti.filter((e) => e.stato === 'non-verificabile')
}
