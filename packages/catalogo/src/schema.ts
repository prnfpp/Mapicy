import { z } from 'zod'

/**
 * Schemi dei file in `dati/`. Servono a far fallire il caricamento subito e con
 * un messaggio comprensibile quando qualcuno modifica un JSON a mano: il
 * catalogo è pensato per essere aggiornato senza toccare il codice, quindi la
 * modifica a mano è il caso normale, non l'eccezione.
 */

export const livelloRischio = z.enum(['alto', 'medio', 'basso'])
export type LivelloRischio = z.infer<typeof livelloRischio>

export const gravita = z.enum(['bloccante', 'alta', 'media', 'informativo'])
export type Gravita = z.infer<typeof gravita>

export const profiloCatalogo = z.object({
  piattaforma: z.string().min(1),
  tipoAsset: z.string().min(1),
  profilo: z.string().min(1),
  datiTrattati: z.string(),
  attivita: z.string(),
  rischio: livelloRischio,
})
export type ProfiloCatalogo = z.infer<typeof profiloCatalogo>

export const fileProfili = z.object({
  aggiornatoIl: z.string(),
  fonte: z.string().optional(),
  profili: z.array(profiloCatalogo).min(1),
})

export const fornitoreCatalogo = z.object({
  piattaforma: z.string().min(1),
  fornitore: z.string(),
  ruoloPrivacyFornitore: z.string(),
  trasferimentoExtraUe: z.string(),
  riferimentiContrattuali: z.string(),
  notaVerifica: z.string(),
})
export type FornitoreCatalogo = z.infer<typeof fornitoreCatalogo>

export const fileFornitori = z.object({
  aggiornatoIl: z.string(),
  avvertenza: z.string(),
  fornitori: z.array(fornitoreCatalogo).min(1),
})

export const tipoAssetCatalogo = z.object({
  piattaforma: z.string().min(1),
  tipoAsset: z.string().min(1),
  codice: z.string().min(1),
  profili: z.array(z.string()).min(1),
})
export type TipoAssetCatalogo = z.infer<typeof tipoAssetCatalogo>

export const fileTipiAsset = z.object({ tipiAsset: z.array(tipoAssetCatalogo).min(1) })

export const fileElenchi = z.object({
  statoAccesso: z.array(z.string()).min(1),
  statoAsset: z.array(z.string()).min(1),
  statoPersona: z.array(z.string()).min(1),
  ruoloPrivacy: z.array(z.string()).min(1),
  baseGiuridica: z.array(z.string()).min(1),
  trasferimentoExtraUe: z.array(z.string()).min(1),
  siNo: z.array(z.string()).min(1),
  tipoModifica: z.array(z.string()).min(1),
  rapportoLavoro: z.array(z.string()).min(1),
  livelloRischio: z.array(z.string()).min(1),
  esitoVerifica: z.array(z.string()).min(1),
  fonteEstrazione: z.array(z.string()).min(1),
  piattaforme: z.array(z.string()).min(1),
  ruoloAziendale: z.array(z.string()),
})
export type Elenchi = z.infer<typeof fileElenchi>

export const definizioneControllo = z.object({
  codice: z.string().regex(/^C\d\d$/),
  titolo: z.string().min(1),
  gravita,
  comeCorreggere: z.string().min(1),
})
export type DefinizioneControllo = z.infer<typeof definizioneControllo>

export const fileControlli = z.object({ controlli: z.array(definizioneControllo).min(1) })

export const guidaAsset = z.object({
  piattaforma: z.string().min(1),
  tipoAsset: z.string().min(1),
  /** false = percorso ricostruito dalla documentazione pubblica, da confermare al primo uso. */
  verificato: z.boolean(),
  fonte: z.string().optional(),
  identificativo: z.object({
    nome: z.string(),
    formato: z.string(),
    percorso: z.string(),
    esempio: z.string(),
  }),
  utenti: z.object({
    /** `csv`: la piattaforma ha un pulsante di download. `copia`: si incolla l'elenco. */
    esportazione: z.enum(['csv', 'copia']),
    percorso: z.string(),
    note: z.string(),
  }),
})
export type GuidaAsset = z.infer<typeof guidaAsset>

export const fileGuide = z.object({
  avvertenza: z.string(),
  aggiornatoIl: z.string(),
  guide: z.array(guidaAsset).min(1),
})
