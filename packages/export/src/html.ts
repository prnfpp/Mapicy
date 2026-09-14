import {
  avvertenzaFornitori,
  catalogoAggiornatoIl,
  fornitorePer,
  guidaPer,
  type LivelloRischio,
} from '@mapicy/catalogo'
import {
  avanzamentoCampagna,
  derivaAccesso,
  eseguiControlli,
  formattaData,
  personaPerId,
  riconcilia,
  type Accesso,
  type Documento,
  type EsitoControllo,
} from '@mapicy/core'
import { descriviAmbito, filtra, type Ambito } from './ambito.js'

/**
 * Generazione dell'HTML che diventa il PDF. Sta qui e non nel processo
 * Electron per due ragioni: è una funzione da dati a stringa, quindi
 * testabile; e tenere fuori la conversione in PDF significa che lo stesso
 * HTML si può aprire nel browser per vedere l'esito senza passare per
 * l'applicativo.
 */

/**
 * Ogni valore che finisce nell'HTML passa da qui. Non è formalismo: i nomi
 * degli asset, le note e i ruoli dichiarati arrivano da file esterni incollati
 * da chi compila, e l'HTML viene poi caricato in una finestra Chromium per
 * essere stampato. Senza escape, un nome asset scritto come un tag diventa
 * codice eseguito in quella finestra.
 */
export function esc(valore: unknown): string {
  return String(valore ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Il testo delle attività di trattamento nel catalogo è a capo singolo: i titoli in grassetto, le righe sotto. */
function paragrafi(testo: string): string {
  if (!testo.trim()) return '<span class="vuoto">non indicato</span>'
  return testo
    .split(/\n{2,}/)
    .map((blocco) => {
      const righe = blocco.split('\n').filter((r) => r.trim())
      if (righe.length === 0) return ''
      const [titolo, ...resto] = righe
      if (resto.length === 0) return `<p>${esc(titolo)}</p>`
      return `<p><strong>${esc(titolo)}</strong><br>${resto.map((r) => esc(r)).join('<br>')}</p>`
    })
    .filter(Boolean)
    .join('')
}

const ETICHETTA_RISCHIO: Record<LivelloRischio, string> = { alto: 'Alto', medio: 'Medio', basso: 'Basso' }
const ETICHETTA_STATO: Record<Accesso['stato'], string> = {
  'da-attivare': 'Da attivare',
  attivo: 'Attivo',
  sospeso: 'Sospeso',
  revocato: 'Revocato',
}
const ETICHETTA_MFA: Record<Accesso['mfaAttiva'], string> = {
  si: 'Sì',
  no: 'No',
  'non-applicabile': 'Non applicabile',
  'da-verificare': 'Da verificare',
}
const ETICHETTA_CONTROLLO: Record<EsitoControllo['stato'], string> = {
  ok: 'OK',
  'da-correggere': 'Da correggere',
  informativo: 'Informativo',
  'non-verificabile': 'Non verificabile',
}

const STILE = `
  :root { --testo:#1a1a1a; --tenue:#6b6b6b; --bordo:#d6d6d6; --sfondoTesta:#f2f2f2;
          --alto:#a11b1b; --medio:#8a5a00; --basso:#2f6b2f; }
  * { box-sizing:border-box }
  body { margin:0; font:11px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         color:var(--testo); }
  .foglio { padding:14mm 12mm }
  h1 { font-size:19px; margin:0 0 2px }
  h2 { font-size:14px; margin:22px 0 7px; padding-bottom:4px; border-bottom:1.5px solid var(--testo) }
  h3 { font-size:12px; margin:14px 0 5px }
  p { margin:0 0 6px }
  .intestazione { border-bottom:2.5px solid var(--testo); padding-bottom:9px; margin-bottom:6px }
  .intestazione .meta { color:var(--tenue); font-size:10px; margin-top:4px }
  .sottotitolo { color:var(--tenue); font-size:11px; margin:2px 0 0 }
  table { width:100%; border-collapse:collapse; margin:7px 0 13px; font-size:9.5px }
  th,td { border:1px solid var(--bordo); padding:4px 5px; text-align:left; vertical-align:top }
  th { background:var(--sfondoTesta); font-weight:600 }
  td.num { text-align:right; font-variant-numeric:tabular-nums }
  .scheda th { width:33%; background:var(--sfondoTesta) }
  .vuoto { color:var(--tenue); font-style:italic }
  .rischio-alto { color:var(--alto); font-weight:600 }
  .rischio-medio { color:var(--medio) }
  .rischio-basso { color:var(--basso) }
  .stato-revocato { color:var(--tenue) }
  .esito-da-correggere { color:var(--alto); font-weight:600 }
  .esito-non-verificabile { color:var(--medio); font-weight:600 }
  .esito-ok { color:var(--basso) }
  .esito-informativo { color:var(--tenue) }
  .casi { margin:3px 0 0; padding-left:15px; color:var(--tenue) }
  .casi li { margin-bottom:2px }
  .avviso { border-left:3px solid var(--medio); background:#fdf8ee; padding:7px 9px; margin:9px 0; font-size:10px }
  .nota { color:var(--tenue); font-size:9.5px; margin-top:5px }
  .piede { margin-top:22px; padding-top:7px; border-top:1px solid var(--bordo); color:var(--tenue); font-size:9px }
  .firme { margin-top:26px; display:flex; gap:26px }
  .firme div { flex:1; border-top:1px solid var(--testo); padding-top:4px; font-size:10px; color:var(--tenue) }
  .attivita p { margin:0 0 4px }
  @media print { .foglio { padding:0 } h2 { break-after:avoid } table { break-inside:auto } tr { break-inside:avoid } }
  @page { size:A4; margin:14mm 12mm }
`

function pagina(titolo: string, corpo: string): string {
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${esc(titolo)}</title><style>${STILE}</style></head>
<body><div class="foglio">${corpo}</div></body></html>`
}

function intestazione(documento: Documento, titolo: string, sottotitolo: string, oggi: string): string {
  const righe = [
    documento.agenzia.nome && `Agenzia: ${documento.agenzia.nome}`,
    documento.agenzia.referentePrivacy && `Referente privacy: ${documento.agenzia.referentePrivacy}`,
    documento.agenzia.dpo && `DPO: ${documento.agenzia.dpo}`,
  ].filter(Boolean) as string[]
  return `<div class="intestazione">
    <h1>${esc(titolo)}</h1>
    <p class="sottotitolo">${esc(sottotitolo)}</p>
    <p class="meta">${righe.map((r) => esc(r)).join(' &middot; ')}${righe.length ? ' &middot; ' : ''}Generato il ${esc(formattaData(oggi))}</p>
  </div>`
}

function piede(oggi: string): string {
  return `<p class="piede">Documento generato da Mapicy il ${esc(formattaData(oggi))}.
    Catalogo dei profili aggiornato al ${esc(formattaData(catalogoAggiornatoIl))}.
    ${esc(avvertenzaFornitori)}</p>`
}

function classeRischio(r: LivelloRischio | null): string {
  return r ? `rischio-${r}` : ''
}

/** Scheda di dettaglio di un asset: quello che nel foglio Excel era la vista stampabile. */
export function htmlSchedaAsset(documento: Documento, codiceAsset: string, oggi: string): string {
  const asset = documento.asset.find((a) => a.codice === codiceAsset)
  if (!asset) throw new Error(`Nessun asset con codice ${codiceAsset}.`)
  const fornitore = fornitorePer(asset.piattaforma)
  const guida = guidaPer(asset.piattaforma, asset.tipoAsset)
  const accessi = documento.accessi
    .filter((a) => a.codiceAsset === codiceAsset)
    .map((a) => derivaAccesso(documento, a))
    .sort((x, y) => Number(y.accesso.stato === 'attivo') - Number(x.accesso.stato === 'attivo'))

  const riga = (etichetta: string, valore: string) =>
    `<tr><th>${esc(etichetta)}</th><td>${valore.trim() ? esc(valore) : '<span class="vuoto">non indicato</span>'}</td></tr>`

  const corpo = `
    ${intestazione(documento, `Scheda asset — ${asset.codice}`, `${asset.cliente} · ${asset.piattaforma} · ${asset.tipoAsset}`, oggi)}

    <h2>Anagrafica dell'asset</h2>
    <table class="scheda">
      ${riga('Codice asset', asset.codice)}
      ${riga('Cliente / progetto', asset.cliente)}
      ${riga('Piattaforma', asset.piattaforma)}
      ${riga('Tipo di asset', asset.tipoAsset)}
      ${riga("Nome dell'asset", asset.nome)}
      ${riga(guida?.identificativo.nome ?? 'ID sulla piattaforma', asset.idPiattaforma)}
      ${riga("Proprietà dell'asset", asset.proprieta)}
      ${riga('Titolare del trattamento', asset.titolare)}
      ${riga("Ruolo dell'agenzia", asset.ruoloAgenzia)}
      ${riga('Base giuridica', asset.baseGiuridica)}
      ${riga('Trasferimento extra-UE', asset.trasferimentoExtraUe)}
      ${riga('Conservazione dei dati', asset.conservazione)}
      ${riga('Prossima verifica accessi', formattaData(asset.prossimaVerifica))}
      ${riga('Stato', asset.stato === 'attivo' ? 'Attivo' : 'Dismesso')}
      ${riga('Note', asset.note)}
    </table>

    ${
      fornitore
        ? `<h2>Il fornitore della piattaforma</h2>
    <table class="scheda">
      ${riga('Fornitore del servizio', fornitore.fornitore)}
      ${riga('Ruolo privacy dichiarato', fornitore.ruoloPrivacyFornitore)}
      ${riga('Trasferimento extra-UE', fornitore.trasferimentoExtraUe)}
      ${riga('Riferimenti contrattuali', fornitore.riferimentiContrattuali)}
      ${riga('Nota di verifica', fornitore.notaVerifica)}
    </table>`
        : ''
    }

    <h2>Accessi (${accessi.length})</h2>
    ${
      accessi.length === 0
        ? '<p class="vuoto">Nessun accesso censito su questo asset.</p>'
        : `<table>
      <thead><tr>
        <th>Persona</th><th>Rapporto</th><th>Ruolo</th><th>Profilo autorizzativo</th>
        <th>Rischio</th><th>Stato</th><th>Concesso</th><th>Verificato</th><th>MFA</th><th>Finalità</th>
      </tr></thead>
      <tbody>${accessi
        .map(
          (d) => `<tr class="stato-${d.accesso.stato}">
          <td>${esc(d.persona?.nome ?? d.accesso.email)}</td>
          <td>${esc(d.persona?.rapportoLavoro ?? '')}</td>
          <td>${esc(d.persona?.ruoloAziendale ?? '')}</td>
          <td>${esc(d.accesso.profilo) || '<span class="vuoto">non indicato</span>'}</td>
          <td class="${classeRischio(d.rischio)}">${d.rischio ? esc(ETICHETTA_RISCHIO[d.rischio]) : '<span class="vuoto">—</span>'}</td>
          <td>${esc(ETICHETTA_STATO[d.accesso.stato])}${d.accesso.dataRevoca ? ` (${esc(formattaData(d.accesso.dataRevoca))})` : ''}</td>
          <td>${esc(formattaData(d.accesso.dataConcessione))}</td>
          <td>${esc(formattaData(d.accesso.dataUltimaVerifica))}</td>
          <td>${esc(ETICHETTA_MFA[d.accesso.mfaAttiva])}</td>
          <td>${esc(d.accesso.finalita)}</td>
        </tr>`,
        )
        .join('')}</tbody></table>`
    }

    <h2>Che cosa tratta ciascun profilo</h2>
    ${
      accessi.filter((d) => d.accesso.stato === 'attivo').length === 0
        ? '<p class="vuoto">Nessun accesso attivo.</p>'
        : accessi
            .filter((d) => d.accesso.stato === 'attivo')
            .map(
              (d) => `<h3>${esc(d.persona?.nome ?? d.accesso.email)} — ${esc(d.accesso.profilo)}
        <span class="${classeRischio(d.rischio)}">(rischio ${d.rischio ? esc(ETICHETTA_RISCHIO[d.rischio].toLowerCase()) : 'non determinato'})</span></h3>
      ${
        d.problema
          ? `<div class="avviso">${esc(d.problema)}</div>`
          : `<p><strong>Tipologia di dati trattati.</strong> ${esc(d.datiTrattati)}</p>
         <div class="attivita"><strong>Attività di trattamento.</strong>${paragrafi(d.attivita)}</div>`
      }`,
            )
            .join('')
    }

    ${piede(oggi)}`

  return pagina(`Scheda asset ${asset.codice}`, corpo)
}

/** Il registro degli accessi nell'ambito richiesto. */
export function htmlRegistro(documento: Documento, ambito: Ambito, oggi: string): string {
  const d = filtra(documento, ambito)
  const derivati = d.accessi
    .map((a) => derivaAccesso(d, a))
    .sort(
      (x, y) =>
        x.accesso.codiceAsset.localeCompare(y.accesso.codiceAsset) ||
        (x.persona?.nome ?? '').localeCompare(y.persona?.nome ?? ''),
    )

  const corpo = `
    ${intestazione(documento, 'Registro degli accessi', descriviAmbito(ambito), oggi)}
    <p class="nota">Una riga per ogni accesso di ogni persona a ogni asset. Gli accessi revocati restano
    nel registro con la data di revoca: sono l'evidenza che la revoca è stata eseguita.</p>

    <h2>Accessi (${derivati.length}, di cui ${derivati.filter((x) => x.accesso.stato === 'attivo').length} attivi)</h2>
    ${
      derivati.length === 0
        ? '<p class="vuoto">Nessun accesso nell’ambito selezionato.</p>'
        : `<table>
      <thead><tr>
        <th>Codice asset</th><th>Cliente</th><th>Piattaforma</th><th>Persona</th><th>Account</th>
        <th>Profilo</th><th>Rischio</th><th>Stato</th><th>Concesso</th><th>Verificato</th>
        <th>Esito</th><th>Campagna</th><th>MFA</th>
      </tr></thead>
      <tbody>${derivati
        .map(
          (x) => `<tr class="stato-${x.accesso.stato}">
          <td>${esc(x.accesso.codiceAsset)}</td>
          <td>${esc(x.asset?.cliente ?? '')}</td>
          <td>${esc(x.asset?.piattaforma ?? '')}</td>
          <td>${esc(x.persona?.nome ?? '')}</td>
          <td>${esc(x.accesso.email)}</td>
          <td>${esc(x.accesso.profilo)}</td>
          <td class="${classeRischio(x.rischio)}">${x.rischio ? esc(ETICHETTA_RISCHIO[x.rischio]) : '—'}</td>
          <td>${esc(ETICHETTA_STATO[x.accesso.stato])}</td>
          <td>${esc(formattaData(x.accesso.dataConcessione))}</td>
          <td>${esc(formattaData(x.accesso.dataUltimaVerifica))}</td>
          <td>${esc(x.accesso.esitoUltimaVerifica ?? '')}</td>
          <td>${esc(x.accesso.campagnaVerifica)}</td>
          <td>${esc(ETICHETTA_MFA[x.accesso.mfaAttiva])}</td>
        </tr>`,
        )
        .join('')}</tbody></table>`
    }

    <h2>Asset compresi (${d.asset.length})</h2>
    ${
      d.asset.length === 0
        ? '<p class="vuoto">Nessun asset.</p>'
        : `<table>
      <thead><tr><th>Codice</th><th>Cliente</th><th>Piattaforma</th><th>Tipo</th><th>Nome</th>
      <th>Titolare</th><th>Ruolo agenzia</th><th>Base giuridica</th><th>Extra-UE</th><th>Prossima verifica</th></tr></thead>
      <tbody>${d.asset
        .map(
          (a) => `<tr>
          <td>${esc(a.codice)}</td><td>${esc(a.cliente)}</td><td>${esc(a.piattaforma)}</td>
          <td>${esc(a.tipoAsset)}</td><td>${esc(a.nome)}</td><td>${esc(a.titolare)}</td>
          <td>${esc(a.ruoloAgenzia)}</td><td>${esc(a.baseGiuridica)}</td>
          <td>${esc(a.trasferimentoExtraUe)}</td><td>${esc(formattaData(a.prossimaVerifica))}</td>
        </tr>`,
        )
        .join('')}</tbody></table>`
    }

    ${piede(oggi)}`

  return pagina('Registro degli accessi', corpo)
}

/** L'esito dei controlli automatici, con i casi elencati uno per uno. */
export function htmlControlli(documento: Documento, oggi: string): string {
  const esiti = eseguiControlli(documento, oggi)
  const r = riconcilia(documento, oggi)

  const corpo = `
    ${intestazione(documento, 'Esito dei controlli automatici', 'Stato della mappatura alla data di generazione', oggi)}

    ${
      r.assetNonCoperti.length > 0
        ? `<div class="avviso"><strong>Quattro controlli non si possono valutare del tutto.</strong>
        I controlli C02, C03, C04 e C05 confrontano il registro con gli elenchi utenti estratti dalle
        piattaforme. Per ${r.assetNonCoperti.length} asset attivi non c'è un'estrazione abbastanza recente:
        ${esc(r.assetNonCoperti.join(', '))}. Su questi asset l'assenza di casi non significa che non
        ci siano problemi, ma che non sono stati cercati.</div>`
        : ''
    }

    <table>
      <thead><tr><th style="width:44px">Codice</th><th>Controllo</th><th style="width:78px">Gravità</th>
      <th style="width:42px">Casi</th><th style="width:96px">Esito</th></tr></thead>
      <tbody>${esiti
        .map(
          (e) => `<tr>
        <td>${esc(e.codice)}</td>
        <td>${esc(e.titolo)}
          ${
            e.casi.length > 0
              ? `<ul class="casi">${e.casi.map((c) => `<li>${esc(c.descrizione)}</li>`).join('')}</ul>
                 <p class="nota"><strong>Come correggere.</strong> ${esc(e.comeCorreggere)}</p>`
              : ''
          }
          ${
            e.stato === 'non-verificabile'
              ? `<p class="nota">Non valutabile: manca un'estrazione recente per ${esc(e.assetNonCoperti.join(', '))}.</p>`
              : ''
          }
        </td>
        <td>${esc(e.gravita)}</td>
        <td class="num">${e.casi.length}</td>
        <td class="esito-${e.stato}">${esc(ETICHETTA_CONTROLLO[e.stato])}</td>
      </tr>`,
        )
        .join('')}</tbody></table>

    ${piede(oggi)}`

  return pagina('Esito dei controlli', corpo)
}

/**
 * Verbale di chiusura di una campagna: il documento da conservare come
 * evidenza di aver fatto la revisione, con chi l'ha fatta e cosa è cambiato.
 */
export function htmlVerbaleCampagna(documento: Documento, codiceCampagna: string, oggi: string): string {
  const campagna = documento.campagne.find((c) => c.codice === codiceCampagna)
  if (!campagna) throw new Error(`Nessuna campagna ${codiceCampagna}.`)
  const d = filtra(documento, { tipo: 'campagna', campagna: codiceCampagna })
  const esiti = eseguiControlli(documento, oggi)
  const avanzamento = avanzamentoCampagna(documento)
  const revisioni = documento.revisioni.filter((r) => r.campagna === codiceCampagna)
  const revocati = d.accessi.filter((a) => a.stato === 'revocato')
  const ridotti = d.accessi.filter((a) => a.esitoUltimaVerifica === 'profilo-ridotto')
  const confermati = d.accessi.filter((a) => a.esitoUltimaVerifica === 'confermato')

  const corpo = `
    ${intestazione(documento, `Verbale di verifica degli accessi — ${campagna.codice}`, `Campagna aperta il ${formattaData(campagna.apertaIl)}${campagna.chiusaIl ? `, chiusa il ${formattaData(campagna.chiusaIl)}` : ' — ancora aperta'}`, oggi)}

    <h2>Esito della campagna</h2>
    <table class="scheda">
      <tr><th>Campagna</th><td>${esc(campagna.codice)}</td></tr>
      <tr><th>Aperta il</th><td>${esc(formattaData(campagna.apertaIl))}</td></tr>
      <tr><th>Chiusa il</th><td>${campagna.chiusaIl ? esc(formattaData(campagna.chiusaIl)) : '<span class="vuoto">campagna ancora aperta</span>'}</td></tr>
      <tr><th>Chiusa da</th><td>${esc(campagna.chiusaDa) || '<span class="vuoto">—</span>'}</td></tr>
      <tr><th>Accessi esaminati</th><td>${d.accessi.length}</td></tr>
      <tr><th>Confermati</th><td>${confermati.length}</td></tr>
      <tr><th>Profili ridotti</th><td>${ridotti.length}</td></tr>
      <tr><th>Revocati</th><td>${revocati.length}</td></tr>
      <tr><th>Ancora da verificare</th><td>${avanzamento.daVerificare}</td></tr>
      <tr><th>Note</th><td>${esc(campagna.note) || '<span class="vuoto">—</span>'}</td></tr>
    </table>

    <h2>Controlli al momento della chiusura</h2>
    <table>
      <thead><tr><th style="width:44px">Codice</th><th>Controllo</th><th style="width:42px">Casi</th><th style="width:96px">Esito</th></tr></thead>
      <tbody>${esiti
        .map(
          (e) =>
            `<tr><td>${esc(e.codice)}</td><td>${esc(e.titolo)}</td><td class="num">${e.casi.length}</td>
             <td class="esito-${e.stato}">${esc(ETICHETTA_CONTROLLO[e.stato])}</td></tr>`,
        )
        .join('')}</tbody></table>

    <h2>Modifiche registrate (${revisioni.length})</h2>
    ${
      revisioni.length === 0
        ? '<p class="vuoto">Nessuna modifica registrata in questa campagna.</p>'
        : `<table>
      <thead><tr><th>Data</th><th>Asset</th><th>Tipo</th><th>Persona</th><th>Descrizione</th><th>Eseguita da</th></tr></thead>
      <tbody>${revisioni
        .map(
          (r) => `<tr>
          <td>${esc(formattaData(r.data))}</td><td>${esc(r.codiceAsset)}</td><td>${esc(r.tipoModifica)}</td>
          <td>${esc(r.personaInteressata)}</td><td>${esc(r.descrizione)}</td><td>${esc(r.eseguitaDa)}</td>
        </tr>`,
        )
        .join('')}</tbody></table>`
    }

    ${
      revocati.length > 0
        ? `<h2>Accessi revocati</h2>
    <table>
      <thead><tr><th>Asset</th><th>Persona</th><th>Account</th><th>Profilo</th><th>Data revoca</th></tr></thead>
      <tbody>${revocati
        .map(
          (a) => `<tr><td>${esc(a.codiceAsset)}</td><td>${esc(personaPerId(documento, a.personaId)?.nome ?? '')}</td>
          <td>${esc(a.email)}</td><td>${esc(a.profilo)}</td><td>${esc(formattaData(a.dataRevoca))}</td></tr>`,
        )
        .join('')}</tbody></table>
    <p class="nota">La revoca è stata eseguita sulla piattaforma e poi registrata con la data indicata.</p>`
        : ''
    }

    <div class="firme">
      <div>Eseguita da${campagna.chiusaDa ? `: ${esc(campagna.chiusaDa)}` : ''}</div>
      <div>Approvata da</div>
    </div>

    ${piede(oggi)}`

  return pagina(`Verbale campagna ${campagna.codice}`, corpo)
}
