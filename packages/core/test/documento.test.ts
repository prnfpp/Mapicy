import { describe, expect, it } from 'vitest'
import {
  ErroreDocumento,
  VERSIONE_SCHEMA,
  aggiungiGiorni,
  apriDocumento,
  codiceAssetModificabile,
  dataValida,
  documentoVuoto,
  formattaData,
  giorniFra,
  proponiCodiceAsset,
  semestreDi,
  verificaDocumento,
} from '@mapicy/core'
import { accesso, asset, documentoSano } from './impalcatura.js'

describe('apertura dell’archivio', () => {
  it('riapre un documento appena creato senza modificarlo', () => {
    const d = documentoVuoto()
    expect(apriDocumento(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('rifiuta un archivio scritto da una versione più recente invece di leggerlo male', () => {
    const futuro = { ...documentoVuoto(), schemaVersion: VERSIONE_SCHEMA + 1 }
    expect(() => apriDocumento(futuro)).toThrow(ErroreDocumento)
    expect(() => apriDocumento(futuro)).toThrow(/Aggiornare Mapicy/)
  })

  it('rifiuta un file che non è un archivio Mapicy', () => {
    expect(() => apriDocumento({ tutt: 'altro' })).toThrow(/non dichiara una versione/)
    expect(() => apriDocumento('una stringa')).toThrow(/non contiene un archivio/)
    expect(() => apriDocumento(null)).toThrow(/non contiene un archivio/)
  })

  it('riempie i campi assenti invece di restituire un documento incompleto', () => {
    const parziale = { schemaVersion: 1, agenzia: { nome: 'Agenzia' } }
    const d = apriDocumento(parziale)
    expect(d.agenzia.nome).toBe('Agenzia')
    expect(d.agenzia.referentePrivacy).toBe('')
    expect(d.impostazioni.giorniValiditaVerifica).toBe(180)
    expect(d.accessi).toEqual([])
  })
})

describe('codici degli asset', () => {
  it('propone un codice leggibile riusando la sigla del catalogo', () => {
    expect(proponiCodiceAsset('Rossi Srl', 'Meta', 'Pagina Facebook', [])).toBe('ROSSISRL-META-FB')
    expect(proponiCodiceAsset('Rossi Srl', 'Google', 'Account Google Ads', [])).toBe('ROSSISRL-GADS')
  })

  it('evita di proporre un codice già preso', () => {
    const presi = ['ROSSISRL-META-FB']
    expect(proponiCodiceAsset('Rossi Srl', 'Meta', 'Pagina Facebook', presi)).toBe('ROSSISRL-META-FB-2')
  })

  it('regge un nome cliente con accenti e punteggiatura', () => {
    expect(proponiCodiceAsset('Caffè Però & Figli S.p.A.', 'Meta', 'Pagina Facebook', [])).toBe('CAFFEPERO-META-FB')
  })

  it('blocca la modifica del codice appena è usato da un accesso o da un’estrazione', () => {
    const d = documentoSano()
    expect(codiceAssetModificabile(d, 'ROSSI-META-FB')).toBe(false)
    d.accessi = []
    d.estrazioni = []
    expect(codiceAssetModificabile(d, 'ROSSI-META-FB')).toBe(true)
    d.estrazioni = documentoSano().estrazioni
    expect(codiceAssetModificabile(d, 'ROSSI-META-FB')).toBe(false)
  })
})

describe('verifica di forma del documento', () => {
  it('non trova niente da dire su un documento sano', () => {
    expect(verificaDocumento(documentoSano())).toEqual([])
  })

  it('trova i codici asset duplicati, che scollegherebbero il registro', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-META-FB', nome: 'Doppione' }))
    expect(verificaDocumento(d).join(' ')).toMatch(/usato da 2 asset/)
  })

  it('trova le date non valide e gli accessi orfani', () => {
    const d = documentoSano()
    d.accessi.push(
      accesso({ id: 'x2', codiceAsset: 'ROSSI-META-FB', personaId: 'fantasma', dataConcessione: '2026-02-31' }),
    )
    const problemi = verificaDocumento(d).join(' ')
    expect(problemi).toMatch(/data di concessione non valida/)
    expect(problemi).toMatch(/non è in anagrafica/)
  })
})

describe('aritmetica delle date', () => {
  it('conta i giorni senza farsi ingannare dal fuso orario', () => {
    expect(giorniFra('2026-01-01', '2026-01-01')).toBe(0)
    expect(giorniFra('2026-03-01', '2026-09-14')).toBe(197)
    expect(giorniFra('2026-09-14', '2026-03-01')).toBe(-197)
    // Attraverso il cambio dell’ora legale, dove un calcolo in ora locale
    // sbaglierebbe di un giorno.
    expect(giorniFra('2026-03-28', '2026-03-30')).toBe(2)
    expect(giorniFra('2026-10-24', '2026-10-26')).toBe(2)
  })

  it('somma i giorni restando su date valide, anche sugli anni bisestili', () => {
    expect(aggiungiGiorni('2026-09-14', 180)).toBe('2027-03-13')
    expect(aggiungiGiorni('2028-02-28', 1)).toBe('2028-02-29')
    expect(aggiungiGiorni('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('riconosce le date impossibili', () => {
    expect(dataValida('2026-09-14')).toBe(true)
    expect(dataValida('2026-02-30')).toBe(false)
    expect(dataValida('2026-13-01')).toBe(false)
    expect(dataValida('14/09/2026')).toBe(false)
    expect(dataValida('')).toBe(false)
  })

  it('calcola il semestre e formatta la data all’italiana', () => {
    expect(semestreDi('2026-01-01')).toBe('2026-H1')
    expect(semestreDi('2026-06-30')).toBe('2026-H1')
    expect(semestreDi('2026-07-01')).toBe('2026-H2')
    expect(formattaData('2026-09-14')).toBe('14/09/2026')
    expect(formattaData(null)).toBe('')
  })
})
