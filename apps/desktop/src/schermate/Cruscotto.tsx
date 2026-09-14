import {
  apriCampagna,
  avanzamentoCampagna,
  chiudiCampagna,
  cruscotto,
  piattaformeInUso,
  prossimoCodiceCampagna,
  puoChiudereCampagna,
  sintesi,
} from '@mapicy/core'
import { useArchivio, type Sezione } from '../stato.js'
import { oggi } from '../ponte.js'
import { Avviso, Riquadro } from '../componenti/base.js'
import { numero } from '../etichette.js'

export function Cruscotto({ vaiA }: { vaiA: (sezione: Sezione) => void }) {
  const archivio = useArchivio()
  const { documento } = archivio
  const giorno = oggi()
  const stato = cruscotto(documento, giorno)
  const avanzamento = avanzamentoCampagna(documento)
  const chiusura = puoChiudereCampagna(documento, giorno)
  const bloccanti = stato.controlli.filter((c) => c.gravita === 'bloccante' && c.stato === 'da-correggere')

  return (
    <>
      {bloccanti.length > 0 ? (
        <Avviso tono="allerta" titolo="Da risolvere prima di tutto il resto">
          <p>{sintesi(stato, documento.impostazioni.giorniValiditaVerifica)}</p>
          <button type="button" className="principale" onClick={() => vaiA('controlli')}>
            Vai ai controlli
          </button>
        </Avviso>
      ) : (
        // Verde solo quando è davvero tutto a posto: nessuna anomalia, nessun
        // controllo non valutabile, niente da verificare. Un riquadro verde su
        // uno stato incompleto insegna a non leggerlo.
        <Avviso
          tono={
            stato.anomalieAperte === 0 &&
            stato.controlliNonVerificabili === 0 &&
            avanzamento.daVerificare === 0
              ? 'riuscito'
              : 'attenzione'
          }
        >
          <p style={{ margin: 0 }}>{sintesi(stato, documento.impostazioni.giorniValiditaVerifica)}</p>
        </Avviso>
      )}

      <div className="indicatori" style={{ marginBottom: 16 }}>
        <Indicatore valore={stato.assetAttivi} etichetta="Asset attivi censiti" />
        <Indicatore valore={stato.accessiAttivi} etichetta="Accessi attivi" />
        <Indicatore
          valore={stato.accessiRischioAlto}
          etichetta="Accessi a rischio privacy alto"
          tono={stato.accessiRischioAlto > 0 ? 'attenzione' : undefined}
        />
        <Indicatore
          valore={stato.accessiSenzaMfa}
          etichetta="Accessi senza verifica in due passaggi"
          tono={stato.accessiSenzaMfa > 0 ? 'attenzione' : undefined}
        />
        <Indicatore
          valore={stato.anomalieAperte}
          etichetta="Controlli da correggere"
          tono={bloccanti.length > 0 ? 'allerta' : stato.anomalieAperte > 0 ? 'attenzione' : undefined}
        />
        <Indicatore valore={stato.accessiRevocati} etichetta="Accessi revocati in archivio" />
      </div>

      <Riquadro
        titolo="La campagna di verifica"
        didascalia={
          documento.campagnaCorrente
            ? `Campagna ${documento.campagnaCorrente}. La revisione va rifatta ogni quattro-sei mesi, e in più a ogni cessazione, cambio di ruolo o fine di un contratto con un cliente.`
            : 'Una campagna raccoglie le verifiche di un semestre e permette di generare il verbale alla chiusura.'
        }
      >
        {documento.campagnaCorrente ? (
          <>
            <div className="schiera" style={{ justifyContent: 'space-between' }}>
              <span>
                {numero(avanzamento.verificatiInCampagna, 'accesso verificato', 'accessi verificati')} su{' '}
                {avanzamento.verificatiInCampagna + avanzamento.daVerificare}
              </span>
              <strong>{Math.round(avanzamento.quota * 100)}%</strong>
            </div>
            <div className="barra-avanzamento">
              <div style={{ width: `${Math.round(avanzamento.quota * 100)}%` }} />
            </div>

            {chiusura.puoChiudere ? (
              <div className="riga-azioni">
                <Avviso tono="riuscito" titolo="La campagna si può chiudere">
                  <p>
                    Tutti i controlli bloccanti sono risolti e non restano accessi da verificare. Alla chiusura
                    l’applicativo ripianifica la prossima verifica degli asset attivi a sei mesi.
                  </p>
                </Avviso>
              </div>
            ) : (
              <Avviso tono="attenzione" titolo="Cosa manca per chiudere la campagna">
                <ul className="elenco-casi">
                  {chiusura.motivi.map((motivo) => (
                    <li key={motivo}>{motivo}</li>
                  ))}
                </ul>
              </Avviso>
            )}

            <div className="riga-azioni">
              <button type="button" onClick={() => vaiA('registro')}>
                Verifica gli accessi
              </button>
              <button type="button" onClick={() => vaiA('importa')}>
                Importa gli elenchi dalle piattaforme
              </button>
              <button
                type="button"
                className="principale"
                disabled={!chiusura.puoChiudere}
                title={chiusura.puoChiudere ? undefined : chiusura.motivi.join(' ')}
                onClick={() => {
                  const chiDice = archivio.operatore()
                  const note =
                    prompt(
                      'Nota da riportare sul verbale di chiusura (facoltativa):',
                      `Revisione ${documento.campagnaCorrente} chiusa senza anomalie bloccanti.`,
                    ) ?? ''
                  archivio.aggiorna((d) => chiudiCampagna(d, giorno, chiDice, note))
                }}
              >
                Chiudi la campagna
              </button>
            </div>
          </>
        ) : (
          <div className="riga-azioni" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="principale"
              onClick={() =>
                archivio.aggiorna((d) => apriCampagna(d, prossimoCodiceCampagna(giorno, d.campagne), giorno))
              }
            >
              Apri la campagna {prossimoCodiceCampagna(giorno, documento.campagne)}
            </button>
          </div>
        )}
      </Riquadro>

      {stato.assetSenzaEstrazione.length > 0 && (
        <Riquadro
          titolo="Asset da confrontare con la piattaforma"
          didascalia="Per questi asset non c’è un’estrazione abbastanza recente. Finché manca, quattro controlli su diciassette non possono pronunciarsi: l’assenza di problemi non significa che non ce ne siano."
          azioni={
            <button type="button" className="principale" onClick={() => vaiA('importa')}>
              Importa un elenco
            </button>
          }
        >
          <div className="schiera">
            {stato.assetSenzaEstrazione.map((codice) => (
              <span key={codice} className="pastiglia medio">
                {codice}
              </span>
            ))}
          </div>
        </Riquadro>
      )}

      <Riquadro
        titolo="Per piattaforma"
        didascalia="Solo le piattaforme su cui l’agenzia ha davvero degli asset."
      >
        {piattaformeInUso(stato).length === 0 ? (
          <p className="vuoto">Nessun asset censito.</p>
        ) : (
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Piattaforma</th>
                  <th className="num">Asset</th>
                  <th className="num">Accessi</th>
                  <th className="num">Rischio alto</th>
                  <th className="num">Senza MFA</th>
                  <th className="num">Da verificare</th>
                  <th className="num">Non riscontrati</th>
                </tr>
              </thead>
              <tbody>
                {piattaformeInUso(stato).map((riga) => (
                  <tr key={riga.piattaforma}>
                    <td>
                      <strong>{riga.piattaforma}</strong>
                    </td>
                    <td className="num">{riga.assetAttivi}</td>
                    <td className="num">{riga.accessiAttivi}</td>
                    <td className="num">{riga.rischioAlto || ''}</td>
                    <td className="num">{riga.senzaMfa || ''}</td>
                    <td className="num">{riga.daVerificare || ''}</td>
                    <td className="num">{riga.nonRiscontrati || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Riquadro>

      <Riquadro titolo="La revisione in otto passi" didascalia="L’ordine conta: si comincia dalle persone, non dall’inizio dell’elenco.">
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
          <li>Aggiornare le persone: chi è entrato, chi è uscito, chi ha cambiato ruolo.</li>
          <li>Aprire la campagna del semestre.</li>
          <li>Esportare gli elenchi utenti dalle piattaforme e importarli.</li>
          <li>Partire dai controlli bloccanti: persone cessate ancora attive e utenti non censiti.</li>
          <li>Passare agli accessi mai verificati o verificati da oltre {documento.impostazioni.giorniValiditaVerifica} giorni.</li>
          <li>Per ogni riga decidere: confermare, ridurre il profilo, revocare.</li>
          <li>Le revoche si eseguono <strong>prima sulla piattaforma</strong>, poi si registrano qui con la data.</li>
          <li>Chiudere la campagna, generare il verbale e salvare il backup JSON.</li>
        </ol>
      </Riquadro>
    </>
  )
}

function Indicatore({
  valore,
  etichetta,
  tono,
}: {
  valore: number
  etichetta: string
  tono?: 'allerta' | 'attenzione'
}) {
  return (
    <div className={`indicatore${tono ? ` ${tono}` : ''}`}>
      <div className="valore">{valore}</div>
      <div className="etichetta">{etichetta}</div>
    </div>
  )
}
