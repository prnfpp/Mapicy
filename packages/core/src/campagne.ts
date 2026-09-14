import { aggiungiGiorni, semestreDi } from './date.js'
import { controlliBloccantiAperti, eseguiControlli } from './controlli.js'
import { etichettaAccesso, personaPerId } from './derivazioni.js'
import type { Campagna, DataIso, Documento, EsitoVerifica } from './tipi.js'

/**
 * Il ciclo di una campagna di verifica. Le funzioni non modificano il
 * documento: ne restituiscono uno nuovo. Costa una copia superficiale e in
 * cambio rende banale annullare l'ultima operazione, che su un applicativo
 * usato dall'amministrazione vale più della copia risparmiata.
 */

export function prossimoCodiceCampagna(oggi: DataIso, campagneEsistenti: readonly Campagna[]): string {
  const proposto = semestreDi(oggi)
  return campagneEsistenti.some((c) => c.codice === proposto) ? `${proposto}-bis` : proposto
}

export function apriCampagna(documento: Documento, codice: string, oggi: DataIso): Documento {
  if (documento.campagne.some((c) => c.codice === codice && c.chiusaIl === null)) {
    return { ...documento, campagnaCorrente: codice }
  }
  const campagna: Campagna = { codice, apertaIl: oggi, chiusaIl: null, chiusaDa: '', note: '' }
  return {
    ...documento,
    campagnaCorrente: codice,
    campagne: [...documento.campagne, campagna],
  }
}

export interface AvanzamentoCampagna {
  codice: string
  accessiAttivi: number
  verificatiInCampagna: number
  daVerificare: number
  /** Fra 0 e 1. Vale 1 quando non c'è niente da verificare, perché una campagna senza accessi è completa, non a zero. */
  quota: number
}

export function avanzamentoCampagna(documento: Documento): AvanzamentoCampagna {
  const codice = documento.campagnaCorrente
  const attivi = documento.accessi.filter((a) => a.stato === 'attivo')
  const verificati = documento.accessi.filter(
    (a) => a.campagnaVerifica === codice && a.campagnaVerifica !== '' && a.dataUltimaVerifica !== null,
  )
  // Un accesso revocato durante questa campagna è stato verificato: contarlo
  // fra i verificati e non fra gli attivi è l'unico modo di far arrivare
  // l'avanzamento al 100% quando la campagna è davvero finita.
  const daVerificare = attivi.filter((a) => a.campagnaVerifica !== codice || !a.dataUltimaVerifica).length
  const totale = verificati.length + daVerificare
  return {
    codice,
    accessiAttivi: attivi.length,
    verificatiInCampagna: verificati.length,
    daVerificare,
    quota: totale === 0 ? 1 : verificati.length / totale,
  }
}

export interface Verifica {
  accessoId: string
  esito: EsitoVerifica
  verificatoDa: string
  /** Obbligatorio con esito `profilo-ridotto`: il profilo a cui si è scesi. */
  nuovoProfilo?: string
  note?: string
  /** Identificativo della voce da scrivere nel registro delle revisioni. Lo genera il chiamante: il core non ha una fonte di casualità. */
  idRevisione: string
}

/**
 * Registra l'esito della verifica di un accesso e scrive la voce nel registro
 * delle revisioni. Con esito `revocato` cambia lo stato e mette la data, ma
 * **non** cancella la riga: l'accesso revocato con la sua data è l'evidenza
 * che la revoca è stata fatta.
 */
export function registraVerifica(documento: Documento, verifica: Verifica, oggi: DataIso): Documento {
  const accesso = documento.accessi.find((a) => a.id === verifica.accessoId)
  if (!accesso) throw new Error(`Nessun accesso con identificativo ${verifica.accessoId}.`)
  if (verifica.esito === 'profilo-ridotto' && !verifica.nuovoProfilo) {
    throw new Error(
      "Con esito «profilo ridotto» va indicato il nuovo profilo: senza, il registro direbbe che il profilo è stato ridotto senza dire a cosa.",
    )
  }

  const aggiornato = {
    ...accesso,
    profilo: verifica.nuovoProfilo ?? accesso.profilo,
    stato: verifica.esito === 'revocato' ? ('revocato' as const) : accesso.stato,
    dataRevoca: verifica.esito === 'revocato' ? (accesso.dataRevoca ?? oggi) : accesso.dataRevoca,
    dataUltimaVerifica: oggi,
    esitoUltimaVerifica: verifica.esito,
    campagnaVerifica: documento.campagnaCorrente,
    verificatoDa: verifica.verificatoDa,
    note: verifica.note ? [accesso.note, verifica.note].filter(Boolean).join(' — ') : accesso.note,
  }

  const descrizioni: Record<EsitoVerifica, string> = {
    confermato: 'Accesso confermato in sede di verifica.',
    'profilo-ridotto': `Profilo ridotto da "${accesso.profilo}" a "${verifica.nuovoProfilo}".`,
    revocato: 'Accesso revocato.',
    'da-verificare': 'Verifica rinviata: accesso lasciato da verificare.',
  }
  const tipiModifica: Record<EsitoVerifica, string> = {
    confermato: 'Verifica periodica',
    'profilo-ridotto': 'Modifica profilo',
    revocato: 'Revoca accesso',
    'da-verificare': 'Verifica periodica',
  }

  return {
    ...documento,
    accessi: documento.accessi.map((a) => (a.id === accesso.id ? aggiornato : a)),
    revisioni: [
      ...documento.revisioni,
      {
        id: verifica.idRevisione,
        data: oggi,
        campagna: documento.campagnaCorrente,
        codiceAsset: accesso.codiceAsset,
        tipoModifica: tipiModifica[verifica.esito],
        personaInteressata: personaPerId(documento, accesso.personaId)?.nome ?? accesso.email,
        descrizione: `${descrizioni[verifica.esito]}${verifica.note ? ` ${verifica.note}` : ''}`,
        eseguitaDa: verifica.verificatoDa,
        approvataDa: '',
      },
    ],
  }
}

export interface EsitoChiusura {
  puoChiudere: boolean
  motivi: string[]
}

/**
 * Una campagna non si chiude con controlli bloccanti aperti. È una regola, non
 * un avviso: il template di partenza si limitava a scriverlo nelle istruzioni,
 * e un avviso che si può ignorare viene ignorato.
 */
export function puoChiudereCampagna(documento: Documento, oggi: DataIso): EsitoChiusura {
  const motivi: string[] = []
  if (!documento.campagnaCorrente) motivi.push('Non c’è una campagna aperta.')
  const esiti = eseguiControlli(documento, oggi)
  for (const bloccante of controlliBloccantiAperti(esiti)) {
    motivi.push(
      `${bloccante.codice} — ${bloccante.titolo}: ${bloccante.casi.length} ${bloccante.casi.length === 1 ? 'caso' : 'casi'} da risolvere.`,
    )
  }
  const avanzamento = avanzamentoCampagna(documento)
  if (avanzamento.daVerificare > 0) {
    motivi.push(
      `Restano ${avanzamento.daVerificare} accessi attivi da verificare in questa campagna.`,
    )
  }
  return { puoChiudere: motivi.length === 0, motivi }
}

export function chiudiCampagna(
  documento: Documento,
  oggi: DataIso,
  chiusaDa: string,
  note = '',
): Documento {
  const esito = puoChiudereCampagna(documento, oggi)
  if (!esito.puoChiudere) {
    throw new Error(`La campagna non può essere chiusa:\n- ${esito.motivi.join('\n- ')}`)
  }
  return {
    ...documento,
    campagne: documento.campagne.map((c) =>
      c.codice === documento.campagnaCorrente ? { ...c, chiusaIl: oggi, chiusaDa, note } : c,
    ),
    // Chiudere la campagna ripianifica la verifica degli asset attivi: è
    // l'operazione che nell'Excel si faceva a mano asset per asset e che
    // quindi non si faceva.
    asset: documento.asset.map((a) =>
      a.stato === 'attivo' ? { ...a, prossimaVerifica: aggiungiGiorni(oggi, 180) } : a,
    ),
  }
}

/**
 * La revisione non va fatta solo a calendario. Quando una persona esce,
 * cambia ruolo o finisce un contratto, questo è l'elenco di tutto quello che
 * le va revocato, senza aprire una campagna semestrale.
 */
export function accessiDaChiudere(documento: Documento, personaId: string): string[] {
  return documento.accessi
    .filter((a) => a.personaId === personaId && a.stato !== 'revocato')
    .map((a) => etichettaAccesso(documento, a))
}
