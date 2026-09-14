import { describe, expect, it } from 'vitest'
import { anomalieAperte, controlliBloccantiAperti, eseguiControlli } from '@mapicy/core'
import { OGGI, accesso, asset, documentoSano, estrazione, per, persona } from './impalcatura.js'

describe('lo scenario sano non produce anomalie', () => {
  it('ha tutti i controlli a posto tranne gli informativi', () => {
    const esiti = eseguiControlli(documentoSano(), OGGI)
    expect(esiti).toHaveLength(17)
    const problemi = esiti.filter((e) => e.stato !== 'ok' && e.stato !== 'informativo')
    expect(problemi.map((p) => `${p.codice}: ${p.casi.map((c) => c.descrizione).join(' | ')}`)).toEqual([])
    expect(anomalieAperte(esiti)).toBe(0)
  })
})

describe('C01 — persone cessate con accesso attivo', () => {
  it('trova l’accesso ancora attivo di chi è uscito, e lo dice bloccante', () => {
    const d = documentoSano()
    d.persone = [persona({ id: 'p1', nome: 'Mario Rossi', stato: 'cessato', dataCessazione: '2026-08-31' })]
    const esiti = eseguiControlli(d, OGGI)
    const c01 = per(esiti, 'C01')
    expect(c01.stato).toBe('da-correggere')
    expect(c01.casi).toHaveLength(1)
    expect(c01.casi[0].descrizione).toContain('Mario Rossi')
    expect(c01.casi[0].descrizione).toContain('cessata')
    expect(controlliBloccantiAperti(esiti).map((c) => c.codice)).toContain('C01')
  })

  it('non segnala chi è cessato se l’accesso è già stato revocato', () => {
    const d = documentoSano()
    d.persone = [persona({ id: 'p1', nome: 'Mario Rossi', stato: 'cessato' })]
    d.accessi = [
      accesso({
        id: 'x1',
        codiceAsset: 'ROSSI-META-FB',
        personaId: 'p1',
        stato: 'revocato',
        dataRevoca: '2026-09-01',
      }),
    ]
    d.estrazioni = []
    expect(per(eseguiControlli(d, OGGI), 'C01').stato).toBe('ok')
  })
})

describe('i controlli che dipendono dalle estrazioni', () => {
  it('senza estrazioni dicono «non verificabile» invece di «ok»', () => {
    const d = documentoSano()
    d.estrazioni = []
    const esiti = eseguiControlli(d, OGGI)
    for (const codice of ['C02', 'C03', 'C04', 'C05']) {
      const c = per(esiti, codice)
      expect(c.stato, codice).toBe('non-verificabile')
      expect(c.assetNonCoperti).toEqual(['ROSSI-META-FB'])
    }
  })

  it('con un’estrazione troppo vecchia restano non verificabili', () => {
    const d = documentoSano()
    d.estrazioni = [
      estrazione({ id: 'e1', codiceAsset: 'ROSSI-META-FB', email: 'p1@agenzia.it', dataEstrazione: '2025-01-01' }),
    ]
    expect(per(eseguiControlli(d, OGGI), 'C02').stato).toBe('non-verificabile')
  })

  it('con un’estrazione recente che coincide diventano ok', () => {
    const esiti = eseguiControlli(documentoSano(), OGGI)
    for (const codice of ['C02', 'C03', 'C04', 'C05']) {
      expect(per(esiti, codice).stato, codice).toBe('ok')
    }
  })
})

describe('C02 — utenti sulla piattaforma non censiti nel registro', () => {
  it('trova chi ha accesso senza essere autorizzato', () => {
    const d = documentoSano()
    d.estrazioni.push(
      estrazione({
        id: 'e2',
        codiceAsset: 'ROSSI-META-FB',
        email: 'intruso@altro.it',
        nomePersona: 'Marco Cantelli',
        ruoloDichiarato: 'Accesso completo alla Pagina',
      }),
    )
    const c02 = per(eseguiControlli(d, OGGI), 'C02')
    expect(c02.stato).toBe('da-correggere')
    expect(c02.casi).toHaveLength(1)
    expect(c02.casi[0].descrizione).toContain('intruso@altro.it')
    expect(c02.casi[0].descrizione).toContain('Marco Cantelli')
  })
})

describe('C03 — accessi attivi che la piattaforma non ha più', () => {
  it('trova la riga che il registro dichiara e l’estrazione non conferma', () => {
    const d = documentoSano()
    d.accessi.push(
      accesso({ id: 'x2', codiceAsset: 'ROSSI-META-FB', personaId: 'p1', email: 'vecchia@agenzia.it' }),
    )
    const c03 = per(eseguiControlli(d, OGGI), 'C03')
    expect(c03.stato).toBe('da-correggere')
    expect(c03.casi).toHaveLength(1)
    expect(c03.casi[0].id).toBe('x2')
  })

  it('non segnala accessi su asset che nessuna estrazione copre', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-GADS', piattaforma: 'Google', tipoAsset: 'Account Google Ads' }))
    d.accessi.push(
      accesso({ id: 'x2', codiceAsset: 'ROSSI-GADS', personaId: 'p1', profilo: 'Sola lettura' }),
    )
    const c03 = per(eseguiControlli(d, OGGI), 'C03')
    expect(c03.casi).toEqual([])
    expect(c03.stato).toBe('non-verificabile')
    expect(c03.assetNonCoperti).toEqual(['ROSSI-GADS'])
  })
})

describe('C04 — profilo diverso fra registro e piattaforma', () => {
  it('trova il privilegio cambiato senza autorizzazione e riporta entrambe le versioni', () => {
    const d = documentoSano()
    d.estrazioni[0].ruoloDichiarato = 'Accesso completo alla Pagina'
    const c04 = per(eseguiControlli(d, OGGI), 'C04')
    expect(c04.stato).toBe('da-correggere')
    expect(c04.casi[0].descrizione).toContain('Accesso parziale alla Pagina')
    expect(c04.casi[0].descrizione).toContain('Accesso completo alla Pagina')
  })

  it('riconosce il profilo anche se la piattaforma lo scrive con maiuscole diverse', () => {
    const d = documentoSano()
    d.estrazioni[0].ruoloDichiarato = 'ACCESSO PARZIALE ALLA PAGINA'
    expect(per(eseguiControlli(d, OGGI), 'C04').stato).toBe('ok')
  })
})

describe('C05 — revoca dichiarata ma non eseguita', () => {
  it('trova chi è revocato nel registro ma sta ancora sulla piattaforma', () => {
    const d = documentoSano()
    d.accessi[0] = accesso({
      id: 'x1',
      codiceAsset: 'ROSSI-META-FB',
      personaId: 'p1',
      stato: 'revocato',
      dataRevoca: '2026-09-01',
    })
    const c05 = per(eseguiControlli(d, OGGI), 'C05')
    expect(c05.stato).toBe('da-correggere')
    expect(c05.casi[0].descrizione).toContain('la piattaforma lo elenca ancora')
  })
})

describe('C06 e C07 — igiene degli accessi attivi', () => {
  it('C06 distingue «senza MFA» da «MFA non verificata»', () => {
    const d = documentoSano()
    d.accessi[0].mfaAttiva = 'no'
    expect(per(eseguiControlli(d, OGGI), 'C06').casi[0].descrizione).toContain('non ha la verifica in due passaggi')
    d.accessi[0].mfaAttiva = 'da-verificare'
    expect(per(eseguiControlli(d, OGGI), 'C06').casi[0].descrizione).toContain('non è stato verificato')
    d.accessi[0].mfaAttiva = 'non-applicabile'
    expect(per(eseguiControlli(d, OGGI), 'C06').stato).toBe('ok')
  })

  it('C07 segnala chi non è mai stato verificato e chi lo è da troppo tempo', () => {
    const d = documentoSano()
    d.accessi[0].dataUltimaVerifica = null
    expect(per(eseguiControlli(d, OGGI), 'C07').casi[0].descrizione).toContain('mai verificato')

    d.accessi[0].dataUltimaVerifica = '2026-01-01'
    const scaduto = per(eseguiControlli(d, OGGI), 'C07')
    expect(scaduto.stato).toBe('da-correggere')
    expect(scaduto.casi[0].descrizione).toMatch(/256 giorni fa, oltre la soglia di 180/)
  })

  it('C07 rispetta la soglia configurata invece di un valore fisso', () => {
    const d = documentoSano()
    d.accessi[0].dataUltimaVerifica = '2026-06-01'
    expect(per(eseguiControlli(d, OGGI), 'C07').stato).toBe('ok')
    d.impostazioni.giorniValiditaVerifica = 30
    expect(per(eseguiControlli(d, OGGI), 'C07').stato).toBe('da-correggere')
  })
})

describe('C08 — doppio accesso della stessa persona sullo stesso asset', () => {
  it('elenca entrambe le righe e i profili sovrapposti', () => {
    const d = documentoSano()
    d.accessi.push(
      accesso({
        id: 'x2',
        codiceAsset: 'ROSSI-META-FB',
        personaId: 'p1',
        profilo: 'Accesso completo alla Pagina',
        email: 'p1@agenzia.it',
      }),
    )
    const c08 = per(eseguiControlli(d, OGGI), 'C08')
    expect(c08.casi.map((c) => c.id).sort()).toEqual(['x1', 'x2'])
    expect(c08.casi[0].descrizione).toContain('Accesso parziale alla Pagina, Accesso completo alla Pagina')
  })
})

describe('C09, C10, C11, C12 — righe incomplete o scollegate', () => {
  it('C09 trova la riga con la persona ma senza profilo', () => {
    const d = documentoSano()
    d.accessi[0].profilo = ''
    expect(per(eseguiControlli(d, OGGI), 'C09').casi).toHaveLength(1)
  })

  it('C10 trova il profilo che il catalogo non conosce e spiega cosa fare', () => {
    const d = documentoSano()
    d.accessi[0].profilo = 'Capo supremo della Pagina'
    const c10 = per(eseguiControlli(d, OGGI), 'C10')
    expect(c10.casi).toHaveLength(1)
    expect(c10.casi[0].descrizione).toContain('non esiste nel catalogo')
    expect(c10.casi[0].descrizione).toContain('Meta / Pagina Facebook')
  })

  it('C11 trova l’accesso che punta a una persona non in anagrafica', () => {
    const d = documentoSano()
    d.accessi[0].personaId = 'sconosciuto'
    expect(per(eseguiControlli(d, OGGI), 'C11').casi).toHaveLength(1)
  })

  it('C12 trova il codice asset che non esiste in anagrafica', () => {
    const d = documentoSano()
    d.accessi[0].codiceAsset = 'ROSSI-SBAGLIATO'
    const c12 = per(eseguiControlli(d, OGGI), 'C12')
    expect(c12.casi).toHaveLength(1)
    expect(c12.casi[0].descrizione).toContain('ROSSI-SBAGLIATO')
  })
})

describe('C13 e C14 — le date che sono evidenza', () => {
  it('C13 trova l’accesso attivo senza data di concessione', () => {
    const d = documentoSano()
    d.accessi[0].dataConcessione = null
    expect(per(eseguiControlli(d, OGGI), 'C13').casi).toHaveLength(1)
  })

  it('C14 trova il revocato senza data di revoca, perché manca la prova della rimozione', () => {
    const d = documentoSano()
    d.accessi[0] = accesso({ id: 'x1', codiceAsset: 'ROSSI-META-FB', personaId: 'p1', stato: 'revocato' })
    d.estrazioni = []
    const c14 = per(eseguiControlli(d, OGGI), 'C14')
    expect(c14.casi).toHaveLength(1)
    expect(c14.casi[0].descrizione).toContain('evidenza')
  })
})

describe('C15 e C16 — anagrafica degli asset', () => {
  it('C15 trova l’asset senza titolare del trattamento', () => {
    const d = documentoSano()
    d.asset[0].titolare = '  '
    expect(per(eseguiControlli(d, OGGI), 'C15').casi).toHaveLength(1)
  })

  it('C16 distingue la verifica scaduta da quella mai pianificata', () => {
    const d = documentoSano()
    d.asset[0].prossimaVerifica = '2026-03-31'
    expect(per(eseguiControlli(d, OGGI), 'C16').casi[0].descrizione).toContain('è scaduta')
    d.asset[0].prossimaVerifica = null
    expect(per(eseguiControlli(d, OGGI), 'C16').casi[0].descrizione).toContain('non è stata pianificata')
  })

  it('C16 non guarda gli asset dismessi', () => {
    const d = documentoSano()
    d.asset[0].stato = 'dismesso'
    d.asset[0].prossimaVerifica = null
    expect(per(eseguiControlli(d, OGGI), 'C16').stato).toBe('ok')
  })
})

describe('C17 — accessi a rischio alto', () => {
  it('è informativo, non un errore, e non blocca la campagna', () => {
    const d = documentoSano()
    d.accessi[0].profilo = 'Accesso completo alla Pagina'
    d.estrazioni[0].ruoloDichiarato = 'Accesso completo alla Pagina'
    const esiti = eseguiControlli(d, OGGI)
    const c17 = per(esiti, 'C17')
    expect(c17.stato).toBe('informativo')
    expect(c17.casi[0].descrizione).toContain('rischio privacy alto')
    expect(anomalieAperte(esiti)).toBe(0)
  })
})
