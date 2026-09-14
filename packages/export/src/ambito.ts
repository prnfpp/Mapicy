import type { Documento } from '@mapicy/core'

/**
 * Che cosa esportare. L'amministrazione esporta tutto per il backup, un
 * singolo cliente per mandarlo al cliente, un singolo asset per allegarlo a un
 * contratto, una campagna per il verbale. Sono quattro esigenze diverse e la
 * differenza non è cosmetica: mandare al cliente Rossi il registro che
 * contiene anche gli asset di Bianchi è una comunicazione di dati personali
 * che nessuno ha chiesto.
 */
export type Ambito =
  | { tipo: 'tutto' }
  | { tipo: 'cliente'; cliente: string }
  | { tipo: 'asset'; codiceAsset: string }
  | { tipo: 'campagna'; campagna: string }

export function descriviAmbito(ambito: Ambito): string {
  switch (ambito.tipo) {
    case 'tutto':
      return 'Mappatura completa'
    case 'cliente':
      return `Cliente: ${ambito.cliente}`
    case 'asset':
      return `Asset: ${ambito.codiceAsset}`
    case 'campagna':
      return `Campagna di verifica: ${ambito.campagna}`
  }
}

/**
 * Riduce il documento all'ambito richiesto. Le persone non vengono filtrate
 * via del tutto: si tengono quelle che compaiono negli accessi rimasti, perché
 * un registro che rimanda a persone assenti dall'anagrafica non si legge.
 */
export function filtra(documento: Documento, ambito: Ambito): Documento {
  if (ambito.tipo === 'tutto') return documento

  const asset = documento.asset.filter((a) => {
    if (ambito.tipo === 'cliente') return a.cliente === ambito.cliente
    if (ambito.tipo === 'asset') return a.codice === ambito.codiceAsset
    return true
  })
  const codici = new Set(asset.map((a) => a.codice))

  let accessi = documento.accessi.filter((a) => codici.has(a.codiceAsset))
  if (ambito.tipo === 'campagna') {
    accessi = accessi.filter((a) => a.campagnaVerifica === ambito.campagna)
  }

  const personeUsate = new Set(accessi.map((a) => a.personaId))
  const revisioni = documento.revisioni.filter((r) =>
    ambito.tipo === 'campagna' ? r.campagna === ambito.campagna : codici.has(r.codiceAsset),
  )

  return {
    ...documento,
    asset,
    accessi,
    estrazioni: documento.estrazioni.filter((e) => codici.has(e.codiceAsset)),
    persone: documento.persone.filter((p) => personeUsate.has(p.id)),
    revisioni,
    campagne:
      ambito.tipo === 'campagna'
        ? documento.campagne.filter((c) => c.codice === ambito.campagna)
        : documento.campagne,
  }
}

/** Gli ambiti proponibili: i clienti che esistono, gli asset che esistono, le campagne aperte e chiuse. */
export function ambitiDisponibili(documento: Documento): Ambito[] {
  const clienti = [...new Set(documento.asset.map((a) => a.cliente).filter(Boolean))].sort()
  return [
    { tipo: 'tutto' },
    ...clienti.map((cliente): Ambito => ({ tipo: 'cliente', cliente })),
    ...documento.asset.map((a): Ambito => ({ tipo: 'asset', codiceAsset: a.codice })),
    ...documento.campagne.map((c): Ambito => ({ tipo: 'campagna', campagna: c.codice })),
  ]
}
