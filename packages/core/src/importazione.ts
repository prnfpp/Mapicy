import { mappaRuoloDichiarato, normalizza } from '@mapicy/catalogo'
import { assetPerCodice } from './derivazioni.js'
import { normalizzaEmail, riconcilia } from './riconciliazione.js'
import type { DataIso, Documento, Riconciliazione, RigaEstrazione } from './tipi.js'

/**
 * Import degli elenchi utenti esportati dalle piattaforme.
 *
 * Il parser è deliberatamente tollerante: le quattordici piattaforme
 * esportano in modi diversi e quattro non esportano affatto, quindi quello che
 * arriva è a volte un CSV pulito e a volte un blocco di testo copiato da una
 * pagina. Un parser severo qui vorrebbe dire rimandare la persona a sistemare
 * il file a mano, che è esattamente il lavoro che l'applicativo deve togliere.
 *
 * Tollerante non vuol dire indovino: ogni riga che non si riesce a
 * interpretare finisce fra le scartate con il motivo, e ogni ruolo che il
 * catalogo non riconosce resta segnalato. L'import non scrive mai da solo:
 * produce un'anteprima con gli esiti già calcolati e aspetta la conferma.
 */

export type Delimitatore = ',' | ';' | '\t'

const REGEX_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

/** Riconosce il delimitatore contando quante colonne produce su ogni riga. */
export function riconosciDelimitatore(testo: string): Delimitatore {
  const righe = testo.split(/\r?\n/).filter((r) => r.trim() !== '').slice(0, 10)
  if (righe.length === 0) return ','
  const candidati: Delimitatore[] = ['\t', ';', ',']
  let migliore: Delimitatore = ','
  let punteggioMigliore = -1
  for (const d of candidati) {
    const conteggi = righe.map((r) => separaRiga(r, d).length)
    const colonne = Math.max(...conteggi)
    if (colonne < 2) continue
    // Premia il delimitatore che dà lo stesso numero di colonne su tutte le
    // righe: è il segno che è quello giusto e non un carattere che compare
    // dentro i valori.
    const coerenti = conteggi.filter((c) => c === colonne).length / conteggi.length
    const punteggio = colonne * coerenti
    if (punteggio > punteggioMigliore) {
      punteggioMigliore = punteggio
      migliore = d
    }
  }
  return migliore
}

/** Divide una riga rispettando le virgolette, come vuole il formato CSV. */
export function separaRiga(riga: string, delimitatore: Delimitatore): string[] {
  const celle: string[] = []
  let corrente = ''
  let dentroVirgolette = false
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i]
    if (dentroVirgolette) {
      if (c === '"') {
        if (riga[i + 1] === '"') {
          corrente += '"'
          i++
        } else dentroVirgolette = false
      } else corrente += c
    } else if (c === '"') dentroVirgolette = true
    else if (c === delimitatore) {
      celle.push(corrente.trim())
      corrente = ''
    } else corrente += c
  }
  celle.push(corrente.trim())
  return celle
}

export function separaTabella(testo: string, delimitatore: Delimitatore): string[][] {
  return testo
    .split(/\r?\n/)
    .filter((r) => r.trim() !== '')
    .map((r) => separaRiga(r, delimitatore))
}

/** Indice delle colonne nel file, `-1` quando la colonna non c'è. */
export interface MappaColonne {
  email: number
  nome: number
  ruolo: number
  codiceAsset: number
}

const SINONIMI: Record<keyof MappaColonne, string[]> = {
  email: [
    'email', 'e mail', 'indirizzo e mail', 'indirizzo email', 'posta elettronica',
    'account', 'utente', 'user', 'username', 'nome utente', 'email address', 'user email',
  ],
  nome: ['nome', 'nome persona', 'nome e cognome', 'name', 'full name', 'nome completo', 'persona'],
  ruolo: [
    'ruolo', 'ruoli', 'role', 'roles', 'profilo', 'permessi', 'permission', 'permissions',
    'livello di accesso', 'access level', 'ruolo dichiarato', 'tipo di accesso', 'access',
    'direct roles', 'direct roles and data restrictions', 'autorizzazioni',
  ],
  codiceAsset: ['codice asset', 'asset', 'proprieta', 'property', 'risorsa', 'asset code'],
}

export function riconosciColonne(intestazioni: readonly string[]): MappaColonne {
  const normalizzate = intestazioni.map((h) => normalizza(h))
  const trova = (campo: keyof MappaColonne): number => {
    const sinonimi = SINONIMI[campo]
    // Prima la corrispondenza esatta, poi quella per contenuto: «Direct roles
    // and data restrictions» di GA4 deve cadere su `ruolo` senza che
    // «restrictions» finisca per pescare la colonna sbagliata.
    const esatto = normalizzate.findIndex((h) => sinonimi.includes(h))
    if (esatto >= 0) return esatto
    return normalizzate.findIndex((h) => h !== '' && sinonimi.some((s) => h.includes(s)))
  }
  const email = trova('email')
  const nome = trova('nome')
  const ruolo = trova('ruolo')
  const codiceAsset = trova('codiceAsset')
  return {
    email,
    // Se «nome» e «email» sono cadute sulla stessa colonna (succede con
    // intestazioni come «Utente»), quella colonna è l'e-mail.
    nome: nome === email ? -1 : nome,
    ruolo: ruolo === email || ruolo === nome ? -1 : ruolo,
    codiceAsset: codiceAsset === email || codiceAsset === nome || codiceAsset === ruolo ? -1 : codiceAsset,
  }
}

export interface RigaImportata {
  numeroRiga: number
  email: string
  nomePersona: string
  ruoloDichiarato: string
  /** Il profilo del catalogo riconosciuto nel ruolo dichiarato, `null` se non riconosciuto. */
  profiloRiconosciuto: string | null
  codiceAsset: string
}

export interface RigaScartata {
  numeroRiga: number
  contenuto: string
  motivo: string
}

export interface AnalisiImport {
  delimitatore: Delimitatore
  /** `false` quando il testo non aveva un'intestazione riconoscibile e le colonne sono state dedotte dal contenuto. */
  intestazioniRiconosciute: boolean
  colonne: MappaColonne
  righe: RigaImportata[]
  scartate: RigaScartata[]
  avvisi: string[]
}

export interface OpzioniAnalisi {
  testo: string
  /** L'asset a cui si riferisce l'elenco: serve a riconoscere i ruoli sui profili giusti. */
  codiceAsset: string
  documento: Documento
}

/**
 * Interpreta il testo incollato o il contenuto di un CSV. Non tocca il
 * documento: restituisce quello che ha capito, compreso quello che non ha
 * capito.
 */
export function analizzaImport({ testo, codiceAsset, documento }: OpzioniAnalisi): AnalisiImport {
  const avvisi: string[] = []
  const scartate: RigaScartata[] = []
  const asset = assetPerCodice(documento, codiceAsset)
  if (!asset) {
    return {
      delimitatore: ',',
      intestazioniRiconosciute: false,
      colonne: { email: -1, nome: -1, ruolo: -1, codiceAsset: -1 },
      righe: [],
      scartate: [],
      avvisi: [`Il codice asset "${codiceAsset}" non è in anagrafica: censire prima l'asset.`],
    }
  }

  const delimitatore = riconosciDelimitatore(testo)
  const tabella = separaTabella(testo, delimitatore)
  if (tabella.length === 0) {
    return {
      delimitatore,
      intestazioniRiconosciute: false,
      colonne: { email: -1, nome: -1, ruolo: -1, codiceAsset: -1 },
      righe: [],
      scartate: [],
      avvisi: ['Il testo è vuoto.'],
    }
  }

  const prima = tabella[0]
  const primaSenzaEmail = !prima.some((c) => REGEX_EMAIL.test(c))
  const colonneDaIntestazione = riconosciColonne(prima)
  const intestazioniRiconosciute = primaSenzaEmail && colonneDaIntestazione.email >= 0

  let colonne: MappaColonne
  let corpo: { celle: string[]; numeroRiga: number }[]

  if (intestazioniRiconosciute) {
    colonne = colonneDaIntestazione
    corpo = tabella.slice(1).map((celle, i) => ({ celle, numeroRiga: i + 2 }))
    if (colonne.ruolo < 0) {
      avvisi.push(
        "Nel file non è stata riconosciuta una colonna con il ruolo: le righe verranno importate senza profilo e andranno completate a mano.",
      )
    }
  } else {
    // Nessuna intestazione: si deducono le colonne dal contenuto. L'e-mail si
    // trova per forma, il ruolo perché il catalogo lo riconosce, il nome è
    // quello che resta.
    colonne = deduciColonne(tabella, asset.piattaforma, asset.tipoAsset)
    corpo = tabella.map((celle, i) => ({ celle, numeroRiga: i + 1 }))
    if (colonne.email < 0) {
      return {
        delimitatore,
        intestazioniRiconosciute: false,
        colonne,
        righe: [],
        scartate: [],
        avvisi: [
          'Nel testo non si trovano indirizzi e-mail. L’elenco va incollato comprendendo la colonna con l’indirizzo o il nome utente: è la chiave con cui il confronto riconosce le persone.',
        ],
      }
    }
    avvisi.push(
      'Il testo non aveva un’intestazione riconoscibile: le colonne sono state dedotte dal contenuto. Controllare l’anteprima riga per riga prima di confermare.',
    )
  }

  const righe: RigaImportata[] = []
  const vistiInQuestoFile = new Set<string>()

  for (const { celle, numeroRiga } of corpo) {
    const cella = (i: number) => (i >= 0 && i < celle.length ? celle[i].trim() : '')
    const grezzaEmail = cella(colonne.email)
    const trovata = REGEX_EMAIL.exec(grezzaEmail)
    if (!trovata) {
      // Se la colonna dell'e-mail non ne contiene una, provo le altre celle:
      // capita quando le colonne sono disallineate su qualche riga.
      const altrove = celle.map((c) => REGEX_EMAIL.exec(c)).find((m) => m !== null)
      if (!altrove) {
        scartate.push({
          numeroRiga,
          contenuto: celle.join(delimitatore === '\t' ? ' | ' : delimitatore),
          motivo: grezzaEmail
            ? `"${grezzaEmail}" non è un indirizzo e-mail.`
            : 'La riga non contiene un indirizzo e-mail.',
        })
        continue
      }
      celle[colonne.email] = altrove[0]
    }
    const email = normalizzaEmail(REGEX_EMAIL.exec(cella(colonne.email))![0])

    if (vistiInQuestoFile.has(email)) {
      scartate.push({
        numeroRiga,
        contenuto: celle.join(' | '),
        motivo: `${email} compare più di una volta in questo elenco: tenuta solo la prima riga.`,
      })
      continue
    }
    vistiInQuestoFile.add(email)

    const ruoloDichiarato = cella(colonne.ruolo)
    righe.push({
      numeroRiga,
      email,
      nomePersona: cella(colonne.nome),
      ruoloDichiarato,
      profiloRiconosciuto: ruoloDichiarato
        ? (mappaRuoloDichiarato(asset.piattaforma, asset.tipoAsset, ruoloDichiarato)?.profilo ?? null)
        : null,
      codiceAsset: cella(colonne.codiceAsset) || codiceAsset,
    })
  }

  const nonRiconosciuti = [
    ...new Set(righe.filter((r) => r.ruoloDichiarato && !r.profiloRiconosciuto).map((r) => r.ruoloDichiarato)),
  ]
  if (nonRiconosciuti.length > 0) {
    avvisi.push(
      `Il catalogo non riconosce ${nonRiconosciuti.length === 1 ? 'questo ruolo' : 'questi ruoli'}: ${nonRiconosciuti.map((r) => `"${r}"`).join(', ')}. ` +
        'Le righe si importano comunque con il testo così come è scritto, e il confronto le segnalerà come profilo diverso finché il ruolo non viene ricondotto a un profilo del catalogo.',
    )
  }

  return { delimitatore, intestazioniRiconosciute, colonne, righe, scartate, avvisi }
}

/** Deduce le colonne dal contenuto, quando manca l'intestazione. */
function deduciColonne(tabella: readonly string[][], piattaforma: string, tipoAsset: string): MappaColonne {
  const larghezza = Math.max(...tabella.map((r) => r.length))
  const punteggi = { email: new Array(larghezza).fill(0), ruolo: new Array(larghezza).fill(0), nome: new Array(larghezza).fill(0) }
  for (const riga of tabella) {
    for (let i = 0; i < larghezza; i++) {
      const cella = (riga[i] ?? '').trim()
      if (!cella) continue
      if (REGEX_EMAIL.test(cella)) punteggi.email[i]++
      else if (mappaRuoloDichiarato(piattaforma, tipoAsset, cella)) punteggi.ruolo[i]++
      else if (/^[\p{L}][\p{L}'`.\- ]+$/u.test(cella) && cella.includes(' ')) punteggi.nome[i]++
    }
  }
  const migliore = (p: number[], escluse: number[]): number => {
    let indice = -1
    let max = 0
    for (let i = 0; i < p.length; i++) {
      if (escluse.includes(i)) continue
      if (p[i] > max) {
        max = p[i]
        indice = i
      }
    }
    return indice
  }
  const email = migliore(punteggi.email, [])
  const ruolo = migliore(punteggi.ruolo, [email])
  const nome = migliore(punteggi.nome, [email, ruolo])
  return { email, nome, ruolo, codiceAsset: -1 }
}

export interface OpzioniCostruzione {
  fonte: string
  codiceAsset: string
  nomeAssetPiattaforma: string
  dataEstrazione: DataIso
  /** Identificativi per le righe: li genera il chiamante, il core non ha casualità. */
  identificativi: readonly string[]
}

export function costruisciEstrazioni(
  analisi: AnalisiImport,
  opzioni: OpzioniCostruzione,
): RigaEstrazione[] {
  if (opzioni.identificativi.length < analisi.righe.length) {
    throw new Error(
      `Servono ${analisi.righe.length} identificativi per le righe da importare, ne sono stati passati ${opzioni.identificativi.length}.`,
    )
  }
  return analisi.righe.map((r, i) => ({
    id: opzioni.identificativi[i],
    fonte: opzioni.fonte,
    codiceAsset: r.codiceAsset || opzioni.codiceAsset,
    nomeAssetPiattaforma: opzioni.nomeAssetPiattaforma,
    nomePersona: r.nomePersona,
    email: r.email,
    // Si conserva il testo della piattaforma, non il profilo riconosciuto:
    // l'estrazione deve restare la fotografia di quello che la piattaforma ha
    // dichiarato, altrimenti il confronto smette di essere un confronto.
    ruoloDichiarato: r.ruoloDichiarato,
    dataEstrazione: opzioni.dataEstrazione,
  }))
}

/**
 * Sostituisce le righe di estrazione dell'asset con quelle nuove, invece di
 * aggiungerle. Un'estrazione è una fotografia a una data: accumularle
 * significherebbe confrontare il registro con l'unione di tutte le fotografie
 * mai scattate, e una persona rimossa sei mesi fa risulterebbe ancora presente.
 */
export function applicaImport(
  documento: Documento,
  nuove: readonly RigaEstrazione[],
  codiceAsset: string,
): Documento {
  return {
    ...documento,
    estrazioni: [...documento.estrazioni.filter((e) => e.codiceAsset !== codiceAsset), ...nuove],
  }
}

/** L'effetto che l'import avrebbe sul confronto, da mostrare prima di confermare. */
export function anteprimaImport(
  documento: Documento,
  nuove: readonly RigaEstrazione[],
  codiceAsset: string,
  oggi: DataIso,
): Riconciliazione {
  const r = riconcilia(applicaImport(documento, nuove, codiceAsset), oggi)
  return { ...r, righe: r.righe.filter((x) => normalizza(x.codiceAsset) === normalizza(codiceAsset)) }
}
