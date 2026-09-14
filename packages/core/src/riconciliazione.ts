import { mappaRuoloDichiarato, normalizza } from '@mapicy/catalogo'
import { giorniFra } from './date.js'
import { assetPerCodice, personaPerId } from './derivazioni.js'
import type {
  DataIso,
  Documento,
  EsitoRiconciliazione,
  Riconciliazione,
  RigaRiconciliata,
} from './tipi.js'

/**
 * Normalizzazione delle e-mail: minuscolo e spazi via, niente altro.
 *
 * In particolare **non** si rimuovono i punti nella parte locale né i suffissi
 * `+tag`. Su Gmail sono equivalenti, altrove no: `m.rossi@` e `mrossi@`
 * possono essere due caselle di due persone diverse. Accorparle vorrebbe dire
 * dichiarare «OK» l'accesso di qualcun altro, che è l'errore peggiore che
 * questo confronto possa commettere.
 */
export function normalizzaEmail(email: string): string {
  return email.trim().toLowerCase()
}

const chiave = (codiceAsset: string, email: string) =>
  `${normalizza(codiceAsset)}|${normalizzaEmail(email)}`

/**
 * Confronta quello che l'agenzia dichiara (il registro) con quello che la
 * piattaforma dichiara (le estrazioni).
 *
 * Il confronto avviene solo sugli asset per cui esiste un'estrazione
 * abbastanza recente. Gli altri finiscono in `assetNonCoperti`: dire «nessun
 * problema» su un asset che non si è guardato è il modo più efficace di
 * rendere inutile un controllo.
 */
export function riconcilia(documento: Documento, oggi: DataIso): Riconciliazione {
  const limite = documento.impostazioni.giorniValiditaEstrazione

  const estrazioniValide = documento.estrazioni.filter(
    (e) => giorniFra(e.dataEstrazione, oggi) <= limite && giorniFra(e.dataEstrazione, oggi) >= 0,
  )

  const assetCoperti = new Set(estrazioniValide.map((e) => normalizza(e.codiceAsset)))
  const assetAttivi = documento.asset.filter((a) => a.stato === 'attivo')
  const assetNonCoperti = assetAttivi
    .filter((a) => !assetCoperti.has(normalizza(a.codice)))
    .map((a) => a.codice)

  // Per ogni asset coperto tengo solo l'estrazione più recente di ciascuna
  // persona: se si importa due volte lo stesso elenco, il confronto non deve
  // raddoppiare le righe.
  const ultimaPerChiave = new Map<string, (typeof estrazioniValide)[number]>()
  for (const e of estrazioniValide) {
    const k = chiave(e.codiceAsset, e.email)
    const precedente = ultimaPerChiave.get(k)
    if (!precedente || giorniFra(precedente.dataEstrazione, e.dataEstrazione) > 0) {
      ultimaPerChiave.set(k, e)
    }
  }

  const accessiPerChiave = new Map<string, (typeof documento.accessi)[number]>()
  for (const a of documento.accessi) {
    const k = chiave(a.codiceAsset, a.email)
    const precedente = accessiPerChiave.get(k)
    // A parità di chiave vince l'accesso attivo: è quello di cui la
    // piattaforma sta parlando.
    if (!precedente || (precedente.stato !== 'attivo' && a.stato === 'attivo')) {
      accessiPerChiave.set(k, a)
    }
  }

  const righe: RigaRiconciliata[] = []

  for (const [k, estrazione] of ultimaPerChiave) {
    const accesso = accessiPerChiave.get(k) ?? null
    const asset = assetPerCodice(documento, estrazione.codiceAsset)
    const riconosciuto = asset
      ? (mappaRuoloDichiarato(asset.piattaforma, asset.tipoAsset, estrazione.ruoloDichiarato)?.profilo ?? null)
      : null

    let esito: EsitoRiconciliazione
    if (!accesso) esito = 'non-censito'
    else if (accesso.stato !== 'attivo') esito = 'revoca-non-eseguita'
    else if (!riconosciuto) {
      // La piattaforma dichiara un ruolo che il catalogo non riconosce: non si
      // può affermare che coincida con quello del registro, ma non è nemmeno
      // un profilo diverso. Si segnala come diverso, che è il caso che porta
      // qualcuno a guardarlo.
      esito = normalizza(estrazione.ruoloDichiarato) === normalizza(accesso.profilo) ? 'ok' : 'profilo-diverso'
    } else esito = riconosciuto === accesso.profilo ? 'ok' : 'profilo-diverso'

    righe.push({
      codiceAsset: estrazione.codiceAsset,
      email: estrazione.email,
      esito,
      accessoId: accesso?.id ?? null,
      estrazioneId: estrazione.id,
      nomePersona:
        estrazione.nomePersona ||
        (accesso ? (personaPerId(documento, accesso.personaId)?.nome ?? '') : ''),
      profiloRegistro: accesso?.profilo ?? '',
      ruoloDichiarato: estrazione.ruoloDichiarato,
      profiloRiconosciuto: riconosciuto,
    })
  }

  // L'altro verso: accessi che il registro dichiara attivi e che l'estrazione
  // non ha trovato. Solo sugli asset coperti, per la ragione di sopra.
  for (const accesso of documento.accessi) {
    if (accesso.stato !== 'attivo') continue
    if (!assetCoperti.has(normalizza(accesso.codiceAsset))) continue
    const k = chiave(accesso.codiceAsset, accesso.email)
    if (ultimaPerChiave.has(k)) continue
    righe.push({
      codiceAsset: accesso.codiceAsset,
      email: accesso.email,
      esito: 'non-riscontrato',
      accessoId: accesso.id,
      estrazioneId: null,
      nomePersona: personaPerId(documento, accesso.personaId)?.nome ?? '',
      profiloRegistro: accesso.profilo,
      ruoloDichiarato: '',
      profiloRiconosciuto: null,
    })
  }

  return {
    righe,
    assetNonCoperti,
    assetCoperti: assetAttivi.filter((a) => assetCoperti.has(normalizza(a.codice))).map((a) => a.codice),
  }
}

export function righePerEsito(r: Riconciliazione, esito: EsitoRiconciliazione): RigaRiconciliata[] {
  return r.righe.filter((x) => x.esito === esito)
}
