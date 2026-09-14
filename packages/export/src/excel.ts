import ExcelJS from 'exceljs'
import { catalogoAggiornatoIl } from '@mapicy/catalogo'
import {
  cruscotto,
  derivaAccesso,
  eseguiControlli,
  piattaformeInUso,
  riconcilia,
  type Documento,
} from '@mapicy/core'
import { descriviAmbito, filtra, type Ambito } from './ambito.js'

/**
 * Esportazione Excel, per chi vuole filtrare e fare i suoi conti. Non è un
 * ritorno al foglio di calcolo: non contiene formule né menu, è una
 * fotografia. Le colonne derivate dal catalogo (dati trattati, attività,
 * rischio) sono già risolte, perché in un file esportato non c'è niente che
 * possa risolverle.
 */

type Colonna = { header: string; key: string; width: number }

function aggiungi(
  wb: ExcelJS.Workbook,
  nome: string,
  colonne: Colonna[],
  righe: Record<string, unknown>[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = colonne
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
  ws.addRows(righe)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonne.length } }
  return ws
}

const SI_NO: Record<string, string> = {
  si: 'Sì',
  no: 'No',
  'non-applicabile': 'Non applicabile',
  'da-verificare': 'Da verificare',
}
const STATI: Record<string, string> = {
  'da-attivare': 'Da attivare',
  attivo: 'Attivo',
  sospeso: 'Sospeso',
  revocato: 'Revocato',
  dismesso: 'Dismesso',
  cessato: 'Cessato',
}

/**
 * Restituisce i byte del file, non un `Buffer` di Node: chi scrive su disco è
 * il processo principale di Electron, e un `Uint8Array` non lega questo
 * pacchetto ai tipi di Node.
 */
export async function esportaExcel(
  documento: Documento,
  ambito: Ambito,
  oggi: string,
): Promise<Uint8Array> {
  const d = filtra(documento, ambito)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Mapicy'
  wb.created = new Date(`${oggi}T00:00:00Z`)

  // Cruscotto: gli indicatori si calcolano sul documento intero, perché
  // «anomalie aperte» su un estratto di un cliente sarebbe un numero che non
  // vuol dire niente.
  const c = cruscotto(documento, oggi)
  const intestazioni = aggiungi(
    wb,
    'Cruscotto',
    [
      { header: 'Indicatore', key: 'voce', width: 46 },
      { header: 'Valore', key: 'valore', width: 52 },
    ],
    [
      { voce: 'Ambito di questa esportazione', valore: descriviAmbito(ambito) },
      { voce: 'Generata il', valore: oggi },
      { voce: 'Agenzia', valore: documento.agenzia.nome },
      { voce: 'Referente privacy', valore: documento.agenzia.referentePrivacy },
      { voce: 'DPO', valore: documento.agenzia.dpo },
      { voce: 'Campagna in corso', valore: documento.campagnaCorrente || 'nessuna' },
      { voce: 'Asset attivi', valore: c.assetAttivi },
      { voce: 'Accessi attivi', valore: c.accessiAttivi },
      { voce: 'Accessi attivi a rischio alto', valore: c.accessiRischioAlto },
      { voce: 'Accessi attivi senza verifica in due passaggi', valore: c.accessiSenzaMfa },
      { voce: 'Accessi revocati nel registro', valore: c.accessiRevocati },
      { voce: 'Righe di estrazione caricate', valore: c.righeEstrazione },
      { voce: 'Anomalie aperte nei controlli', valore: c.anomalieAperte },
      { voce: 'Controlli non valutabili (mancano estrazioni)', valore: c.controlliNonVerificabili },
      {
        voce: 'Asset attivi senza estrazione recente',
        valore: c.assetSenzaEstrazione.join(', ') || 'nessuno',
      },
      { voce: 'Catalogo dei profili aggiornato al', valore: catalogoAggiornatoIl },
    ],
  )
  intestazioni.getColumn('voce').font = { bold: false }

  aggiungi(
    wb,
    'Per piattaforma',
    [
      { header: 'Piattaforma', key: 'piattaforma', width: 24 },
      { header: 'Asset attivi', key: 'assetAttivi', width: 12 },
      { header: 'Accessi attivi', key: 'accessiAttivi', width: 13 },
      { header: 'Rischio alto', key: 'rischioAlto', width: 12 },
      { header: 'Senza MFA', key: 'senzaMfa', width: 11 },
      { header: 'Da verificare', key: 'daVerificare', width: 12 },
      { header: 'Non riscontrati', key: 'nonRiscontrati', width: 14 },
    ],
    piattaformeInUso(c) as unknown as Record<string, unknown>[],
  )

  aggiungi(
    wb,
    'Asset',
    [
      { header: 'Codice asset', key: 'codice', width: 20 },
      { header: 'Cliente / progetto', key: 'cliente', width: 26 },
      { header: 'Piattaforma', key: 'piattaforma', width: 18 },
      { header: 'Tipo asset', key: 'tipoAsset', width: 26 },
      { header: "Nome dell'asset", key: 'nome', width: 30 },
      { header: 'ID sulla piattaforma', key: 'idPiattaforma', width: 22 },
      { header: "Proprietà dell'asset", key: 'proprieta', width: 16 },
      { header: 'Titolare del trattamento', key: 'titolare', width: 26 },
      { header: "Ruolo dell'agenzia", key: 'ruoloAgenzia', width: 32 },
      { header: 'Base giuridica', key: 'baseGiuridica', width: 24 },
      { header: 'Trasferimento extra-UE', key: 'trasferimentoExtraUe', width: 30 },
      { header: 'Conservazione', key: 'conservazione', width: 24 },
      { header: 'Prossima verifica', key: 'prossimaVerifica', width: 16 },
      { header: 'Stato', key: 'stato', width: 12 },
      { header: 'Note', key: 'note', width: 40 },
    ],
    d.asset.map((a) => ({ ...a, stato: STATI[a.stato] ?? a.stato })),
  )

  aggiungi(
    wb,
    'Registro accessi',
    [
      { header: 'Codice asset', key: 'codiceAsset', width: 20 },
      { header: 'Cliente', key: 'cliente', width: 24 },
      { header: 'Piattaforma', key: 'piattaforma', width: 16 },
      { header: 'Tipo asset', key: 'tipoAsset', width: 24 },
      { header: 'Persona', key: 'persona', width: 24 },
      { header: 'Rapporto', key: 'rapporto', width: 14 },
      { header: 'Ruolo aziendale', key: 'ruoloAziendale', width: 18 },
      { header: 'Profilo autorizzativo', key: 'profilo', width: 34 },
      { header: 'Tipologia di dati trattati', key: 'datiTrattati', width: 60 },
      { header: 'Attività di trattamento', key: 'attivita', width: 70 },
      { header: 'Livello di rischio', key: 'rischio', width: 14 },
      { header: 'Account / e-mail', key: 'email', width: 30 },
      { header: 'Stato accesso', key: 'stato', width: 14 },
      { header: 'Data concessione', key: 'dataConcessione', width: 16 },
      { header: 'Data ultima verifica', key: 'dataUltimaVerifica', width: 17 },
      { header: 'Esito ultima verifica', key: 'esitoUltimaVerifica', width: 18 },
      { header: 'Campagna', key: 'campagnaVerifica', width: 12 },
      { header: 'Verificato da', key: 'verificatoDa', width: 22 },
      { header: 'Data revoca', key: 'dataRevoca', width: 14 },
      { header: 'MFA attiva', key: 'mfaAttiva', width: 14 },
      { header: 'Autorizzato da', key: 'autorizzatoDa', width: 22 },
      { header: "Finalità dell'accesso", key: 'finalita', width: 30 },
      { header: 'Note', key: 'note', width: 34 },
      { header: 'Segnalazione', key: 'problema', width: 50 },
    ],
    d.accessi.map((a) => {
      const x = derivaAccesso(d, a)
      return {
        codiceAsset: a.codiceAsset,
        cliente: x.asset?.cliente ?? '',
        piattaforma: x.asset?.piattaforma ?? '',
        tipoAsset: x.asset?.tipoAsset ?? '',
        persona: x.persona?.nome ?? '',
        rapporto: x.persona?.rapportoLavoro ?? '',
        ruoloAziendale: x.persona?.ruoloAziendale ?? '',
        profilo: a.profilo,
        datiTrattati: x.datiTrattati,
        attivita: x.attivita,
        rischio: x.rischio ? x.rischio[0].toUpperCase() + x.rischio.slice(1) : '',
        email: a.email,
        stato: STATI[a.stato] ?? a.stato,
        dataConcessione: a.dataConcessione ?? '',
        dataUltimaVerifica: a.dataUltimaVerifica ?? '',
        esitoUltimaVerifica: a.esitoUltimaVerifica ?? '',
        campagnaVerifica: a.campagnaVerifica,
        verificatoDa: a.verificatoDa,
        dataRevoca: a.dataRevoca ?? '',
        mfaAttiva: SI_NO[a.mfaAttiva] ?? a.mfaAttiva,
        autorizzatoDa: a.autorizzatoDa,
        finalita: a.finalita,
        note: a.note,
        problema: x.problema ?? '',
      }
    }),
  )

  const ric = riconcilia(documento, oggi)
  aggiungi(
    wb,
    'Estrazioni',
    [
      { header: 'Fonte', key: 'fonte', width: 16 },
      { header: 'Codice asset', key: 'codiceAsset', width: 20 },
      { header: 'Nome asset sulla piattaforma', key: 'nomeAssetPiattaforma', width: 30 },
      { header: 'Nome persona', key: 'nomePersona', width: 24 },
      { header: 'E-mail / account', key: 'email', width: 30 },
      { header: 'Ruolo dichiarato dalla piattaforma', key: 'ruoloDichiarato', width: 36 },
      { header: 'Data estrazione', key: 'dataEstrazione', width: 15 },
      { header: 'Esito del confronto', key: 'esito', width: 22 },
      { header: 'Profilo nel registro', key: 'profiloRegistro', width: 30 },
    ],
    d.estrazioni.map((e) => {
      const riga = ric.righe.find((x) => x.estrazioneId === e.id)
      return { ...e, esito: riga?.esito ?? '', profiloRegistro: riga?.profiloRegistro ?? '' }
    }),
  )

  aggiungi(
    wb,
    'Controlli',
    [
      { header: 'Codice', key: 'codice', width: 9 },
      { header: 'Controllo', key: 'titolo', width: 56 },
      { header: 'Gravità', key: 'gravita', width: 13 },
      { header: 'Casi', key: 'casi', width: 7 },
      { header: 'Esito', key: 'esito', width: 18 },
      { header: 'Casi rilevati', key: 'elenco', width: 80 },
      { header: 'Come correggere', key: 'comeCorreggere', width: 70 },
    ],
    eseguiControlli(documento, oggi).map((e) => ({
      codice: e.codice,
      titolo: e.titolo,
      gravita: e.gravita,
      casi: e.casi.length,
      esito:
        e.stato === 'da-correggere'
          ? 'Da correggere'
          : e.stato === 'non-verificabile'
            ? 'Non verificabile'
            : e.stato === 'informativo'
              ? 'Informativo'
              : 'OK',
      elenco: e.casi.map((c) => `• ${c.descrizione}`).join('\n'),
      comeCorreggere: e.comeCorreggere,
    })),
  )

  aggiungi(
    wb,
    'Persone',
    [
      { header: 'Nome', key: 'nome', width: 26 },
      { header: 'Rapporto', key: 'rapportoLavoro', width: 16 },
      { header: 'Ruolo aziendale', key: 'ruoloAziendale', width: 20 },
      { header: 'Stato', key: 'stato', width: 12 },
      { header: 'Account / e-mail', key: 'email', width: 30 },
      { header: 'Data cessazione', key: 'dataCessazione', width: 16 },
      { header: 'Note', key: 'note', width: 34 },
    ],
    d.persone.map((p) => ({ ...p, stato: STATI[p.stato] ?? p.stato, dataCessazione: p.dataCessazione ?? '' })),
  )

  aggiungi(
    wb,
    'Registro revisioni',
    [
      { header: 'Data', key: 'data', width: 13 },
      { header: 'Campagna', key: 'campagna', width: 12 },
      { header: 'Codice asset', key: 'codiceAsset', width: 20 },
      { header: 'Tipo di modifica', key: 'tipoModifica', width: 22 },
      { header: 'Persona interessata', key: 'personaInteressata', width: 24 },
      { header: 'Descrizione', key: 'descrizione', width: 60 },
      { header: 'Eseguita da', key: 'eseguitaDa', width: 22 },
      { header: 'Approvata da', key: 'approvataDa', width: 22 },
    ],
    d.revisioni as unknown as Record<string, unknown>[],
  )

  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (riga) => {
      riga.alignment = { vertical: 'top', wrapText: true }
    })
  }

  return new Uint8Array(await wb.xlsx.writeBuffer())
}
