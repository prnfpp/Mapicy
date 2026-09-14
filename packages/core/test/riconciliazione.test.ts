import { describe, expect, it } from 'vitest'
import { derivaAccesso, normalizzaEmail, riconcilia, righePerEsito } from '@mapicy/core'
import { OGGI, accesso, asset, documentoSano, estrazione } from './impalcatura.js'

describe('normalizzazione delle e-mail', () => {
  it('toglie spazi e maiuscole', () => {
    expect(normalizzaEmail('  Mario.Rossi@Agenzia.IT ')).toBe('mario.rossi@agenzia.it')
  })

  it('non accorpa indirizzi che sono equivalenti solo su Gmail', () => {
    // Su Gmail m.rossi@ e mrossi@ arrivano alla stessa casella, altrove no.
    // Accorparli vorrebbe dire dichiarare «OK» l’accesso di un’altra persona.
    expect(normalizzaEmail('m.rossi@agenzia.it')).not.toBe(normalizzaEmail('mrossi@agenzia.it'))
    expect(normalizzaEmail('rossi+meta@agenzia.it')).not.toBe(normalizzaEmail('rossi@agenzia.it'))
  })
})

describe('i cinque esiti del confronto', () => {
  it('ok quando registro e piattaforma coincidono, anche a maiuscole diverse', () => {
    const d = documentoSano()
    d.estrazioni[0].email = 'P1@Agenzia.IT'
    const r = riconcilia(d, OGGI)
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].esito).toBe('ok')
  })

  it('non-censito quando la piattaforma ha un utente che il registro non prevede', () => {
    const d = documentoSano()
    d.estrazioni.push(estrazione({ id: 'e2', codiceAsset: 'ROSSI-META-FB', email: 'ignoto@altro.it' }))
    const righe = righePerEsito(riconcilia(d, OGGI), 'non-censito')
    expect(righe.map((x) => x.email)).toEqual(['ignoto@altro.it'])
  })

  it('profilo-diverso quando il privilegio non corrisponde', () => {
    const d = documentoSano()
    d.estrazioni[0].ruoloDichiarato = 'Accesso completo alla Pagina'
    const righe = righePerEsito(riconcilia(d, OGGI), 'profilo-diverso')
    expect(righe[0].profiloRegistro).toBe('Accesso parziale alla Pagina')
    expect(righe[0].profiloRiconosciuto).toBe('Accesso completo alla Pagina')
  })

  it('revoca-non-eseguita quando il registro dice revocato e la piattaforma no', () => {
    const d = documentoSano()
    d.accessi[0].stato = 'revocato'
    d.accessi[0].dataRevoca = '2026-09-01'
    expect(righePerEsito(riconcilia(d, OGGI), 'revoca-non-eseguita')).toHaveLength(1)
  })

  it('non-riscontrato quando il registro dichiara un accesso che la piattaforma non ha', () => {
    const d = documentoSano()
    d.accessi.push(accesso({ id: 'x2', codiceAsset: 'ROSSI-META-FB', personaId: 'p1', email: 'altra@agenzia.it' }))
    const righe = righePerEsito(riconcilia(d, OGGI), 'non-riscontrato')
    expect(righe.map((x) => x.accessoId)).toEqual(['x2'])
  })
})

describe('copertura: su cosa la riconciliazione tace', () => {
  it('elenca gli asset attivi senza estrazione recente invece di dichiararli a posto', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-GADS', piattaforma: 'Google', tipoAsset: 'Account Google Ads' }))
    const r = riconcilia(d, OGGI)
    expect(r.assetCoperti).toEqual(['ROSSI-META-FB'])
    expect(r.assetNonCoperti).toEqual(['ROSSI-GADS'])
  })

  it('non conta come non coperti gli asset dismessi', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-VECCHIO', stato: 'dismesso' }))
    expect(riconcilia(d, OGGI).assetNonCoperti).toEqual([])
  })

  it('ignora le estrazioni con una data nel futuro, che sono un errore di inserimento', () => {
    const d = documentoSano()
    d.estrazioni[0].dataEstrazione = '2027-01-01'
    const r = riconcilia(d, OGGI)
    expect(r.righe).toEqual([])
    expect(r.assetNonCoperti).toEqual(['ROSSI-META-FB'])
  })
})

describe('doppie importazioni', () => {
  it('non raddoppia le righe se lo stesso elenco viene importato due volte', () => {
    const d = documentoSano()
    d.estrazioni.push(estrazione({ id: 'e2', codiceAsset: 'ROSSI-META-FB', email: 'p1@agenzia.it' }))
    expect(riconcilia(d, OGGI).righe).toHaveLength(1)
  })

  it('a parità di persona e asset tiene l’estrazione più recente', () => {
    const d = documentoSano()
    d.estrazioni[0].dataEstrazione = '2026-06-01'
    d.estrazioni.push(
      estrazione({
        id: 'e2',
        codiceAsset: 'ROSSI-META-FB',
        email: 'p1@agenzia.it',
        ruoloDichiarato: 'Accesso completo alla Pagina',
        dataEstrazione: '2026-09-10',
      }),
    )
    const r = riconcilia(d, OGGI)
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].esito).toBe('profilo-diverso')
    expect(r.righe[0].estrazioneId).toBe('e2')
  })
})

describe('derivazione dal catalogo', () => {
  it('riempie dati trattati, attività e rischio dal profilo', () => {
    const d = documentoSano()
    const derivato = derivaAccesso(d, d.accessi[0])
    expect(derivato.rischio).toBe('medio')
    expect(derivato.datiTrattati).toMatch(/pubblico/i)
    expect(derivato.problema).toBeNull()
    expect(derivato.persona?.nome).toBe('Mario Rossi')
  })

  it('non inventa niente quando il profilo non è nel catalogo, e dice perché', () => {
    const d = documentoSano()
    d.accessi[0].profilo = 'Profilo inventato'
    const derivato = derivaAccesso(d, d.accessi[0])
    expect(derivato.rischio).toBeNull()
    expect(derivato.datiTrattati).toBe('')
    expect(derivato.problema).toMatch(/non esiste nel catalogo/)
  })

  it('spiega il caso dell’asset mancante e quello del profilo mancante con messaggi diversi', () => {
    const d = documentoSano()
    d.accessi[0].codiceAsset = 'NON-ESISTE'
    expect(derivaAccesso(d, d.accessi[0]).problema).toMatch(/non è in anagrafica/)

    const d2 = documentoSano()
    d2.accessi[0].profilo = ''
    expect(derivaAccesso(d2, d2.accessi[0]).problema).toMatch(/Manca il profilo autorizzativo/)
  })
})
