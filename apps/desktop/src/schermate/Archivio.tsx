import { useEffect, useState } from 'react'
import { avvertenzaGuide, catalogoAggiornatoIl, guideDaVerificare } from '@mapicy/catalogo'
import { formattaData, verificaDocumento } from '@mapicy/core'
import { useArchivio } from '../stato.js'
import { dentroApplicativo, ponte } from '../ponte.js'
import { Avviso, Campo, Riquadro } from '../componenti/base.js'
import type { CopiaDiSicurezza } from '../ponte.js'
import { numero } from '../etichette.js'

export function Archivio() {
  const archivio = useArchivio()
  const { documento, info, impostazioni, identita } = archivio
  const [copie, setCopie] = useState<CopiaDiSicurezza[]>([])
  const [messaggio, setMessaggio] = useState<{ tono: 'riuscito' | 'allerta'; testo: string } | null>(null)
  const [bozzaImpostazioni, setBozzaImpostazioni] = useState(impostazioni)

  useEffect(() => setBozzaImpostazioni(impostazioni), [impostazioni])
  useEffect(() => {
    void ponte().copieDiSicurezza().then(setCopie).catch(() => setCopie([]))
  }, [documento])

  const problemi = verificaDocumento(documento)
  const daVerificare = guideDaVerificare()

  async function esegui(azione: () => Promise<unknown>, riuscito: string) {
    setMessaggio(null)
    try {
      await azione()
      setMessaggio({ tono: 'riuscito', testo: riuscito })
      await archivio.ricaricaInfo()
    } catch (errore) {
      setMessaggio({ tono: 'allerta', testo: errore instanceof Error ? errore.message : String(errore) })
    }
  }

  return (
    <>
      {messaggio && (
        <Avviso tono={messaggio.tono}>
          <p style={{ margin: 0 }}>{messaggio.testo}</p>
        </Avviso>
      )}

      {problemi.length > 0 && (
        <Avviso tono="attenzione" titolo="Incoerenze nell’archivio">
          <ul className="elenco-casi">
            {problemi.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Avviso>
      )}

      <Riquadro
        titolo="Dov’è l’archivio"
        didascalia="Un unico file JSON. È il file di lavoro e, allo stesso tempo, quello che si salva come backup: sono la stessa cosa, di proposito."
        azioni={
          <button type="button" disabled={!dentroApplicativo()} onClick={() => void ponte().mostraArchivioNelSistema()}>
            Mostra nel sistema
          </button>
        }
      >
        <dl className="guida" style={{ border: 'none', padding: 0, background: 'transparent' }}>
          <dt>Percorso</dt>
          <dd className="mono">{info?.percorso ?? '—'}</dd>
          <dt>Ultimo salvataggio</dt>
          <dd>{info?.salvatoIl ? new Date(info.salvatoIl).toLocaleString('it-IT') : 'mai'}</dd>
          <dt>Dimensione</dt>
          <dd>{info ? `${(info.dimensione / 1024).toFixed(1)} kB` : '—'}</dd>
          <dt>Contenuto</dt>
          <dd>
            {numero(documento.asset.length, 'asset', 'asset')}, {numero(documento.accessi.length, 'accesso', 'accessi')},{' '}
            {numero(documento.persone.length, 'persona', 'persone')},{' '}
            {numero(documento.estrazioni.length, 'riga di estrazione', 'righe di estrazione')}
          </dd>
        </dl>
        <Avviso tono="informazione" titolo="Contiene dati personali">
          <p style={{ margin: 0 }}>
            L’archivio contiene nomi e indirizzi di collaboratori e informazioni sui clienti. Va tenuto su una
            macchina con il disco cifrato e un account protetto, e i backup in un’area ad accesso limitato.
          </p>
        </Avviso>
      </Riquadro>

      <Riquadro
        titolo={`Copie di sicurezza (${copie.length})`}
        didascalia="A ogni salvataggio che cambia qualcosa, la versione precedente viene conservata. Ne restano le venti più recenti: è la risposta a «ho sbagliato e ho già salvato»."
        azioni={
          <>
            <button
              type="button"
              disabled={!dentroApplicativo()}
              onClick={() =>
                void esegui(async () => {
                  const aperto = await ponte().scegliArchivio()
                  if (aperto) archivio.sostituisci(aperto.documento)
                }, 'Archivio aperto.')
              }
            >
              Apri un altro archivio
            </button>
            <button
              type="button"
              disabled={!dentroApplicativo()}
              onClick={() =>
                void esegui(async () => {
                  const aperto = await ponte().ripristinaDaBackup()
                  if (aperto) archivio.sostituisci(aperto.documento)
                }, 'Backup caricato: è diventato l’archivio di lavoro.')
              }
            >
              Ripristina da un backup JSON
            </button>
          </>
        }
      >
        {copie.length === 0 ? (
          <p className="vuoto">
            {dentroApplicativo()
              ? 'Nessuna copia ancora: la prima nasce al secondo salvataggio che cambia qualcosa.'
              : 'Le copie di sicurezza esistono solo nell’applicativo installato.'}
          </p>
        ) : (
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Salvata il</th>
                  <th className="num">Dimensione</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {copie.map((copia) => (
                  <tr key={copia.nome}>
                    <td>{new Date(copia.salvataIl).toLocaleString('it-IT')}</td>
                    <td className="num">{(copia.dimensione / 1024).toFixed(1)} kB</td>
                    <td>
                      <button
                        type="button"
                        className="piccolo"
                        onClick={() => {
                          if (
                            !confirm(
                              'Ripristinare questa copia? L’archivio attuale verrà a sua volta conservato fra le copie, quindi l’operazione è reversibile.',
                            )
                          )
                            return
                          void esegui(async () => {
                            const aperto = await ponte().ripristinaCopia(copia.nome)
                            archivio.sostituisci(aperto.documento)
                          }, 'Copia ripristinata.')
                        }}
                      >
                        Ripristina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Riquadro>

      <Riquadro
        titolo="Chi sta lavorando"
        didascalia="Il nome con cui vengono firmate le verifiche nel registro. Su un applicativo locale l’accesso non è una barriera di sicurezza — la barriera è l’account del sistema operativo — ma serve che il registro porti un’identità vera invece di un nome digitato a mano."
      >
        <p>
          Adesso:{' '}
          <strong>
            {identita.origine === 'google'
              ? `${identita.nome} (${identita.email})`
              : impostazioni.nomeLocale || 'nessun nome impostato'}
          </strong>
          {identita.origine === 'google' && ' — accesso con Google Workspace'}
        </p>
        <div className="riga-azioni" style={{ marginTop: 6 }}>
          <button
            type="button"
            disabled={!dentroApplicativo() || !impostazioni.clientIdGoogle}
            title={impostazioni.clientIdGoogle ? undefined : 'Va prima configurato l’ID client OAuth qui sotto.'}
            onClick={() =>
              void esegui(async () => {
                await ponte().accediConGoogle()
                await archivio.ricaricaIdentita()
              }, 'Accesso effettuato.')
            }
          >
            Accedi con Google Workspace
          </button>
          {identita.origine === 'google' && (
            <button
              type="button"
              onClick={() =>
                void esegui(async () => {
                  await ponte().esci()
                  await archivio.ricaricaIdentita()
                }, 'Uscita effettuata.')
              }
            >
              Esci
            </button>
          )}
        </div>
      </Riquadro>

      <Riquadro
        titolo="Impostazioni"
        didascalia="Restano su questa macchina e non finiscono nell’archivio, perché l’archivio viene esportato."
      >
        <div className="griglia due">
          <Campo
            etichetta="Nome per il profilo locale"
            aiuto="Usato per firmare le verifiche quando non si accede con Google."
          >
            <input
              value={bozzaImpostazioni.nomeLocale}
              onChange={(e) => setBozzaImpostazioni((i) => ({ ...i, nomeLocale: e.target.value }))}
            />
          </Campo>
          <Campo
            etichetta="Dominio Google Workspace ammesso"
            aiuto="Solo gli account di questo dominio potranno accedere. Lasciare vuoto per non porre vincoli."
          >
            <input
              value={bozzaImpostazioni.dominioAmmesso}
              placeholder="agenzia.it"
              onChange={(e) => setBozzaImpostazioni((i) => ({ ...i, dominioAmmesso: e.target.value.trim() }))}
            />
          </Campo>
        </div>
        <div style={{ marginTop: 14 }}>
          <Campo
            etichetta="ID client OAuth di Google"
            aiuto="Da creare una volta su Google Cloud, credenziali di tipo «Applicazione desktop». Serve solo per l’accesso con Google Workspace: senza, l’applicativo funziona con il profilo locale."
          >
            <input
              className="mono"
              value={bozzaImpostazioni.clientIdGoogle}
              placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com"
              onChange={(e) => setBozzaImpostazioni((i) => ({ ...i, clientIdGoogle: e.target.value.trim() }))}
            />
          </Campo>
        </div>
        <div className="riga-azioni">
          <button
            type="button"
            className="principale"
            onClick={() => void esegui(() => archivio.aggiornaImpostazioni(bozzaImpostazioni), 'Impostazioni salvate.')}
          >
            Salva le impostazioni
          </button>
        </div>
      </Riquadro>

      <Riquadro
        titolo="Soglie dei controlli"
        didascalia="Queste stanno nell’archivio, perché sono una scelta dell’agenzia e vanno con la mappatura."
      >
        <div className="griglia due">
          <Campo
            etichetta="Validità di una verifica (giorni)"
            aiuto="Oltre questa soglia un accesso verificato torna «da verificare». Il template di partenza usava 180 giorni, cioè sei mesi."
          >
            <input
              type="number"
              min={30}
              max={730}
              value={documento.impostazioni.giorniValiditaVerifica}
              onChange={(e) =>
                archivio.aggiorna((d) => ({
                  ...d,
                  impostazioni: { ...d.impostazioni, giorniValiditaVerifica: Number(e.target.value) || 180 },
                }))
              }
            />
          </Campo>
          <Campo
            etichetta="Validità di un’estrazione (giorni)"
            aiuto="Oltre questa soglia un’estrazione è troppo vecchia per riconciliare, e i quattro controlli che dipendono da essa tornano non valutabili."
          >
            <input
              type="number"
              min={30}
              max={730}
              value={documento.impostazioni.giorniValiditaEstrazione}
              onChange={(e) =>
                archivio.aggiorna((d) => ({
                  ...d,
                  impostazioni: { ...d.impostazioni, giorniValiditaEstrazione: Number(e.target.value) || 180 },
                }))
              }
            />
          </Campo>
        </div>
      </Riquadro>

      <Riquadro
        titolo="Il catalogo delle piattaforme"
        didascalia={`Aggiornato al ${formattaData(catalogoAggiornatoIl)}. Contiene i profili autorizzativi delle piattaforme, cosa tratta ciascuno e dove trovare le informazioni.`}
      >
        <p>{avvertenzaGuide}</p>
        <p style={{ margin: 0 }}>
          Guide di reperimento ancora da confermare sull’interfaccia attuale dei fornitori:{' '}
          <strong>{daVerificare.length}</strong> su 28. Sono segnalate come tali dentro le schermate, e i menu
          delle piattaforme cambiano senza preavviso: quando un percorso non corrisponde, va corretto nel
          catalogo.
        </p>
      </Riquadro>

      <Riquadro titolo="I dati dell’agenzia" didascalia="Compaiono in testa a tutti i documenti esportati.">
        <div className="griglia due">
          <Campo etichetta="Nome dell’agenzia">
            <input
              value={documento.agenzia.nome}
              onChange={(e) =>
                archivio.aggiorna((d) => ({ ...d, agenzia: { ...d.agenzia, nome: e.target.value } }))
              }
            />
          </Campo>
          <Campo etichetta="Referente privacy interno">
            <input
              value={documento.agenzia.referentePrivacy}
              onChange={(e) =>
                archivio.aggiorna((d) => ({ ...d, agenzia: { ...d.agenzia, referentePrivacy: e.target.value } }))
              }
            />
          </Campo>
          <Campo etichetta="DPO" aiuto="Se l’agenzia ne ha uno, interno o esterno. Lasciare vuoto se non è nominato.">
            <input
              value={documento.agenzia.dpo}
              onChange={(e) => archivio.aggiorna((d) => ({ ...d, agenzia: { ...d.agenzia, dpo: e.target.value } }))}
            />
          </Campo>
          <Campo etichetta="Indirizzo di contatto privacy">
            <input
              type="email"
              value={documento.agenzia.emailContatto}
              onChange={(e) =>
                archivio.aggiorna((d) => ({ ...d, agenzia: { ...d.agenzia, emailContatto: e.target.value } }))
              }
            />
          </Campo>
        </div>
      </Riquadro>
    </>
  )
}
