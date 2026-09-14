import { piattaforme } from '@mapicy/catalogo'
import { avanzamentoCampagna, type AvanzamentoCampagna } from './campagne.js'
import { anomalieAperte, controlliNonVerificabili, eseguiControlli } from './controlli.js'
import { derivaAccesso } from './derivazioni.js'
import { riconcilia } from './riconciliazione.js'
import type { DataIso, Documento, EsitoControllo } from './tipi.js'

export interface RigaPiattaforma {
  piattaforma: string
  assetAttivi: number
  accessiAttivi: number
  rischioAlto: number
  senzaMfa: number
  daVerificare: number
  nonRiscontrati: number
}

export interface Cruscotto {
  avanzamento: AvanzamentoCampagna
  assetAttivi: number
  accessiAttivi: number
  accessiRischioAlto: number
  accessiSenzaMfa: number
  accessiRevocati: number
  righeEstrazione: number
  anomalieAperte: number
  /** Numero di controlli che non si possono valutare perché mancano estrazioni recenti. */
  controlliNonVerificabili: number
  /** Asset attivi senza un'estrazione abbastanza recente: su questi la riconciliazione non dice niente. */
  assetSenzaEstrazione: string[]
  perPiattaforma: RigaPiattaforma[]
  controlli: EsitoControllo[]
}

export function cruscotto(documento: Documento, oggi: DataIso): Cruscotto {
  const controlli = eseguiControlli(documento, oggi)
  const r = riconcilia(documento, oggi)
  const derivati = documento.accessi.map((a) => derivaAccesso(documento, a))
  const attivi = derivati.filter((d) => d.accesso.stato === 'attivo')
  const c07 = controlli.find((c) => c.codice === 'C07')
  const idDaVerificare = new Set(c07?.casi.map((c) => c.id) ?? [])
  const nonRiscontrati = new Set(
    r.righe.filter((x) => x.esito === 'non-riscontrato').map((x) => x.accessoId),
  )

  const perPiattaforma: RigaPiattaforma[] = piattaforme().map((p) => {
    const assetDellaPiattaforma = documento.asset.filter((a) => a.piattaforma === p)
    const codici = new Set(assetDellaPiattaforma.filter((a) => a.stato === 'attivo').map((a) => a.codice))
    const accessi = attivi.filter((d) => codici.has(d.accesso.codiceAsset))
    return {
      piattaforma: p,
      assetAttivi: codici.size,
      accessiAttivi: accessi.length,
      rischioAlto: accessi.filter((d) => d.rischio === 'alto').length,
      senzaMfa: accessi.filter((d) => d.accesso.mfaAttiva === 'no' || d.accesso.mfaAttiva === 'da-verificare').length,
      daVerificare: accessi.filter((d) => idDaVerificare.has(d.accesso.id)).length,
      nonRiscontrati: accessi.filter((d) => nonRiscontrati.has(d.accesso.id)).length,
    }
  })

  return {
    avanzamento: avanzamentoCampagna(documento),
    assetAttivi: documento.asset.filter((a) => a.stato === 'attivo').length,
    accessiAttivi: attivi.length,
    accessiRischioAlto: attivi.filter((d) => d.rischio === 'alto').length,
    accessiSenzaMfa: attivi.filter(
      (d) => d.accesso.mfaAttiva === 'no' || d.accesso.mfaAttiva === 'da-verificare',
    ).length,
    accessiRevocati: documento.accessi.filter((a) => a.stato === 'revocato').length,
    righeEstrazione: documento.estrazioni.length,
    anomalieAperte: anomalieAperte(controlli),
    controlliNonVerificabili: controlliNonVerificabili(controlli).length,
    assetSenzaEstrazione: r.assetNonCoperti,
    perPiattaforma,
    controlli,
  }
}

/** Le piattaforme su cui l'agenzia ha davvero qualcosa, per non mostrare quattordici righe a zero. */
export function piattaformeInUso(c: Cruscotto): RigaPiattaforma[] {
  return c.perPiattaforma.filter((r) => r.assetAttivi > 0 || r.accessiAttivi > 0)
}

/** Sintesi in una frase, per l'apertura dell'applicativo. */
export function sintesi(c: Cruscotto, soglia: number): string {
  const bloccanti = c.controlli.filter((x) => x.gravita === 'bloccante' && x.stato === 'da-correggere')
  if (bloccanti.length > 0) {
    const casi = bloccanti.reduce((n, x) => n + x.casi.length, 0)
    return `Ci sono ${casi} ${casi === 1 ? 'caso' : 'casi'} da risolvere subito: ${bloccanti.map((x) => x.titolo.toLowerCase()).join('; ')}.`
  }
  if (c.controlliNonVerificabili > 0) {
    return `Nessun problema bloccante, ma ${c.controlliNonVerificabili} controlli non si possono valutare: mancano estrazioni recenti per ${c.assetSenzaEstrazione.length} asset.`
  }
  if (c.avanzamento.daVerificare > 0) {
    return `Restano ${c.avanzamento.daVerificare} accessi da verificare in questa campagna. La soglia di validità di una verifica è ${soglia} giorni.`
  }
  return 'Tutti i controlli sono a posto e non restano accessi da verificare.'
}
