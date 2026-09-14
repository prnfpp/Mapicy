import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  ambitiDisponibili,
  descriviAmbito,
  esc,
  esportaExcel,
  esportaJson,
  filtra,
  htmlControlli,
  htmlRegistro,
  htmlSchedaAsset,
  htmlVerbaleCampagna,
  nomeFile,
} from '@mapicy/export'
import { apriDocumento, chiudiCampagna, registraVerifica, type Documento } from '@mapicy/core'
import { OGGI, accesso, asset, documentoSano, persona } from '../../core/test/impalcatura.js'

/** Due clienti, due asset, per poter provare i filtri. */
function dueClienti(): Documento {
  const d = documentoSano()
  d.persone.push(persona({ id: 'p2', nome: 'Sabrina Fonte', email: 'p2@agenzia.it' }))
  d.asset.push(
    asset({
      id: 'a2',
      codice: 'BIANCHI-GADS',
      cliente: 'Bianchi Spa',
      piattaforma: 'Google',
      tipoAsset: 'Account Google Ads',
      nome: 'Google Ads Bianchi',
    }),
  )
  d.accessi.push(
    accesso({ id: 'x2', codiceAsset: 'BIANCHI-GADS', personaId: 'p2', profilo: 'Sola lettura' }),
  )
  return d
}

describe('ambito dell’esportazione', () => {
  it('con «tutto» non tocca niente', () => {
    const d = dueClienti()
    expect(filtra(d, { tipo: 'tutto' })).toBe(d)
  })

  it('per cliente non porta con sé gli asset degli altri clienti', () => {
    const r = filtra(dueClienti(), { tipo: 'cliente', cliente: 'Rossi Srl' })
    expect(r.asset.map((a) => a.codice)).toEqual(['ROSSI-META-FB'])
    expect(r.accessi.map((a) => a.id)).toEqual(['x1'])
    // E nemmeno le persone che compaiono solo sugli asset esclusi.
    expect(r.persone.map((p) => p.id)).toEqual(['p1'])
    expect(r.estrazioni.every((e) => e.codiceAsset === 'ROSSI-META-FB')).toBe(true)
  })

  it('per singolo asset restringe a quell’asset', () => {
    const r = filtra(dueClienti(), { tipo: 'asset', codiceAsset: 'BIANCHI-GADS' })
    expect(r.asset).toHaveLength(1)
    expect(r.accessi.map((a) => a.id)).toEqual(['x2'])
  })

  it('per campagna tiene solo gli accessi verificati in quella campagna', () => {
    const d = dueClienti()
    d.accessi[1].campagnaVerifica = '2026-H1'
    const r = filtra(d, { tipo: 'campagna', campagna: '2026-H2' })
    expect(r.accessi.map((a) => a.id)).toEqual(['x1'])
  })

  it('propone gli ambiti che esistono davvero', () => {
    const ambiti = ambitiDisponibili(dueClienti())
    expect(ambiti.map((a) => descriviAmbito(a))).toEqual([
      'Mappatura completa',
      'Cliente: Bianchi Spa',
      'Cliente: Rossi Srl',
      'Asset: ROSSI-META-FB',
      'Asset: BIANCHI-GADS',
      'Campagna di verifica: 2026-H2',
    ])
  })
})

describe('esportazione JSON', () => {
  it('con ambito completo produce un backup che Mapicy sa rileggere', () => {
    const d = dueClienti()
    const e = esportaJson(d, { tipo: 'tutto' }, OGGI)
    expect(e.reimportabile).toBe(true)
    expect(e.nomeFile).toBe('mapicy-backup-completa-2026-09-14.json')
    const riletto = apriDocumento(JSON.parse(e.contenuto))
    expect(riletto.asset).toHaveLength(2)
    expect(riletto.accessi).toHaveLength(2)
    expect(riletto).toEqual(d)
  })

  it('un estratto parziale dice di non essere un backup', () => {
    const e = esportaJson(dueClienti(), { tipo: 'cliente', cliente: 'Rossi Srl' }, OGGI)
    expect(e.reimportabile).toBe(false)
    const contenuto = JSON.parse(e.contenuto)
    expect(contenuto._avvertenza).toMatch(/Non è un backup/)
    expect(contenuto.asset).toHaveLength(1)
  })

  it('costruisce nomi di file usabili anche con clienti dal nome complicato', () => {
    expect(nomeFile({ tipo: 'cliente', cliente: 'Caffè Però & Figli S.p.A.' }, OGGI, 'estratto', 'pdf')).toBe(
      'mapicy-estratto-Caffe-Pero-Figli-S.p.A.-2026-09-14.pdf',
    )
  })

  it('non porta credenziali: nel documento non ci sono campi per contenerle', () => {
    const contenuto = esportaJson(dueClienti(), { tipo: 'tutto' }, OGGI).contenuto.toLowerCase()
    for (const parola of ['password', 'token', 'apikey', 'api_key', 'secret']) {
      expect(contenuto, parola).not.toContain(parola)
    }
  })
})

describe('HTML per il PDF', () => {
  it('mette al riparo dai contenuti incollati dalle piattaforme', () => {
    expect(esc('<script>rubaTutto()</script>')).toBe('&lt;script&gt;rubaTutto()&lt;/script&gt;')
    expect(esc('"apici" & \'virgolette\'')).toBe('&quot;apici&quot; &amp; &#39;virgolette&#39;')
  })

  it('non lascia passare un nome asset scritto come un tag', () => {
    const d = documentoSano()
    d.asset[0].nome = '<img src=x onerror="alert(1)">'
    d.asset[0].note = '</style><script>alert(2)</script>'
    const html = htmlSchedaAsset(d, 'ROSSI-META-FB', OGGI)
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert(2)')
    expect(html).toContain('&lt;img src=x')
  })

  it('la scheda asset riporta anagrafica, fornitore e che cosa tratta ogni profilo', () => {
    const html = htmlSchedaAsset(documentoSano(), 'ROSSI-META-FB', OGGI)
    expect(html).toContain('Scheda asset — ROSSI-META-FB')
    expect(html).toContain('Rossi Srl')
    expect(html).toContain('Meta Platforms Ireland')
    expect(html).toContain('Contitolare')
    expect(html).toContain('Mario Rossi')
    expect(html).toContain('Accesso parziale alla Pagina')
    expect(html).toContain('Tipologia di dati trattati')
    expect(html).toContain('14/09/2026')
  })

  it('la scheda segnala i profili che il catalogo non riconosce invece di lasciare celle vuote', () => {
    const d = documentoSano()
    d.accessi[0].profilo = 'Profilo inventato'
    const html = htmlSchedaAsset(d, 'ROSSI-META-FB', OGGI)
    expect(html).toContain('non esiste nel catalogo')
  })

  it('il registro rispetta l’ambito e non fa uscire gli altri clienti', () => {
    const html = htmlRegistro(dueClienti(), { tipo: 'cliente', cliente: 'Rossi Srl' }, OGGI)
    expect(html).toContain('ROSSI-META-FB')
    expect(html).not.toContain('BIANCHI-GADS')
    expect(html).toContain('Cliente: Rossi Srl')
  })

  it('i controlli avvisano quando quattro di loro non sono valutabili', () => {
    const d = documentoSano()
    d.estrazioni = []
    const html = htmlControlli(d, OGGI)
    expect(html).toContain('non si possono valutare')
    expect(html).toContain('ROSSI-META-FB')
    expect(html).toContain('Non verificabile')
  })

  it('i controlli elencano i casi e come correggerli', () => {
    const d = documentoSano()
    d.persone = [persona({ id: 'p1', nome: 'Mario Rossi', stato: 'cessato' })]
    const html = htmlControlli(d, OGGI)
    expect(html).toContain('Mario Rossi')
    expect(html).toContain('Da correggere')
    expect(html).toContain('Revocare subito')
  })

  it('il verbale di campagna riporta esito, modifiche e spazio per le firme', () => {
    let d = documentoSano()
    d = registraVerifica(
      d,
      { accessoId: 'x1', esito: 'confermato', verificatoDa: 'Elena Trentini', idRevisione: 'r1' },
      OGGI,
    )
    d = chiudiCampagna(d, OGGI, 'Elena Trentini', 'Revisione semestrale')
    const html = htmlVerbaleCampagna(d, '2026-H2', OGGI)
    expect(html).toContain('Verbale di verifica degli accessi — 2026-H2')
    expect(html).toContain('Elena Trentini')
    expect(html).toContain('Revisione semestrale')
    expect(html).toContain('Approvata da')
    expect(html).toContain('Accesso confermato in sede di verifica')
  })

  it('rifiuta di generare la scheda di un asset che non esiste', () => {
    expect(() => htmlSchedaAsset(documentoSano(), 'MAI-VISTO', OGGI)).toThrow(/Nessun asset/)
    expect(() => htmlVerbaleCampagna(documentoSano(), '1999-H1', OGGI)).toThrow(/Nessuna campagna/)
  })

  it('produce un documento HTML completo e autonomo, senza risorse esterne', () => {
    const html = htmlRegistro(documentoSano(), { tipo: 'tutto' }, OGGI)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="it">')
    expect(html).not.toMatch(/<(script|link|img)\b/)
    expect(html).not.toMatch(/https?:\/\//)
  })
})

/**
 * Rilegge i byte prodotti dall'esportazione per verificarne il contenuto.
 *
 * Il cast è necessario per un difetto dei tipi di exceljs, che dichiara nello
 * spazio globale `interface Buffer extends ArrayBuffer`: quella dichiarazione
 * si fonde con il `Buffer` di Node e ne risulta un tipo che nessun valore
 * soddisfa. A runtime `load` accetta un ArrayBuffer. Il cast resta confinato
 * qui, e non compare nel codice di produzione.
 */
async function rileggi(dati: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  const arrayBuffer = new Uint8Array(dati).buffer
  await wb.xlsx.load(arrayBuffer as Parameters<typeof wb.xlsx.load>[0])
  return wb
}

describe('esportazione Excel', () => {
  it('scrive i fogli attesi con le colonne derivate già risolte', async () => {
    const wb = await rileggi(await esportaExcel(dueClienti(), { tipo: 'tutto' }, OGGI))
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Cruscotto',
      'Per piattaforma',
      'Asset',
      'Registro accessi',
      'Estrazioni',
      'Controlli',
      'Persone',
      'Registro revisioni',
    ])

    const registro = wb.getWorksheet('Registro accessi')!
    const intestazioni = (registro.getRow(1).values as unknown[]).slice(1)
    expect(intestazioni).toContain('Tipologia di dati trattati')
    expect(intestazioni).toContain('Livello di rischio')
    expect(registro.rowCount).toBe(3)

    // La riga contiene il testo derivato dal catalogo, non un riferimento.
    const riga = registro.getRow(2)
    expect(String(riga.getCell(9).value)).toMatch(/pubblico/i)
    expect(String(riga.getCell(11).value)).toBe('Medio')
  })

  it('rispetta l’ambito anche in Excel', async () => {
    const wb = await rileggi(await esportaExcel(dueClienti(), { tipo: 'cliente', cliente: 'Bianchi Spa' }, OGGI))
    const asset = wb.getWorksheet('Asset')!
    expect(asset.rowCount).toBe(2)
    expect(String(asset.getRow(2).getCell(1).value)).toBe('BIANCHI-GADS')
  })

  it('riporta sul cruscotto quali asset non hanno un’estrazione recente', async () => {
    const wb = await rileggi(await esportaExcel(dueClienti(), { tipo: 'tutto' }, OGGI))
    const testo = (wb.getWorksheet('Cruscotto')!.getSheetValues() as unknown[][])
      .flat()
      .map((v) => String(v ?? ''))
      .join(' | ')
    expect(testo).toContain('Asset attivi senza estrazione recente')
    expect(testo).toContain('BIANCHI-GADS')
  })
})
