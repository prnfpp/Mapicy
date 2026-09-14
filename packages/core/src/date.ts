/**
 * Aritmetica sulle date in formato `AAAA-MM-GG`. Fatta a mano invece che con
 * `Date` locale perché `new Date('2026-03-01')` è mezzanotte UTC e, a est di
 * Greenwich, `getDate()` restituisce il giorno prima. Su una scadenza a 180
 * giorni un errore di un giorno non si nota mai; su «questo accesso è scaduto
 * ieri» si nota nel momento peggiore.
 */

import type { DataIso } from './tipi.js'

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/

export function dataValida(data: string): data is DataIso {
  const m = FORMATO.exec(data)
  if (!m) return false
  const [, a, me, g] = m
  const anno = Number(a)
  const mese = Number(me)
  const giorno = Number(g)
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return false
  const t = Date.UTC(anno, mese - 1, giorno)
  const d = new Date(t)
  return d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === giorno
}

function aUtc(data: DataIso): number {
  const m = FORMATO.exec(data)
  if (!m) throw new Error(`Data non valida: "${data}". Formato atteso AAAA-MM-GG.`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

const GIORNO = 86_400_000

/** Giorni da `da` a `a`. Positivo se `a` è successiva. */
export function giorniFra(da: DataIso, a: DataIso): number {
  return Math.round((aUtc(a) - aUtc(da)) / GIORNO)
}

export function aggiungiGiorni(data: DataIso, giorni: number): DataIso {
  return new Date(aUtc(data) + giorni * GIORNO).toISOString().slice(0, 10) as DataIso
}

export function primaDi(data: DataIso, riferimento: DataIso): boolean {
  return aUtc(data) < aUtc(riferimento)
}

/** Il semestre in cui cade una data, nella forma usata per le campagne: `2026-H2`. */
export function semestreDi(data: DataIso): string {
  const m = FORMATO.exec(data)
  if (!m) throw new Error(`Data non valida: "${data}".`)
  return `${m[1]}-H${Number(m[2]) <= 6 ? 1 : 2}`
}

/** `2026-03-09` letta come `09/03/2026`, per le esportazioni e l'interfaccia. */
export function formattaData(data: DataIso | null): string {
  if (!data) return ''
  const m = FORMATO.exec(data)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data
}
