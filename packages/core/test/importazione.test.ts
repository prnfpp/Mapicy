import { describe, expect, it } from 'vitest'
import {
  analizzaImport,
  anteprimaImport,
  applicaImport,
  costruisciEstrazioni,
  riconosciColonne,
  riconosciDelimitatore,
  separaRiga,
} from '@mapicy/core'
import { OGGI, accesso, asset, documentoSano, persona } from './impalcatura.js'

/** Documento con anche una proprietà GA4, per provare i CSV di Google. */
function conGa4() {
  const d = documentoSano()
  d.asset.push(
    asset({
      id: 'a2',
      codice: 'ROSSI-GA4',
      piattaforma: 'Google',
      tipoAsset: 'Proprietà Google Analytics 4',
      nome: 'GA4 Rossi',
    }),
  )
  return d
}

describe('lettura del formato', () => {
  it('riconosce virgola, punto e virgola e tabulazione', () => {
    expect(riconosciDelimitatore('a,b,c\n1,2,3')).toBe(',')
    expect(riconosciDelimitatore('a;b;c\n1;2;3')).toBe(';')
    expect(riconosciDelimitatore('a\tb\tc\n1\t2\t3')).toBe('\t')
  })

  it('non si fa ingannare dalle virgole dentro i valori quando il separatore è il punto e virgola', () => {
    expect(riconosciDelimitatore('Nome;Ruolo\nRossi, Mario;Editor, con limiti')).toBe(';')
  })

  it('rispetta le virgolette del formato CSV', () => {
    expect(separaRiga('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd'])
    expect(separaRiga('a,"con ""virgolette"" dentro",c', ',')).toEqual(['a', 'con "virgolette" dentro', 'c'])
    expect(separaRiga('  spazi  ,  via  ', ',')).toEqual(['spazi', 'via'])
  })
})

describe('riconoscimento delle colonne', () => {
  it('riconosce le intestazioni italiane e inglesi', () => {
    expect(riconosciColonne(['Nome', 'E-mail', 'Ruolo'])).toEqual({ email: 1, nome: 0, ruolo: 2, codiceAsset: -1 })
    expect(riconosciColonne(['Email', 'Access level', 'Status'])).toMatchObject({ email: 0, ruolo: 1 })
  })

  it('manda «Direct roles and data restrictions» di GA4 sulla colonna del ruolo', () => {
    const c = riconosciColonne(['Email', 'Direct roles and data restrictions'])
    expect(c.email).toBe(0)
    expect(c.ruolo).toBe(1)
  })

  it('non assegna due volte la stessa colonna', () => {
    const c = riconosciColonne(['Utente', 'Permessi'])
    expect(c.email).toBe(0)
    expect(c.nome).toBe(-1)
    expect(c.ruolo).toBe(1)
  })
})

describe('import di un CSV di Google Analytics 4', () => {
  const csv = [
    'Email,Roles,Direct roles and data restrictions',
    'p1@agenzia.it,Editor,Editor',
    'sabrina.fonte@agenzia.it,Viewer,"Viewer, No cost metrics"',
    'marco.cantelli@agenzia.it,predefinedRoles/analytics.admin,Administrator',
  ].join('\n')

  it('legge le righe e ricava i profili del catalogo dai nomi inglesi', () => {
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-GA4', documento: conGa4() })
    expect(a.intestazioniRiconosciute).toBe(true)
    expect(a.righe).toHaveLength(3)
    expect(a.righe.map((r) => r.profiloRiconosciuto)).toEqual(['Editor', 'Visualizzatore', 'Amministratore'])
    expect(a.scartate).toEqual([])
  })

  it('normalizza gli indirizzi e conserva il ruolo come lo scrive la piattaforma', () => {
    const conMaiuscole = csv.replace('p1@agenzia.it', 'P1@Agenzia.IT')
    const a = analizzaImport({ testo: conMaiuscole, codiceAsset: 'ROSSI-GA4', documento: conGa4() })
    expect(a.righe[0].email).toBe('p1@agenzia.it')
    expect(a.righe[2].ruoloDichiarato).toBe('predefinedRoles/analytics.admin')
  })
})

describe('import di un CSV italiano con punto e virgola', () => {
  it('legge il formato che esce da Excel in italiano', () => {
    const csv = [
      'Nome;E-mail;Ruolo',
      'Mario Rossi;p1@agenzia.it;Accesso parziale alla Pagina',
      'Sabrina Fonte;sabrina.fonte@agenzia.it;Accesso completo alla Pagina',
    ].join('\n')
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: documentoSano() })
    expect(a.delimitatore).toBe(';')
    expect(a.righe[0]).toMatchObject({
      email: 'p1@agenzia.it',
      nomePersona: 'Mario Rossi',
      profiloRiconosciuto: 'Accesso parziale alla Pagina',
    })
    expect(a.righe[1].profiloRiconosciuto).toBe('Accesso completo alla Pagina')
  })
})

describe('import di un elenco incollato senza intestazione', () => {
  const incollato = [
    'Mario Rossi\tp1@agenzia.it\tPartial access',
    'Sabrina Fonte\tsabrina.fonte@agenzia.it\tFull control',
    'Marco Cantelli\tmarco.cantelli@agenzia.it\tEditor',
  ].join('\n')

  it('deduce le colonne dal contenuto e lo dichiara', () => {
    const a = analizzaImport({ testo: incollato, codiceAsset: 'ROSSI-META-FB', documento: documentoSano() })
    expect(a.intestazioniRiconosciute).toBe(false)
    expect(a.avvisi.join(' ')).toMatch(/dedotte dal contenuto/)
    expect(a.righe).toHaveLength(3)
    expect(a.righe.map((r) => r.email)).toEqual([
      'p1@agenzia.it',
      'sabrina.fonte@agenzia.it',
      'marco.cantelli@agenzia.it',
    ])
    expect(a.righe.map((r) => r.nomePersona)).toEqual(['Mario Rossi', 'Sabrina Fonte', 'Marco Cantelli'])
    expect(a.righe.map((r) => r.profiloRiconosciuto)).toEqual([
      'Accesso parziale alla Pagina',
      'Accesso completo alla Pagina',
      'Editor (esperienza classica)',
    ])
  })

  it('si ferma con un messaggio utile se nel testo non ci sono e-mail', () => {
    const a = analizzaImport({
      testo: 'Mario Rossi\tEditor\nSabrina Fonte\tAdmin',
      codiceAsset: 'ROSSI-META-FB',
      documento: documentoSano(),
    })
    expect(a.righe).toEqual([])
    expect(a.avvisi[0]).toMatch(/non si trovano indirizzi e-mail/)
  })
})

describe('quello che l’import non riesce a interpretare', () => {
  it('scarta le righe senza e-mail dicendo quale riga e perché', () => {
    const csv = ['Email,Ruolo', 'p1@agenzia.it,Accesso parziale alla Pagina', 'nonunaemail,Editor', ',Admin'].join('\n')
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: documentoSano() })
    expect(a.righe).toHaveLength(1)
    expect(a.scartate).toHaveLength(2)
    expect(a.scartate[0]).toMatchObject({ numeroRiga: 3 })
    expect(a.scartate[0].motivo).toMatch(/non è un indirizzo e-mail/)
    expect(a.scartate[1].motivo).toMatch(/non contiene un indirizzo e-mail/)
  })

  it('tiene una sola riga per persona e segnala i doppioni del file', () => {
    const csv = [
      'Email,Ruolo',
      'p1@agenzia.it,Accesso parziale alla Pagina',
      'P1@AGENZIA.IT,Accesso completo alla Pagina',
    ].join('\n')
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: documentoSano() })
    expect(a.righe).toHaveLength(1)
    expect(a.scartate[0].motivo).toMatch(/compare più di una volta/)
  })

  it('segnala i ruoli che il catalogo non riconosce invece di scartare la riga', () => {
    const csv = ['Email,Ruolo', 'p1@agenzia.it,Capo supremo'].join('\n')
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: documentoSano() })
    expect(a.righe).toHaveLength(1)
    expect(a.righe[0].profiloRiconosciuto).toBeNull()
    expect(a.righe[0].ruoloDichiarato).toBe('Capo supremo')
    expect(a.avvisi.join(' ')).toMatch(/non riconosce.*"Capo supremo"/)
  })

  it('avvisa se l’asset non è in anagrafica invece di importare righe scollegate', () => {
    const a = analizzaImport({ testo: 'Email\np1@agenzia.it', codiceAsset: 'MAI-VISTO', documento: documentoSano() })
    expect(a.righe).toEqual([])
    expect(a.avvisi[0]).toMatch(/non è in anagrafica/)
  })
})

describe('anteprima e conferma', () => {
  const csv = [
    'Nome,Email,Ruolo',
    'Mario Rossi,p1@agenzia.it,Accesso completo alla Pagina',
    'Marco Cantelli,marco.cantelli@agenzia.it,Accesso parziale alla Pagina',
  ].join('\n')

  it('mostra gli esiti del confronto prima di scrivere niente', () => {
    const d = documentoSano()
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: d })
    const nuove = costruisciEstrazioni(a, {
      fonte: 'Meta',
      codiceAsset: 'ROSSI-META-FB',
      nomeAssetPiattaforma: 'Pagina Facebook Rossi',
      dataEstrazione: OGGI,
      identificativi: ['n1', 'n2'],
    })
    const anteprima = anteprimaImport(d, nuove, 'ROSSI-META-FB', OGGI)
    expect(anteprima.righe.map((r) => r.esito).sort()).toEqual(['non-censito', 'profilo-diverso'])
    // Il documento non è stato toccato.
    expect(d.estrazioni).toHaveLength(1)
    expect(d.estrazioni[0].id).toBe('e1')
  })

  it('sostituisce le righe dell’asset invece di accumularle, perché un’estrazione è una fotografia', () => {
    const d = documentoSano()
    d.asset.push(asset({ id: 'a2', codice: 'ROSSI-GADS', piattaforma: 'Google', tipoAsset: 'Account Google Ads' }))
    d.estrazioni.push({
      id: 'e2',
      fonte: 'Google',
      codiceAsset: 'ROSSI-GADS',
      nomeAssetPiattaforma: 'Ads Rossi',
      nomePersona: '',
      email: 'p1@agenzia.it',
      ruoloDichiarato: 'Sola lettura',
      dataEstrazione: OGGI,
    })
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: d })
    const nuove = costruisciEstrazioni(a, {
      fonte: 'Meta',
      codiceAsset: 'ROSSI-META-FB',
      nomeAssetPiattaforma: 'Pagina Facebook Rossi',
      dataEstrazione: OGGI,
      identificativi: ['n1', 'n2'],
    })
    const dopo = applicaImport(d, nuove, 'ROSSI-META-FB')
    // La vecchia riga e1 di quell'asset è sostituita; quella dell'altro asset resta.
    expect(dopo.estrazioni.map((e) => e.id).sort()).toEqual(['e2', 'n1', 'n2'])
  })

  it('rifiuta di costruire le righe senza identificativi a sufficienza', () => {
    const d = documentoSano()
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: d })
    expect(() =>
      costruisciEstrazioni(a, {
        fonte: 'Meta',
        codiceAsset: 'ROSSI-META-FB',
        nomeAssetPiattaforma: '',
        dataEstrazione: OGGI,
        identificativi: ['n1'],
      }),
    ).toThrow(/Servono 2 identificativi/)
  })
})

describe('un import trova il problema che la memoria non trova', () => {
  it('scopre la persona cessata che sta ancora sulla piattaforma', () => {
    const d = documentoSano()
    d.persone.push(persona({ id: 'p2', nome: 'Luca Pedrazzoli', stato: 'cessato', email: 'luca@agenzia.it' }))
    d.accessi.push(
      accesso({
        id: 'x2',
        codiceAsset: 'ROSSI-META-FB',
        personaId: 'p2',
        email: 'luca@agenzia.it',
        stato: 'revocato',
        dataRevoca: '2026-03-02',
      }),
    )
    const csv = [
      'Nome,Email,Ruolo',
      'Mario Rossi,p1@agenzia.it,Accesso parziale alla Pagina',
      'Luca Pedrazzoli,luca@agenzia.it,Editor',
    ].join('\n')
    const a = analizzaImport({ testo: csv, codiceAsset: 'ROSSI-META-FB', documento: d })
    const nuove = costruisciEstrazioni(a, {
      fonte: 'Meta',
      codiceAsset: 'ROSSI-META-FB',
      nomeAssetPiattaforma: 'Pagina Facebook Rossi',
      dataEstrazione: OGGI,
      identificativi: ['n1', 'n2'],
    })
    const anteprima = anteprimaImport(d, nuove, 'ROSSI-META-FB', OGGI)
    const luca = anteprima.righe.find((r) => r.email === 'luca@agenzia.it')
    expect(luca?.esito).toBe('revoca-non-eseguita')
  })
})
