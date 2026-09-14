import type { ReactNode } from 'react'
import { guidaPer } from '@mapicy/catalogo'
import { formattaData } from '@mapicy/core'

/**
 * Campo di modulo con etichetta e, quando serve, la spiegazione di cosa ci va.
 *
 * Il controllo sta *dentro* l'elemento `label`, non accanto. Così
 * l'associazione fra etichetta e campo esiste davvero, senza dover inventare
 * un identificativo per ogni campo: chi usa un lettore di schermo sente il
 * nome del campo, e cliccare sull'etichetta porta il fuoco nel campo giusto.
 */
export function Campo({
  etichetta,
  aiuto,
  children,
  obbligatorio,
}: {
  etichetta: string
  aiuto?: ReactNode
  children: ReactNode
  obbligatorio?: boolean
}) {
  return (
    <label className="campo">
      <span className="nome-campo">
        {etichetta}
        {obbligatorio && <span style={{ color: 'var(--alto)' }}> *</span>}
      </span>
      {children}
      {aiuto && <span className="aiuto-campo">{aiuto}</span>}
    </label>
  )
}

export function Avviso({
  tono = 'informazione',
  titolo,
  children,
}: {
  tono?: 'informazione' | 'attenzione' | 'allerta' | 'riuscito'
  titolo?: string
  children: ReactNode
}) {
  return (
    <div className={`avviso ${tono}`} role={tono === 'allerta' ? 'alert' : undefined}>
      {titolo && <strong>{titolo}</strong>}
      {children}
    </div>
  )
}

export function Pastiglia({ tipo, children }: { tipo: string; children: ReactNode }) {
  return <span className={`pastiglia ${tipo}`}>{children}</span>
}

export function Riquadro({
  titolo,
  didascalia,
  azioni,
  children,
}: {
  titolo?: string
  didascalia?: ReactNode
  azioni?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="riquadro">
      {(titolo || azioni) && (
        <div className="schiera" style={{ justifyContent: 'space-between', marginBottom: didascalia ? 0 : 12 }}>
          {titolo && <h2>{titolo}</h2>}
          {azioni && <div className="schiera">{azioni}</div>}
        </div>
      )}
      {didascalia && <p className="didascalia">{didascalia}</p>}
      {children}
    </section>
  )
}

export function Modale({
  titolo,
  didascalia,
  larga,
  chiudi,
  children,
}: {
  titolo: string
  didascalia?: ReactNode
  larga?: boolean
  chiudi: () => void
  children: ReactNode
}) {
  return (
    <div
      className="velo"
      role="dialog"
      aria-modal="true"
      aria-label={titolo}
      onClick={(e) => {
        if (e.target === e.currentTarget) chiudi()
      }}
    >
      <div className={`modale${larga ? ' larga' : ''}`}>
        <h2>{titolo}</h2>
        {didascalia && <p className="didascalia">{didascalia}</p>}
        {children}
      </div>
    </div>
  )
}

export function Vuoto({ children }: { children: ReactNode }) {
  return <p className="vuoto">{children}</p>
}

/**
 * La guida di reperimento di un asset: dove trovare l'identificativo e dove
 * trovare l'elenco utenti sulla piattaforma. È il pezzo che risponde alla
 * domanda «e adesso dove vado a prendere questo dato?», e per questo sta
 * accanto ai campi e non in un manuale a parte.
 */
export function GuidaReperimento({
  piattaforma,
  tipoAsset,
  mostraIdentificativo = true,
  mostraUtenti = true,
}: {
  piattaforma: string
  tipoAsset: string
  mostraIdentificativo?: boolean
  mostraUtenti?: boolean
}) {
  if (!piattaforma || !tipoAsset) {
    return (
      <div className="guida">
        <h3>Dove trovare queste informazioni</h3>
        <p className="vuoto" style={{ margin: 0 }}>
          Scelta la piattaforma e il tipo di asset, qui comparirà il percorso esatto da seguire: dove trovare
          l’identificativo dell’asset e dove trovare l’elenco delle persone che hanno accesso.
        </p>
      </div>
    )
  }

  const guida = guidaPer(piattaforma, tipoAsset)
  if (!guida) {
    return (
      <div className="guida">
        <p className="vuoto" style={{ margin: 0 }}>
          Per {piattaforma} / {tipoAsset} non c’è ancora una guida di reperimento nel catalogo.
        </p>
      </div>
    )
  }
  return (
    <div className="guida">
      <h3>Dove trovare queste informazioni</h3>
      <dl>
        {mostraIdentificativo && (
          <>
            <dt>{guida.identificativo.nome}</dt>
            <dd>
              {guida.identificativo.percorso}
              <br />
              Formato: {guida.identificativo.formato} — per esempio <code>{guida.identificativo.esempio}</code>
            </dd>
          </>
        )}
        {mostraUtenti && (
          <>
            <dt>
              Elenco delle persone con accesso{' '}
              <Pastiglia tipo={guida.utenti.esportazione === 'csv' ? 'basso' : 'neutra'}>
                {guida.utenti.esportazione === 'csv' ? 'esporta in CSV' : 'da copiare a mano'}
              </Pastiglia>
            </dt>
            <dd>{guida.utenti.percorso}</dd>
            <dt>Da tenere presente</dt>
            <dd>{guida.utenti.note}</dd>
          </>
        )}
      </dl>
      {!guida.verificato && (
        <p className="aiuto-campo" style={{ marginTop: 12 }}>
          Questo percorso è ricostruito dalla documentazione pubblica del fornitore e non è stato verificato
          sull’interfaccia attuale: i menu cambiano senza preavviso. Se non corrisponde, il percorso giusto va
          corretto nel catalogo.
        </p>
      )}
    </div>
  )
}

export function DataBreve({ valore }: { valore: string | null }) {
  return valore ? <>{formattaData(valore)}</> : <span className="vuoto">—</span>
}

/** Legge una data ISO da un campo `<input type="date">`, restituendo `null` sul vuoto. */
export function valoreData(v: string): string | null {
  return v ? v : null
}
