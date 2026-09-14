import { eseguiControlli } from '@mapicy/core'
import { useArchivio, type Sezione } from '../stato.js'
import { oggi } from '../ponte.js'
import { Avviso, Pastiglia, Riquadro } from '../componenti/base.js'
import { CLASSE_CONTROLLO, GRAVITA, STATO_CONTROLLO, numero } from '../etichette.js'

const ORDINE = { 'da-correggere': 0, 'non-verificabile': 1, informativo: 2, ok: 3 } as const

export function Controlli({ vaiA }: { vaiA: (sezione: Sezione) => void }) {
  const { documento } = useArchivio()
  const esiti = eseguiControlli(documento, oggi())
  const ordinati = [...esiti].sort(
    (a, b) => ORDINE[a.stato] - ORDINE[b.stato] || a.codice.localeCompare(b.codice),
  )
  const daCorreggere = esiti.filter((e) => e.stato === 'da-correggere')
  const nonVerificabili = esiti.filter((e) => e.stato === 'non-verificabile')

  return (
    <>
      {daCorreggere.length === 0 ? (
        <Avviso tono="riuscito" titolo="Nessun controllo da correggere">
          <p style={{ margin: 0 }}>
            {nonVerificabili.length > 0
              ? `Restano però ${numero(nonVerificabili.length, 'controllo che non si può valutare', 'controlli che non si possono valutare')}: mancano estrazioni recenti.`
              : 'Tutti i diciassette controlli sono a posto.'}
          </p>
        </Avviso>
      ) : (
        <Avviso tono="attenzione" titolo={`${numero(daCorreggere.length, 'controllo da correggere', 'controlli da correggere')}`}>
          <p style={{ margin: 0 }}>
            I casi sono elencati uno per uno sotto ogni controllo, con la persona e l’asset. Si comincia dai
            bloccanti: una campagna non si può chiudere finché ce n’è uno aperto.
          </p>
        </Avviso>
      )}

      {nonVerificabili.length > 0 && (
        <Avviso tono="informazione" titolo="Quattro controlli dipendono dalle estrazioni">
          <p>
            I controlli C02, C03, C04 e C05 confrontano il registro con l’elenco utenti che la piattaforma
            dichiara davvero. Senza un’estrazione recente non risultano «a posto»: risultano non valutabili, che
            è un’altra cosa.
          </p>
          <button type="button" onClick={() => vaiA('importa')}>
            Importa gli elenchi
          </button>
        </Avviso>
      )}

      {ordinati.map((esito) => (
        <Riquadro
          key={esito.codice}
          titolo={`${esito.codice} — ${esito.titolo}`}
          azioni={
            <>
              <Pastiglia tipo={esito.gravita}>{GRAVITA[esito.gravita]}</Pastiglia>
              <Pastiglia tipo={CLASSE_CONTROLLO[esito.stato]}>{STATO_CONTROLLO[esito.stato]}</Pastiglia>
            </>
          }
        >
          {esito.casi.length > 0 ? (
            <>
              <p className="didascalia" style={{ marginBottom: 6 }}>
                {numero(esito.casi.length, 'caso', 'casi')}:
              </p>
              <ul className="elenco-casi">
                {esito.casi.map((caso) => (
                  <li key={`${caso.tipo}-${caso.id}-${caso.descrizione}`}>{caso.descrizione}</li>
                ))}
              </ul>
              <Avviso tono="informazione" titolo="Come correggere">
                <p style={{ margin: 0 }}>{esito.comeCorreggere}</p>
              </Avviso>
            </>
          ) : esito.stato === 'non-verificabile' ? (
            <p className="didascalia" style={{ margin: 0 }}>
              Non valutabile: manca un’estrazione recente per {esito.assetNonCoperti.join(', ')}. Questo controllo
              non sta dicendo che va tutto bene, sta dicendo che non ha potuto guardare.
            </p>
          ) : (
            <p className="didascalia" style={{ margin: 0 }}>
              Nessun caso.
            </p>
          )}
        </Riquadro>
      ))}
    </>
  )
}
