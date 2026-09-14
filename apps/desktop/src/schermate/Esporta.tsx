import { useState } from 'react'
import { useArchivio } from '../stato.js'
import { dentroApplicativo, oggi, ponte } from '../ponte.js'
import { Avviso, Campo, Riquadro } from '../componenti/base.js'
import type { FormatoEsportazione, RichiestaEsportazione } from '../../electron/ponte.js'

type TipoAmbito = RichiestaEsportazione['ambito']['tipo']

const FORMATI: {
  formato: FormatoEsportazione
  titolo: string
  descrizione: string
  ambitiRichiesti?: TipoAmbito[]
}[] = [
  {
    formato: 'json',
    titolo: 'Backup JSON',
    descrizione:
      'Il formato che Mapicy sa rileggere. Se la macchina si rompe o va sostituita, si installa l’applicativo altrove, si carica questo file e si riparte da qui. Con ambito «tutto» è un backup completo; con un ambito ristretto è un estratto e lo dichiara al suo interno.',
  },
  {
    formato: 'excel',
    titolo: 'Excel',
    descrizione:
      'Per chi vuole filtrare e fare i suoi conti. Otto fogli: cruscotto, per piattaforma, asset, registro accessi, estrazioni, controlli, persone, revisioni. Le colonne derivate dal catalogo sono già risolte.',
  },
  {
    formato: 'pdf-registro',
    titolo: 'PDF — registro degli accessi',
    descrizione:
      'Il registro nell’ambito scelto, con gli asset che comprende. È il documento da mandare al DPO per una fotografia complessiva.',
  },
  {
    formato: 'pdf-scheda',
    titolo: 'PDF — scheda di un asset',
    descrizione:
      'Anagrafica dell’asset, dati del fornitore con il suo ruolo privacy, elenco degli accessi e, per ogni accesso attivo, che cosa tratta concretamente quel profilo. Da allegare a un contratto o a una nomina.',
    ambitiRichiesti: ['asset'],
  },
  {
    formato: 'pdf-controlli',
    titolo: 'PDF — esito dei controlli',
    descrizione:
      'I diciassette controlli con i casi elencati uno per uno e il rimedio. Riporta anche quali controlli non sono valutabili per mancanza di estrazioni recenti.',
  },
  {
    formato: 'pdf-verbale',
    titolo: 'PDF — verbale di chiusura campagna',
    descrizione:
      'L’evidenza di aver fatto la revisione: cosa è stato esaminato, cosa è stato confermato, ridotto o revocato, chi l’ha fatto, con lo spazio per le firme.',
    ambitiRichiesti: ['campagna'],
  },
]

export function Esporta() {
  const { documento } = useArchivio()
  const giorno = oggi()
  const [tipo, setTipo] = useState<TipoAmbito>('tutto')
  const [cliente, setCliente] = useState('')
  const [codiceAsset, setCodiceAsset] = useState(documento.asset[0]?.codice ?? '')
  const [campagna, setCampagna] = useState(documento.campagnaCorrente || documento.campagne[0]?.codice || '')
  const [esito, setEsito] = useState<{ tono: 'riuscito' | 'allerta'; testo: string } | null>(null)
  const [inCorso, setInCorso] = useState<FormatoEsportazione | null>(null)

  const clienti = [...new Set(documento.asset.map((a) => a.cliente).filter(Boolean))].sort()

  function ambito(): RichiestaEsportazione['ambito'] {
    if (tipo === 'cliente') return { tipo: 'cliente', cliente }
    if (tipo === 'asset') return { tipo: 'asset', codiceAsset }
    if (tipo === 'campagna') return { tipo: 'campagna', campagna }
    return { tipo: 'tutto' }
  }

  async function esporta(formato: FormatoEsportazione) {
    setEsito(null)
    setInCorso(formato)
    try {
      const risultato = await ponte().esporta({ formato, ambito: ambito(), documento, oggi: giorno })
      setEsito(
        risultato
          ? { tono: 'riuscito', testo: `File salvato: ${risultato.percorso}` }
          : { tono: 'riuscito', testo: 'Esportazione annullata.' },
      )
    } catch (errore) {
      setEsito({ tono: 'allerta', testo: errore instanceof Error ? errore.message : String(errore) })
    } finally {
      setInCorso(null)
    }
  }

  const ambitoValido =
    (tipo === 'tutto') ||
    (tipo === 'cliente' && Boolean(cliente)) ||
    (tipo === 'asset' && Boolean(codiceAsset)) ||
    (tipo === 'campagna' && Boolean(campagna))

  return (
    <>
      {!dentroApplicativo() && (
        <Avviso tono="attenzione" titolo="Anteprima nel browser">
          <p style={{ margin: 0 }}>
            La generazione dei file funziona solo nell’applicativo installato, che ha accesso al disco e al motore
            di stampa. Qui i pulsanti sono visibili per mostrare cosa si può ottenere.
          </p>
        </Avviso>
      )}

      <Riquadro
        titolo="Che cosa esportare"
        didascalia="L’ambito non è un dettaglio: mandare a un cliente un registro che contiene anche gli asset degli altri clienti è una comunicazione di dati personali che nessuno ha chiesto."
      >
        <div className="griglia due">
          <Campo etichetta="Ambito">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAmbito)}>
              <option value="tutto">Tutta la mappatura</option>
              <option value="cliente" disabled={clienti.length === 0}>
                Un solo cliente
              </option>
              <option value="asset" disabled={documento.asset.length === 0}>
                Un solo asset
              </option>
              <option value="campagna" disabled={documento.campagne.length === 0}>
                Una campagna di verifica
              </option>
            </select>
          </Campo>

          {tipo === 'cliente' && (
            <Campo etichetta="Cliente">
              <select value={cliente} onChange={(e) => setCliente(e.target.value)}>
                <option value="">Scegli il cliente</option>
                {clienti.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {tipo === 'asset' && (
            <Campo etichetta="Asset">
              <select value={codiceAsset} onChange={(e) => setCodiceAsset(e.target.value)}>
                {documento.asset.map((a) => (
                  <option key={a.codice} value={a.codice}>
                    {a.codice} — {a.cliente}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {tipo === 'campagna' && (
            <Campo etichetta="Campagna">
              <select value={campagna} onChange={(e) => setCampagna(e.target.value)}>
                {documento.campagne.map((c) => (
                  <option key={c.codice} value={c.codice}>
                    {c.codice}
                    {c.chiusaIl ? ' (chiusa)' : ' (aperta)'}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </Riquadro>

      {esito && (
        <Avviso tono={esito.tono}>
          <p style={{ margin: 0 }}>{esito.testo}</p>
        </Avviso>
      )}

      {FORMATI.map((voce) => {
        const ambitoCompatibile = !voce.ambitiRichiesti || voce.ambitiRichiesti.includes(tipo)
        return (
          <Riquadro
            key={voce.formato}
            titolo={voce.titolo}
            didascalia={voce.descrizione}
            azioni={
              <button
                type="button"
                className="principale"
                disabled={!ambitoValido || !ambitoCompatibile || inCorso !== null}
                onClick={() => void esporta(voce.formato)}
              >
                {inCorso === voce.formato ? 'Generazione…' : 'Genera'}
              </button>
            }
          >
            {!ambitoCompatibile && (
              <p className="aiuto-campo" style={{ margin: 0 }}>
                Per questo documento va scelto l’ambito{' '}
                {voce.ambitiRichiesti!.map((a) => (a === 'asset' ? '«un solo asset»' : '«una campagna»')).join(' o ')}.
              </p>
            )}
          </Riquadro>
        )
      })}

      <Riquadro titolo="Il consiglio sul backup">
        <p style={{ margin: 0 }}>
          Un backup JSON alla fine di ogni campagna, salvato su un disco o in un’area aziendale diversa da questa
          macchina. È l’unico formato che l’applicativo sa rileggere, e contiene dati personali di collaboratori:
          va tenuto in un’area ad accesso limitato come l’archivio stesso.
        </p>
      </Riquadro>
    </>
  )
}
