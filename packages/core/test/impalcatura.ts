import {
  documentoVuoto,
  type Accesso,
  type Asset,
  type Documento,
  type EsitoControllo,
  type Persona,
  type RigaEstrazione,
} from '@mapicy/core'

/**
 * Costruttori per gli scenari di test. Ogni entità nasce in uno stato valido e
 * completo: i test dichiarano solo il campo che stanno mettendo alla prova,
 * così quando un test fallisce si vede subito qual era la variabile.
 */

export const OGGI = '2026-09-14'

export function persona(p: Partial<Persona> & { id: string; nome: string }): Persona {
  return {
    rapportoLavoro: 'SDB',
    ruoloAziendale: 'Digital',
    stato: 'attivo',
    email: `${p.id}@agenzia.it`,
    dataCessazione: null,
    note: '',
    ...p,
  }
}

export function asset(a: Partial<Asset> & { id: string; codice: string }): Asset {
  return {
    cliente: 'Rossi Srl',
    piattaforma: 'Meta',
    tipoAsset: 'Pagina Facebook',
    nome: 'Pagina Facebook Rossi',
    idPiattaforma: '102938475610293',
    proprieta: 'Cliente',
    titolare: 'Rossi Srl',
    ruoloAgenzia: 'Responsabile del trattamento (art. 28)',
    baseGiuridica: 'Contratto (art. 6.1.b)',
    trasferimentoExtraUe: 'Sì - Data Privacy Framework',
    conservazione: '24 mesi dalla raccolta',
    prossimaVerifica: '2027-03-31',
    stato: 'attivo',
    note: '',
    ...a,
  }
}

export function accesso(a: Partial<Accesso> & { id: string; codiceAsset: string; personaId: string }): Accesso {
  return {
    profilo: 'Accesso parziale alla Pagina',
    email: `${a.personaId}@agenzia.it`,
    stato: 'attivo',
    dataConcessione: '2026-02-10',
    dataUltimaVerifica: OGGI,
    esitoUltimaVerifica: 'confermato',
    campagnaVerifica: '2026-H2',
    verificatoDa: 'Elena Trentini',
    dataRevoca: null,
    mfaAttiva: 'si',
    autorizzatoDa: 'Alessandro Morando',
    finalita: 'Gestione editoriale',
    note: '',
    ...a,
  }
}

export function estrazione(
  e: Partial<RigaEstrazione> & { id: string; codiceAsset: string; email: string },
): RigaEstrazione {
  return {
    fonte: 'Meta',
    nomeAssetPiattaforma: 'Pagina Facebook Rossi',
    nomePersona: '',
    ruoloDichiarato: 'Accesso parziale alla Pagina',
    dataEstrazione: OGGI,
    ...e,
  }
}

/** Documento minimo sano: una persona, un asset, un accesso verificato oggi, un'estrazione che coincide. */
export function documentoSano(): Documento {
  return {
    ...documentoVuoto(),
    agenzia: { nome: 'Agenzia', referentePrivacy: 'Elena Trentini', dpo: '', emailContatto: '' },
    setup: { completato: true, passoRaggiunto: 5 },
    campagnaCorrente: '2026-H2',
    campagne: [{ codice: '2026-H2', apertaIl: '2026-07-01', chiusaIl: null, chiusaDa: '', note: '' }],
    persone: [persona({ id: 'p1', nome: 'Mario Rossi' })],
    asset: [asset({ id: 'a1', codice: 'ROSSI-META-FB' })],
    accessi: [accesso({ id: 'x1', codiceAsset: 'ROSSI-META-FB', personaId: 'p1' })],
    estrazioni: [
      estrazione({ id: 'e1', codiceAsset: 'ROSSI-META-FB', email: 'p1@agenzia.it', nomePersona: 'Mario Rossi' }),
    ],
    revisioni: [],
  }
}

/** Scorciatoia: prende l'esito di un controllo per codice, e fallisce se non c'è. */
export function per(esiti: readonly EsitoControllo[], codice: string): EsitoControllo {
  const e = esiti.find((x) => x.codice === codice)
  if (!e) throw new Error(`Controllo ${codice} assente`)
  return e
}
