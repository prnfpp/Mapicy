import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { apriDocumento, documentoVuoto, type Documento } from '@mapicy/core'
import type { ArchivioAperto, CopiaDiSicurezza, ImpostazioniApp, InfoArchivio } from './ponte.js'

/**
 * L'archivio è un unico file JSON nella cartella dati dell'applicativo.
 * L'utente può salvarne una copia dove vuole, ma questo è il file di lavoro.
 *
 * Il salvataggio è atomico: si scrive un file temporaneo e poi si rinomina.
 * Senza, un'interruzione a metà scrittura lascia un archivio troncato, e
 * l'archivio troncato è tutta la mappatura.
 */

const NOME_ARCHIVIO = 'mapicy-archivio.json'
const NOME_IMPOSTAZIONI = 'mapicy-impostazioni.json'
const CARTELLA_COPIE = 'copie-di-sicurezza'
const COPIE_DA_TENERE = 20

let percorsoCorrente: string | null = null

function cartellaDati(): string {
  return app.getPath('userData')
}

export function percorsoArchivio(): string {
  return percorsoCorrente ?? join(cartellaDati(), NOME_ARCHIVIO)
}

export function cartellaCopie(): string {
  return join(cartellaDati(), CARTELLA_COPIE)
}

function adesso(): string {
  return new Date().toISOString()
}

async function scriviAtomico(percorso: string, contenuto: string): Promise<void> {
  const temporaneo = `${percorso}.parziale`
  await writeFile(temporaneo, contenuto, 'utf8')
  await rename(temporaneo, percorso)
}

async function leggiDocumento(percorso: string): Promise<Documento> {
  const testo = await readFile(percorso, 'utf8')
  let grezzo: unknown
  try {
    grezzo = JSON.parse(testo)
  } catch {
    throw new Error(
      `Il file ${percorso} non è un JSON leggibile. Se è l'archivio di lavoro, provare a ripristinare una copia di sicurezza dal menu Aiuto.`,
    )
  }
  return apriDocumento(grezzo)
}

export async function apriPredefinito(): Promise<ArchivioAperto | null> {
  const percorso = percorsoArchivio()
  if (!existsSync(percorso)) return null
  const documento = await leggiDocumento(percorso)
  const info = await stat(percorso)
  percorsoCorrente = percorso
  return { documento, percorso, salvatoIl: info.mtime.toISOString() }
}

export async function apriDa(percorso: string): Promise<ArchivioAperto> {
  const documento = await leggiDocumento(percorso)
  const info = await stat(percorso)
  percorsoCorrente = percorso
  return { documento, percorso, salvatoIl: info.mtime.toISOString() }
}

/**
 * Salva e tiene una copia di sicurezza della versione precedente. Le copie
 * sono la risposta a «ho sbagliato e ho salvato»: senza, l'unico rimedio
 * sarebbe il backup esportato a mano, che nessuno fa ogni volta.
 */
export async function salva(documento: Documento): Promise<{ salvatoIl: string }> {
  const percorso = percorsoArchivio()
  const contenuto = JSON.stringify(documento, null, 2)

  if (existsSync(percorso)) {
    const precedente = await readFile(percorso, 'utf8')
    // Non si tiene una copia se il contenuto non è cambiato: altrimenti venti
    // salvataggi automatici identici cancellerebbero venti copie utili.
    if (impronta(precedente) !== impronta(contenuto)) {
      await mkdir(cartellaCopie(), { recursive: true })
      const nome = `archivio-${adesso().replace(/[:.]/g, '-')}.json`
      await writeFile(join(cartellaCopie(), nome), precedente, 'utf8')
      await potaCopie()
    }
  } else {
    await mkdir(cartellaDati(), { recursive: true })
  }

  await scriviAtomico(percorso, contenuto)
  percorsoCorrente = percorso
  return { salvatoIl: adesso() }
}

function impronta(testo: string): string {
  return createHash('sha256').update(testo).digest('hex')
}

async function potaCopie(): Promise<void> {
  const copie = await copieDiSicurezza()
  for (const vecchia of copie.slice(COPIE_DA_TENERE)) {
    await unlink(join(cartellaCopie(), vecchia.nome)).catch(() => undefined)
  }
}

export async function copieDiSicurezza(): Promise<CopiaDiSicurezza[]> {
  if (!existsSync(cartellaCopie())) return []
  const nomi = (await readdir(cartellaCopie())).filter((n) => n.startsWith('archivio-') && n.endsWith('.json'))
  const copie = await Promise.all(
    nomi.map(async (nome) => {
      const info = await stat(join(cartellaCopie(), nome))
      return { nome, salvataIl: info.mtime.toISOString(), dimensione: info.size }
    }),
  )
  return copie.sort((a, b) => b.salvataIl.localeCompare(a.salvataIl))
}

export async function ripristinaCopia(nome: string): Promise<ArchivioAperto> {
  // Il nome arriva dall'interfaccia: va trattato come non fidato, perché
  // «../../qualcosa» leggerebbe un file fuori dalla cartella delle copie.
  if (nome.includes('/') || nome.includes('\\') || nome.includes('..')) {
    throw new Error('Nome della copia di sicurezza non valido.')
  }
  const percorso = join(cartellaCopie(), nome)
  if (!existsSync(percorso)) throw new Error(`La copia di sicurezza ${nome} non esiste più.`)
  const documento = await leggiDocumento(percorso)
  // Ripristinare significa riscrivere l'archivio di lavoro: prima si salva, così
  // la versione che si stava sostituendo finisce a sua volta fra le copie.
  await salva(documento)
  return { documento, percorso: percorsoArchivio(), salvatoIl: adesso() }
}

export async function infoArchivio(): Promise<InfoArchivio> {
  const percorso = percorsoArchivio()
  if (!existsSync(percorso)) {
    return { percorso, esiste: false, salvatoIl: '', dimensione: 0, cartellaCopie: cartellaCopie() }
  }
  const info = await stat(percorso)
  return {
    percorso,
    esiste: true,
    salvatoIl: info.mtime.toISOString(),
    dimensione: info.size,
    cartellaCopie: cartellaCopie(),
  }
}

/** Crea l'archivio al primo avvio, così il resto dell'applicativo lavora sempre su un file che esiste. */
export async function creaVuoto(): Promise<ArchivioAperto> {
  const documento = documentoVuoto()
  await salva(documento)
  return { documento, percorso: percorsoArchivio(), salvatoIl: adesso() }
}

const IMPOSTAZIONI_PREDEFINITE: ImpostazioniApp = {
  clientIdGoogle: '',
  dominioAmmesso: '',
  nomeLocale: '',
}

export async function leggiImpostazioni(): Promise<ImpostazioniApp> {
  const percorso = join(cartellaDati(), NOME_IMPOSTAZIONI)
  if (!existsSync(percorso)) return { ...IMPOSTAZIONI_PREDEFINITE }
  try {
    const lette = JSON.parse(await readFile(percorso, 'utf8')) as Partial<ImpostazioniApp>
    return { ...IMPOSTAZIONI_PREDEFINITE, ...lette }
  } catch {
    return { ...IMPOSTAZIONI_PREDEFINITE }
  }
}

export async function salvaImpostazioni(impostazioni: ImpostazioniApp): Promise<ImpostazioniApp> {
  await mkdir(cartellaDati(), { recursive: true })
  const completo = { ...IMPOSTAZIONI_PREDEFINITE, ...impostazioni }
  await scriviAtomico(join(cartellaDati(), NOME_IMPOSTAZIONI), JSON.stringify(completo, null, 2))
  return completo
}
