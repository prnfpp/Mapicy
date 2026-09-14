import { describe, expect, it } from 'vitest'
import {
  aliasPer,
  controlli,
  elenchi,
  fornitorePer,
  guidaPer,
  guideDaVerificare,
  mappaRuoloDichiarato,
  normalizza,
  piattaforme,
  profiliPer,
  tipiAsset,
  tipiAssetPer,
  trovaProfilo,
  verificaIntegrita,
} from '@mapicy/catalogo'

describe('integrità del catalogo', () => {
  it('non ha incoerenze fra profili, tipi di asset, fornitori e guide', () => {
    expect(verificaIntegrita()).toEqual([])
  })

  it('copre le 14 piattaforme e i 28 tipi di asset del template di partenza', () => {
    expect(piattaforme()).toHaveLength(14)
    expect(tipiAsset()).toHaveLength(28)
  })

  it('descrive i 17 controlli con una gravità e un rimedio', () => {
    const c = controlli()
    expect(c).toHaveLength(17)
    expect(c.map((x) => x.codice)).toContain('C01')
    expect(c.every((x) => x.comeCorreggere.length > 10)).toBe(true)
    expect(c.filter((x) => x.gravita === 'bloccante').map((x) => x.codice)).toEqual(['C01', 'C02'])
  })

  it('ha una guida di reperimento per ogni tipo di asset', () => {
    for (const t of tipiAsset()) {
      const g = guidaPer(t.piattaforma, t.tipoAsset)
      expect(g, `${t.piattaforma} / ${t.tipoAsset}`).not.toBeNull()
      expect(g!.identificativo.percorso.length).toBeGreaterThan(10)
      expect(g!.utenti.percorso.length).toBeGreaterThan(10)
    }
  })

  it('dichiara quali guide non sono verificate invece di darle per buone', () => {
    const daVerificare = guideDaVerificare()
    expect(daVerificare.length).toBeGreaterThan(0)
    // Le quattro piattaforme i cui percorsi arrivano dal template dell'agenzia
    // sono verificate; le altre no.
    expect(guidaPer('Google', 'Proprietà Google Analytics 4')!.verificato).toBe(true)
    expect(guidaPer('Shopify', 'Negozio Shopify')!.verificato).toBe(false)
  })
})

describe('derivazione dei profili', () => {
  it("propone solo i profili reali dell'asset selezionato", () => {
    const pagina = profiliPer('Meta', 'Pagina Facebook').map((p) => p.profilo)
    expect(pagina).toContain('Accesso completo alla Pagina')
    expect(pagina).not.toContain('Sola lettura')

    const ads = profiliPer('Google', 'Account Google Ads').map((p) => p.profilo)
    expect(ads).toContain('Sola lettura')
    expect(ads).not.toContain('Accesso completo alla Pagina')
  })

  it('porta con sé dati trattati, attività e rischio', () => {
    const p = trovaProfilo('Meta', 'Pagina Facebook', 'Accesso completo alla Pagina')
    expect(p).not.toBeNull()
    expect(p!.rischio).toBe('alto')
    expect(p!.datiTrattati).toMatch(/messaggi privati/i)
    expect(p!.attivita).toMatch(/Gestione utenti/i)
  })

  it('classifica come alto il rischio dei profili che gestiscono utenti o pagamenti', () => {
    expect(trovaProfilo('Meta', 'Business Manager', 'Accesso come amministratore')!.rischio).toBe('alto')
    expect(trovaProfilo('Meta', 'Business Manager', 'Editor dei pagamenti')!.rischio).toBe('alto')
    expect(trovaProfilo('Meta', 'Business Manager', 'Accesso come dipendente')!.rischio).toBe('medio')
  })

  it('non inventa un profilo che non esiste', () => {
    expect(trovaProfilo('Meta', 'Pagina Facebook', 'Capo supremo')).toBeNull()
    expect(trovaProfilo('Piattaforma inesistente', 'Cosa', 'Profilo')).toBeNull()
  })
})

describe('riconoscimento del ruolo dichiarato dalla piattaforma', () => {
  it('riconosce il nome esatto e quello scritto diversamente', () => {
    const atteso = 'Accesso completo alla Pagina'
    expect(mappaRuoloDichiarato('Meta', 'Pagina Facebook', atteso)!.profilo).toBe(atteso)
    expect(mappaRuoloDichiarato('Meta', 'Pagina Facebook', '  accesso COMPLETO alla pagina ')!.profilo).toBe(atteso)
  })

  it('riconosce il ruolo anche quando la piattaforma lo scrive solo in inglese', () => {
    const p = mappaRuoloDichiarato('LinkedIn', 'Account pubblicitario', 'Viewer')
    expect(p?.profilo).toBe('Visualizzatore (Viewer)')
  })

  it('si arrende invece di assegnare il profilo più somigliante', () => {
    expect(mappaRuoloDichiarato('Meta', 'Pagina Facebook', 'Accesso completissimo')).toBeNull()
    expect(mappaRuoloDichiarato('Meta', 'Pagina Facebook', '')).toBeNull()
  })
})

describe('alias dei ruoli dichiarati dalle piattaforme', () => {
  it('riconduce i nomi inglesi ai profili del catalogo', () => {
    expect(mappaRuoloDichiarato('WordPress', 'Sito WordPress', 'Editor')?.profilo).toBe('Editore')
    expect(mappaRuoloDichiarato('Google', 'Account Google Ads', 'Read only')?.profilo).toBe('Sola lettura')
    expect(mappaRuoloDichiarato('Meta', 'Pagina Facebook', 'Full control')?.profilo).toBe('Accesso completo alla Pagina')
    expect(mappaRuoloDichiarato('Shopify', 'Negozio Shopify', 'Collaborator')?.profilo).toBe('Collaboratore (partner o agenzia)')
  })

  it('riconosce i nomi tecnici che GA4 mette nei CSV', () => {
    expect(mappaRuoloDichiarato('Google', 'Proprietà Google Analytics 4', 'predefinedRoles/analytics.admin')?.profilo).toBe('Amministratore')
    expect(mappaRuoloDichiarato('Google', 'Proprietà Google Analytics 4', 'Marketer')?.profilo).toBe('Addetto al marketing')
  })

  it('tiene gli alias distinti per tipo di asset, perché lo stesso nome vale cose diverse', () => {
    // «Editor» su una Pagina Facebook è il ruolo dell'esperienza classica; su
    // un sito WordPress è l'Editore. Lo stesso testo, due profili.
    expect(mappaRuoloDichiarato('Meta', 'Pagina Facebook', 'Editor')?.profilo).toBe('Editor (esperienza classica)')
    expect(mappaRuoloDichiarato('WordPress', 'Sito WordPress', 'Editor')?.profilo).toBe('Editore')
  })

  it('espone gli alias noti di un tipo di asset per mostrarli nella guida', () => {
    const alias = aliasPer('WordPress', 'Sito WordPress')
    expect(alias.length).toBe(5)
    expect(alias.map((a) => a.alias)).toContain('Subscriber')
  })
})

describe('fornitori ed elenchi', () => {
  it('associa a ogni piattaforma il fornitore con il suo ruolo privacy', () => {
    for (const p of piattaforme()) {
      expect(fornitorePer(p), p).not.toBeNull()
    }
    const meta = fornitorePer('Meta')!
    expect(meta.fornitore).toMatch(/Meta Platforms Ireland/)
    expect(meta.ruoloPrivacyFornitore).toMatch(/[Cc]ontitolare/)
    expect(meta.trasferimentoExtraUe).toMatch(/USA/)
  })

  it('ha gli elenchi che alimentano i menu', () => {
    expect(elenchi.statoAccesso).toEqual(['Da attivare', 'Attivo', 'Sospeso', 'Revocato'])
    expect(elenchi.esitoVerifica).toContain('Confermato')
    expect(elenchi.baseGiuridica.length).toBeGreaterThan(3)
  })

  it("ogni piattaforma dell'elenco ha almeno un tipo di asset", () => {
    for (const p of elenchi.piattaforme) expect(tipiAssetPer(p).length, p).toBeGreaterThan(0)
  })
})

describe('normalizza', () => {
  it('toglie accenti, punteggiatura e maiuscole', () => {
    expect(normalizza('Proprietà Google Analytics 4')).toBe('proprieta google analytics 4')
    expect(normalizza('  Editor  (esperienza classica) ')).toBe('editor esperienza classica')
  })
})
