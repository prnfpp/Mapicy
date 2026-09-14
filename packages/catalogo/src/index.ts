import datiProfili from '../dati/profili.json'
import datiFornitori from '../dati/fornitori.json'
import datiTipiAsset from '../dati/tipi-asset.json'
import datiElenchi from '../dati/elenchi.json'
import datiControlli from '../dati/controlli.json'
import datiGuide from '../dati/guide.json'
import {
  fileControlli,
  fileElenchi,
  fileFornitori,
  fileGuide,
  fileProfili,
  fileTipiAsset,
  type DefinizioneControllo,
  type Elenchi,
  type FornitoreCatalogo,
  type GuidaAsset,
  type ProfiloCatalogo,
  type TipoAssetCatalogo,
} from './schema.js'

export * from './schema.js'

/**
 * Il catalogo è il sapere sulle piattaforme: quali profili autorizzativi
 * esistono, cosa vede e cosa può fare chi li ha, quanto pesa in termini di
 * rischio privacy, e dove si va a cercare l'informazione sulla piattaforma.
 *
 * Sta in un pacchetto a sé perché è la parte che invecchia: i fornitori
 * rinominano i ruoli, spostano i menu, cambiano ruolo privacy. Aggiornarlo
 * deve costare la modifica di un JSON.
 */

function leggi<T>(schema: { parse: (v: unknown) => T }, valore: unknown, nomeFile: string): T {
  try {
    return schema.parse(valore)
  } catch (errore) {
    throw new Error(
      `Il file dati/${nomeFile} del catalogo non è valido. ` +
        `Se è stato modificato a mano, controllare l'ultima modifica. Dettaglio: ${String(errore)}`,
    )
  }
}

const profiliValidati = leggi(fileProfili, datiProfili, 'profili.json')
const fornitoriValidati = leggi(fileFornitori, datiFornitori, 'fornitori.json')
const tipiAssetValidati = leggi(fileTipiAsset, datiTipiAsset, 'tipi-asset.json')
const elenchiValidati = leggi(fileElenchi, datiElenchi, 'elenchi.json')
const controlliValidati = leggi(fileControlli, datiControlli, 'controlli.json')
const guideValidate = leggi(fileGuide, datiGuide, 'guide.json')

/**
 * Normalizzazione usata per confrontare nomi che arrivano da fonti diverse:
 * minuscolo, accenti via, punteggiatura via, spazi compattati. Serve a far
 * combaciare «Accesso completo alla Pagina» con «accesso completo alla pagina»
 * senza far combaciare cose diverse.
 */
export function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const chiaveTerna = (piattaforma: string, tipoAsset: string, profilo: string) =>
  `${normalizza(piattaforma)}|${normalizza(tipoAsset)}|${normalizza(profilo)}`
const chiaveCoppia = (piattaforma: string, tipoAsset: string) =>
  `${normalizza(piattaforma)}|${normalizza(tipoAsset)}`

const indiceProfili = new Map<string, ProfiloCatalogo>(
  profiliValidati.profili.map((p) => [chiaveTerna(p.piattaforma, p.tipoAsset, p.profilo), p]),
)
const indiceFornitori = new Map<string, FornitoreCatalogo>(
  fornitoriValidati.fornitori.map((f) => [normalizza(f.piattaforma), f]),
)
const indiceTipiAsset = new Map<string, TipoAssetCatalogo>(
  tipiAssetValidati.tipiAsset.map((t) => [chiaveCoppia(t.piattaforma, t.tipoAsset), t]),
)
const indiceGuide = new Map<string, GuidaAsset>(
  guideValidate.guide.map((g) => [chiaveCoppia(g.piattaforma, g.tipoAsset), g]),
)
const indiceControlli = new Map<string, DefinizioneControllo>(
  controlliValidati.controlli.map((c) => [c.codice, c]),
)

export const elenchi: Elenchi = elenchiValidati
export const avvertenzaFornitori = fornitoriValidati.avvertenza
export const avvertenzaGuide = guideValidate.avvertenza
export const catalogoAggiornatoIl = profiliValidati.aggiornatoIl

export function piattaforme(): string[] {
  return [...elenchi.piattaforme]
}

export function tipiAsset(): TipoAssetCatalogo[] {
  return [...tipiAssetValidati.tipiAsset]
}

export function tipiAssetPer(piattaforma: string): TipoAssetCatalogo[] {
  const n = normalizza(piattaforma)
  return tipiAssetValidati.tipiAsset.filter((t) => normalizza(t.piattaforma) === n)
}

/** I profili proponibili per un asset. È l'elenco che alimenta il menu: su una Pagina Facebook propone i profili di una Pagina Facebook. */
export function profiliPer(piattaforma: string, tipoAsset: string): ProfiloCatalogo[] {
  const n = chiaveCoppia(piattaforma, tipoAsset)
  return profiliValidati.profili.filter((p) => chiaveCoppia(p.piattaforma, p.tipoAsset) === n)
}

export function trovaProfilo(
  piattaforma: string,
  tipoAsset: string,
  profilo: string,
): ProfiloCatalogo | null {
  return indiceProfili.get(chiaveTerna(piattaforma, tipoAsset, profilo)) ?? null
}

export function fornitorePer(piattaforma: string): FornitoreCatalogo | null {
  return indiceFornitori.get(normalizza(piattaforma)) ?? null
}

export function guidaPer(piattaforma: string, tipoAsset: string): GuidaAsset | null {
  return indiceGuide.get(chiaveCoppia(piattaforma, tipoAsset)) ?? null
}

export function tipoAssetPer(piattaforma: string, tipoAsset: string): TipoAssetCatalogo | null {
  return indiceTipiAsset.get(chiaveCoppia(piattaforma, tipoAsset)) ?? null
}

export function controlli(): DefinizioneControllo[] {
  return [...controlliValidati.controlli]
}

export function definizioneControllo(codice: string): DefinizioneControllo | null {
  return indiceControlli.get(codice) ?? null
}

/**
 * Tenta di riconoscere nel catalogo il nome del ruolo così come lo scrive la
 * piattaforma nell'elenco utenti esportato. Prima la corrispondenza esatta,
 * poi quella normalizzata, poi si arrende: restituire `null` e segnalarlo è
 * meglio che assegnare il profilo più somigliante, perché un profilo sbagliato
 * qui diventa un livello di rischio sbagliato nel registro.
 */
export function mappaRuoloDichiarato(
  piattaforma: string,
  tipoAsset: string,
  ruoloDichiarato: string,
): ProfiloCatalogo | null {
  const candidati = profiliPer(piattaforma, tipoAsset)
  const esatto = candidati.find((p) => p.profilo === ruoloDichiarato.trim())
  if (esatto) return esatto
  const n = normalizza(ruoloDichiarato)
  if (!n) return null
  const normalizzato = candidati.find((p) => normalizza(p.profilo) === n)
  if (normalizzato) return normalizzato
  // Alcune piattaforme riportano il ruolo in inglese fra parentesi accanto
  // all'italiano, per esempio «Visualizzatore (Viewer)». Se il testo
  // dichiarato coincide con una delle due parti, vale.
  return (
    candidati.find((p) => {
      const parti = p.profilo.split(/[()]/).map((x) => normalizza(x)).filter(Boolean)
      return parti.includes(n)
    }) ?? null
  )
}

/**
 * Coerenza interna del catalogo. Non è una curiosità da test: i file si
 * modificano a mano, e un tipo di asset senza guida o un profilo che non
 * appartiene a nessun tipo dichiarato sono errori che si notano solo quando
 * qualcuno sta compilando.
 */
export function verificaIntegrita(): string[] {
  const problemi: string[] = []
  for (const t of tipiAssetValidati.tipiAsset) {
    const dove = `${t.piattaforma} / ${t.tipoAsset}`
    if (!fornitorePer(t.piattaforma)) problemi.push(`Nessun fornitore per la piattaforma ${t.piattaforma}`)
    if (!guidaPer(t.piattaforma, t.tipoAsset)) problemi.push(`Nessuna guida di reperimento per ${dove}`)
    if (profiliPer(t.piattaforma, t.tipoAsset).length === 0) problemi.push(`Nessun profilo per ${dove}`)
    for (const nome of t.profili) {
      if (!trovaProfilo(t.piattaforma, t.tipoAsset, nome)) {
        problemi.push(`Il profilo "${nome}" è elencato su ${dove} ma non è descritto in profili.json`)
      }
    }
  }
  for (const p of profiliValidati.profili) {
    if (!tipoAssetPer(p.piattaforma, p.tipoAsset)) {
      problemi.push(`Il profilo "${p.profilo}" usa il tipo asset ${p.piattaforma} / ${p.tipoAsset}, che non è dichiarato in tipi-asset.json`)
    }
  }
  const viste = new Set<string>()
  for (const p of profiliValidati.profili) {
    const k = chiaveTerna(p.piattaforma, p.tipoAsset, p.profilo)
    if (viste.has(k)) problemi.push(`Profilo duplicato: ${p.piattaforma} / ${p.tipoAsset} / ${p.profilo}`)
    viste.add(k)
  }
  for (const piattaforma of elenchi.piattaforme) {
    if (tipiAssetPer(piattaforma).length === 0) problemi.push(`La piattaforma ${piattaforma} non ha tipi di asset`)
  }
  return problemi
}

/** Quello che nel catalogo è dichiarato non verificato, per mostrarlo come avviso invece di darlo per buono. */
export function guideDaVerificare(): GuidaAsset[] {
  return guideValidate.guide.filter((g) => !g.verificato)
}
