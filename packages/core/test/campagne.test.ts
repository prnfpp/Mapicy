import { describe, expect, it } from 'vitest'
import {
  accessiDaChiudere,
  apriCampagna,
  avanzamentoCampagna,
  chiudiCampagna,
  cruscotto,
  documentoVuoto,
  piattaformeInUso,
  prossimoCodiceCampagna,
  registraVerifica,
  puoChiudereCampagna,
  sintesi,
} from '@mapicy/core'
import { OGGI, accesso, asset, documentoSano, estrazione, persona } from './impalcatura.js'

describe('apertura di una campagna', () => {
  it('propone il semestre corrente e non duplica una campagna già aperta', () => {
    expect(prossimoCodiceCampagna(OGGI, [])).toBe('2026-H2')
    const d = apriCampagna(documentoVuoto(), '2026-H2', OGGI)
    expect(d.campagne).toHaveLength(1)
    expect(d.campagnaCorrente).toBe('2026-H2')
    expect(apriCampagna(d, '2026-H2', OGGI).campagne).toHaveLength(1)
  })

  it('non modifica il documento passato', () => {
    const originale = documentoVuoto()
    apriCampagna(originale, '2026-H2', OGGI)
    expect(originale.campagne).toEqual([])
    expect(originale.campagnaCorrente).toBe('')
  })
})

describe('registrazione di una verifica', () => {
  it('conferma l’accesso, lo timbra e scrive la voce nel registro delle revisioni', () => {
    const d = documentoSano()
    d.accessi[0].dataUltimaVerifica = null
    d.accessi[0].campagnaVerifica = ''
    const dopo = registraVerifica(
      d,
      { accessoId: 'x1', esito: 'confermato', verificatoDa: 'Elena Trentini', idRevisione: 'r1' },
      OGGI,
    )
    expect(dopo.accessi[0].dataUltimaVerifica).toBe(OGGI)
    expect(dopo.accessi[0].esitoUltimaVerifica).toBe('confermato')
    expect(dopo.accessi[0].campagnaVerifica).toBe('2026-H2')
    expect(dopo.revisioni).toHaveLength(1)
    expect(dopo.revisioni[0]).toMatchObject({
      campagna: '2026-H2',
      codiceAsset: 'ROSSI-META-FB',
      tipoModifica: 'Verifica periodica',
      personaInteressata: 'Mario Rossi',
      eseguitaDa: 'Elena Trentini',
    })
  })

  it('con esito revocato cambia stato e mette la data, ma non cancella la riga', () => {
    const d = documentoSano()
    const dopo = registraVerifica(
      d,
      { accessoId: 'x1', esito: 'revocato', verificatoDa: 'Elena Trentini', idRevisione: 'r1' },
      OGGI,
    )
    expect(dopo.accessi).toHaveLength(1)
    expect(dopo.accessi[0].stato).toBe('revocato')
    expect(dopo.accessi[0].dataRevoca).toBe(OGGI)
    expect(dopo.revisioni[0].tipoModifica).toBe('Revoca accesso')
  })

  it('con profilo ridotto aggiorna il profilo e annota da cosa a cosa', () => {
    const d = documentoSano()
    const dopo = registraVerifica(
      d,
      {
        accessoId: 'x1',
        esito: 'profilo-ridotto',
        nuovoProfilo: 'Editor (esperienza classica)',
        verificatoDa: 'Elena Trentini',
        idRevisione: 'r1',
      },
      OGGI,
    )
    expect(dopo.accessi[0].profilo).toBe('Editor (esperienza classica)')
    expect(dopo.revisioni[0].descrizione).toContain('da "Accesso parziale alla Pagina" a "Editor (esperienza classica)"')
  })

  it('rifiuta «profilo ridotto» senza dire a quale profilo', () => {
    const d = documentoSano()
    expect(() =>
      registraVerifica(
        d,
        { accessoId: 'x1', esito: 'profilo-ridotto', verificatoDa: 'Elena', idRevisione: 'r1' },
        OGGI,
      ),
    ).toThrow(/va indicato il nuovo profilo/)
  })

  it('rifiuta un identificativo di accesso inesistente', () => {
    expect(() =>
      registraVerifica(
        documentoSano(),
        { accessoId: 'inesistente', esito: 'confermato', verificatoDa: 'Elena', idRevisione: 'r1' },
        OGGI,
      ),
    ).toThrow(/Nessun accesso/)
  })
})

describe('avanzamento e chiusura', () => {
  it('conta gli accessi ancora da verificare nella campagna corrente', () => {
    const d = documentoSano()
    d.accessi.push(
      accesso({
        id: 'x2',
        codiceAsset: 'ROSSI-META-FB',
        personaId: 'p1',
        email: 'altra@agenzia.it',
        dataUltimaVerifica: null,
        campagnaVerifica: '',
      }),
    )
    const a = avanzamentoCampagna(d)
    expect(a.accessiAttivi).toBe(2)
    expect(a.verificatiInCampagna).toBe(1)
    expect(a.daVerificare).toBe(1)
    expect(a.quota).toBe(0.5)
  })

  it('una campagna senza accessi è completa, non a zero', () => {
    const d = apriCampagna(documentoVuoto(), '2026-H2', OGGI)
    expect(avanzamentoCampagna(d).quota).toBe(1)
  })

  it('non si chiude con un controllo bloccante aperto, e dice quale', () => {
    const d = documentoSano()
    d.persone = [persona({ id: 'p1', nome: 'Mario Rossi', stato: 'cessato' })]
    const esito = puoChiudereCampagna(d, OGGI)
    expect(esito.puoChiudere).toBe(false)
    expect(esito.motivi.join(' ')).toMatch(/C01 — Persone con accesso attivo ma già cessate: 1 caso/)
    expect(() => chiudiCampagna(d, OGGI, 'Elena Trentini')).toThrow(/non può essere chiusa/)
  })

  it('non si chiude se restano accessi da verificare', () => {
    const d = documentoSano()
    d.accessi[0].dataUltimaVerifica = null
    d.accessi[0].campagnaVerifica = ''
    expect(puoChiudereCampagna(d, OGGI).motivi.join(' ')).toMatch(/Restano 1 accessi attivi da verificare/)
  })

  it('si chiude quando tutto è a posto e ripianifica la verifica degli asset attivi', () => {
    const d = documentoSano()
    expect(puoChiudereCampagna(d, OGGI).puoChiudere).toBe(true)
    const dopo = chiudiCampagna(d, OGGI, 'Elena Trentini', 'Campagna semestrale')
    expect(dopo.campagne[0].chiusaIl).toBe(OGGI)
    expect(dopo.campagne[0].chiusaDa).toBe('Elena Trentini')
    expect(dopo.asset[0].prossimaVerifica).toBe('2027-03-13')
  })

  it('non ripianifica gli asset dismessi', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-VECCHIO', stato: 'dismesso', prossimaVerifica: null }))
    const dopo = chiudiCampagna(d, OGGI, 'Elena')
    expect(dopo.asset[1].prossimaVerifica).toBeNull()
  })
})

describe('verifica puntuale fuori campagna', () => {
  it('elenca tutto quello che va revocato quando una persona esce', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-GADS', piattaforma: 'Google', tipoAsset: 'Account Google Ads' }))
    d.accessi.push(
      accesso({ id: 'x2', codiceAsset: 'ROSSI-GADS', personaId: 'p1', profilo: 'Sola lettura' }),
      accesso({
        id: 'x3',
        codiceAsset: 'ROSSI-META-FB',
        personaId: 'p1',
        stato: 'revocato',
        dataRevoca: '2026-01-01',
      }),
    )
    const elenco = accessiDaChiudere(d, 'p1')
    expect(elenco).toHaveLength(2)
    expect(elenco).toContain('Mario Rossi su ROSSI-GADS')
  })
})

describe('cruscotto', () => {
  it('riassume gli indicatori generali', () => {
    const d = documentoSano()
    d.accessi.push(
      accesso({
        id: 'x2',
        codiceAsset: 'ROSSI-META-FB',
        personaId: 'p1',
        email: 'altra@agenzia.it',
        profilo: 'Accesso completo alla Pagina',
        mfaAttiva: 'no',
      }),
    )
    d.estrazioni.push(
      estrazione({
        id: 'e2',
        codiceAsset: 'ROSSI-META-FB',
        email: 'altra@agenzia.it',
        ruoloDichiarato: 'Accesso completo alla Pagina',
      }),
    )
    const c = cruscotto(d, OGGI)
    expect(c.assetAttivi).toBe(1)
    expect(c.accessiAttivi).toBe(2)
    expect(c.accessiRischioAlto).toBe(1)
    expect(c.accessiSenzaMfa).toBe(1)
    expect(c.righeEstrazione).toBe(2)
  })

  it('mostra solo le piattaforme su cui l’agenzia ha davvero qualcosa', () => {
    const righe = piattaformeInUso(cruscotto(documentoSano(), OGGI))
    expect(righe.map((r) => r.piattaforma)).toEqual(['Meta'])
    expect(righe[0]).toMatchObject({ assetAttivi: 1, accessiAttivi: 1, rischioAlto: 0 })
  })

  it('la sintesi mette davanti i casi bloccanti', () => {
    const d = documentoSano()
    d.persone = [persona({ id: 'p1', nome: 'Mario Rossi', stato: 'cessato' })]
    expect(sintesi(cruscotto(d, OGGI), 180)).toMatch(/da risolvere subito/)
  })

  it('la sintesi non dichiara «tutto a posto» quando mancano le estrazioni', () => {
    const d = documentoSano()
    d.estrazioni = []
    const testo = sintesi(cruscotto(d, OGGI), 180)
    expect(testo).toMatch(/non si possono valutare/)
    expect(testo).toMatch(/mancano estrazioni recenti/)
  })

  it('dichiara tutto a posto solo quando lo è davvero', () => {
    expect(sintesi(cruscotto(documentoSano(), OGGI), 180)).toMatch(/Tutti i controlli sono a posto/)
  })
})
