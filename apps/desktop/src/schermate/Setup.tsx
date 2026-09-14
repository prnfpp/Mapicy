import { useState } from 'react'
import { catalogoAggiornatoIl, guidaPer } from '@mapicy/catalogo'
import { apriCampagna, formattaData, prossimoCodiceCampagna, type Asset, type Persona } from '@mapicy/core'
import { useArchivio } from '../stato.js'
import { oggi } from '../ponte.js'
import { Avviso, Campo, Pastiglia, Riquadro } from '../componenti/base.js'
import { numero } from '../etichette.js'
import { IncollaPersone, ModificaPersona, personaVuota } from './Persone.js'
import { ModificaAsset, assetVuoto } from './Asset.js'

/**
 * Il primo avvio. Cinque passi, ognuno con il perché e con l'indicazione di
 * dove andare a prendere il dato.
 *
 * Due scelte deliberate. Si può interrompere e riprendere: `setup.passoRaggiunto`
 * è nel documento, e l'archivio viene salvato a ogni modifica. E nessun passo è
 * obbligatorio tranne il primo: chi è a metà censimento deve poter entrare
 * nell'applicativo e continuare da dentro, invece di restare bloccato in una
 * procedura che non finisce in una sola sessione.
 */

const PASSI = ['L’agenzia', 'Le persone', 'Gli asset', 'Gli accessi', 'Si parte'] as const

export function Setup() {
  const archivio = useArchivio()
  const { documento } = archivio
  const [passo, setPasso] = useState(documento.setup.passoRaggiunto)

  const vai = (prossimo: number) => {
    setPasso(prossimo)
    archivio.aggiorna((d) => ({
      ...d,
      setup: { ...d.setup, passoRaggiunto: Math.max(d.setup.passoRaggiunto, prossimo) },
    }))
  }

  return (
    <div className="area" style={{ height: '100%' }}>
      <div className="contenuto" style={{ maxWidth: 940, margin: '0 auto', paddingTop: 34 }}>
        <h1 style={{ marginBottom: 4 }}>Mapicy — configurazione iniziale</h1>
        <p className="sottotesta" style={{ marginBottom: 22 }}>
          Cinque passi. Si può interrompere in qualunque momento e riprendere da dove si era: quello che si
          inserisce viene salvato subito.
        </p>

        <div className="passi">
          {PASSI.map((nome, indice) => (
            <button
              key={nome}
              type="button"
              className={`passo${indice === passo ? ' corrente' : indice < passo ? ' fatto' : ''}`}
              onClick={() => indice <= documento.setup.passoRaggiunto && setPasso(indice)}
              disabled={indice > documento.setup.passoRaggiunto}
            >
              <span className="numero">{indice + 1}</span>
              {nome}
            </button>
          ))}
        </div>

        {passo === 0 && <PassoAgenzia avanti={() => vai(1)} />}
        {passo === 1 && <PassoPersone indietro={() => setPasso(0)} avanti={() => vai(2)} />}
        {passo === 2 && <PassoAsset indietro={() => setPasso(1)} avanti={() => vai(3)} />}
        {passo === 3 && <PassoAccessi indietro={() => setPasso(2)} avanti={() => vai(4)} />}
        {passo === 4 && <PassoFine indietro={() => setPasso(3)} />}
      </div>
    </div>
  )
}

function Navigazione({
  indietro,
  avanti,
  etichettaAvanti = 'Avanti',
  puoAvanzare = true,
  motivo,
}: {
  indietro?: () => void
  avanti: () => void
  etichettaAvanti?: string
  puoAvanzare?: boolean
  motivo?: string
}) {
  return (
    <div className="riga-azioni fine">
      {indietro && (
        <button type="button" onClick={indietro}>
          Indietro
        </button>
      )}
      <button type="button" className="principale" onClick={avanti} disabled={!puoAvanzare} title={motivo}>
        {etichettaAvanti}
      </button>
    </div>
  )
}

function PassoAgenzia({ avanti }: { avanti: () => void }) {
  const archivio = useArchivio()
  const { agenzia } = archivio.documento
  const modifica = (campo: keyof typeof agenzia, valore: string) =>
    archivio.aggiorna((d) => ({ ...d, agenzia: { ...d.agenzia, [campo]: valore } }))

  return (
    <>
      <Riquadro
        titolo="Che cosa fa questo applicativo"
        didascalia="Vale leggerlo una volta: spiega a cosa servirà quello che si sta per inserire."
      >
        <p>
          Tiene l’elenco di <strong>chi accede a cosa</strong>: per ogni cliente, per ogni sua proprietà digitale
          — la Pagina Facebook, l’account Google Ads, il sito — quali persone dell’agenzia hanno accesso e con
          quale profilo. Ogni quattro-sei mesi si controlla che l’elenco sia ancora vero e si toglie l’accesso a
          chi non serve più.
        </p>
        <p>Tre cose le fa da sé, e sono la ragione per cui non è un foglio di calcolo:</p>
        <ul style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            <strong>Compila la parte difficile.</strong> Scelto l’asset e il profilo autorizzativo, la tipologia
            di dati trattati, le attività e il livello di rischio arrivano dal catalogo: 121 profili su 14
            piattaforme, già scritti.
          </li>
          <li>
            <strong>Confronta il registro con la realtà.</strong> Si carica l’elenco utenti esportato dalla
            piattaforma e il confronto è automatico: trova chi ha accesso senza essere autorizzato e chi risulta
            revocato ma è ancora dentro.
          </li>
          <li>
            <strong>Dice dove andare a prendere i dati.</strong> Per ognuno dei 28 tipi di asset c’è il percorso
            nei menu della piattaforma.
          </li>
        </ul>
        <p className="aiuto-campo" style={{ margin: 0 }}>
          Catalogo dei profili aggiornato al {formattaData(catalogoAggiornatoIl)}.
        </p>
      </Riquadro>

      <Riquadro
        titolo="I dati dell’agenzia"
        didascalia="Compaiono in testa a ogni documento esportato, compresi quelli che andranno al DPO."
      >
        <div className="griglia due">
          <Campo etichetta="Nome dell’agenzia" obbligatorio>
            <input value={agenzia.nome} onChange={(e) => modifica('nome', e.target.value)} autoFocus />
          </Campo>
          <Campo
            etichetta="Referente privacy interno"
            aiuto="Chi in agenzia si occupa di questa mappatura. Di solito è l’amministrazione."
          >
            <input
              value={agenzia.referentePrivacy}
              onChange={(e) => modifica('referentePrivacy', e.target.value)}
            />
          </Campo>
          <Campo
            etichetta="DPO"
            aiuto="Il responsabile della protezione dei dati, se l’agenzia lo ha nominato. Non tutte le agenzie ne hanno l’obbligo: se non c’è, lasciare vuoto."
          >
            <input value={agenzia.dpo} onChange={(e) => modifica('dpo', e.target.value)} />
          </Campo>
          <Campo etichetta="Indirizzo di contatto privacy">
            <input
              type="email"
              value={agenzia.emailContatto}
              onChange={(e) => modifica('emailContatto', e.target.value)}
            />
          </Campo>
        </div>
      </Riquadro>

      <Navigazione
        avanti={avanti}
        puoAvanzare={Boolean(agenzia.nome.trim())}
        motivo={agenzia.nome.trim() ? undefined : 'Serve almeno il nome dell’agenzia.'}
      />
    </>
  )
}

function PassoPersone({ indietro, avanti }: { indietro: () => void; avanti: () => void }) {
  const archivio = useArchivio()
  const { persone } = archivio.documento
  const [incollaggio, setIncollaggio] = useState(false)
  const [inModifica, setInModifica] = useState<Persona | null>(null)

  return (
    <>
      <Riquadro
        titolo="Chi lavora in agenzia"
        didascalia="Serve prima degli asset, perché è da qui che nasce il controllo più importante: la persona uscita che ha ancora accesso alle proprietà di un cliente."
        azioni={
          <>
            <button type="button" className="principale" onClick={() => setIncollaggio(true)}>
              Incolla un elenco
            </button>
            <button type="button" onClick={() => setInModifica(personaVuota())}>
              Aggiungi una per volta
            </button>
          </>
        }
      >
        <Avviso tono="informazione" titolo="Il modo rapido">
          <p style={{ margin: 0 }}>
            L’anagrafica esiste già in un foglio di calcolo o nel gestionale: si copia e si incolla. Le colonne
            attese sono nome, rapporto di lavoro, ruolo, indirizzo e-mail, in quest’ordine — ma l’indirizzo viene
            riconosciuto in qualunque colonna si trovi.
          </p>
        </Avviso>

        <p className="aiuto-campo">
          L’<strong>indirizzo con cui la persona accede</strong> è il campo che conta più del ruolo: è la chiave
          con cui il confronto con le piattaforme la riconosce. Se manca, quella persona risulterà «non censita»
          al primo import.
        </p>

        {persone.length === 0 ? (
          <p className="vuoto">Nessuna persona inserita.</p>
        ) : (
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Rapporto</th>
                  <th>Ruolo</th>
                  <th>Account</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {persone.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nome}</strong>
                    </td>
                    <td>{p.rapportoLavoro || <span className="vuoto">—</span>}</td>
                    <td>{p.ruoloAziendale || <span className="vuoto">—</span>}</td>
                    <td className="mono">
                      {p.email || <Pastiglia tipo="medio">manca</Pastiglia>}
                    </td>
                    <td>
                      <button type="button" className="piatto piccolo" onClick={() => setInModifica(p)}>
                        Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Riquadro>

      {incollaggio && (
        <IncollaPersone
          chiudi={() => setIncollaggio(false)}
          conferma={(nuove) => {
            archivio.aggiorna((d) => ({ ...d, persone: [...d.persone, ...nuove] }))
            setIncollaggio(false)
          }}
        />
      )}
      {inModifica && (
        <ModificaPersona
          persona={inModifica}
          chiudi={() => setInModifica(null)}
          salva={(persona) => {
            archivio.aggiorna((d) => ({
              ...d,
              persone: d.persone.some((p) => p.id === persona.id)
                ? d.persone.map((p) => (p.id === persona.id ? persona : p))
                : [...d.persone, persona],
            }))
            setInModifica(null)
          }}
        />
      )}

      <Navigazione
        indietro={indietro}
        avanti={avanti}
        etichettaAvanti={persone.length === 0 ? 'Salta per ora' : 'Avanti'}
      />
    </>
  )
}

function PassoAsset({ indietro, avanti }: { indietro: () => void; avanti: () => void }) {
  const archivio = useArchivio()
  const { asset } = archivio.documento
  const [inModifica, setInModifica] = useState<Asset | null>(null)

  return (
    <>
      <Riquadro
        titolo="Le proprietà digitali dei clienti"
        didascalia="Una per ogni asset di ogni cliente. Conviene partire dai clienti più grossi e dalle piattaforme dove ci sono più persone: sono quelle dove si trovano i problemi."
        azioni={
          <button type="button" className="principale" onClick={() => setInModifica(assetVuoto())}>
            Aggiungi un asset
          </button>
        }
      >
        <Avviso tono="informazione" titolo="Il codice asset">
          <p style={{ margin: 0 }}>
            L’applicativo lo propone da sé a partire dal cliente e dal tipo di asset — per esempio{' '}
            <span className="mono">ROSSISRL-META-FB</span>. È la chiave che tiene insieme registro, estrazioni e
            schede: si può correggere adesso, ma dopo il primo accesso censito non si cambia più.
          </p>
        </Avviso>

        <p className="aiuto-campo">
          Nella schermata di inserimento, accanto ai campi, compare la guida della piattaforma scelta: dove
          trovare l’identificativo dell’asset e dove trovare l’elenco delle persone con accesso. Sono 28 tipi di
          asset, ognuno con il suo percorso.
        </p>

        {asset.length === 0 ? (
          <p className="vuoto">Nessun asset censito.</p>
        ) : (
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Cliente</th>
                  <th>Piattaforma</th>
                  <th>Tipo</th>
                  <th>Nome</th>
                  <th>Elenco utenti</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {asset.map((a) => {
                  const guida = guidaPer(a.piattaforma, a.tipoAsset)
                  return (
                    <tr key={a.id}>
                      <td className="mono">
                        <strong>{a.codice}</strong>
                      </td>
                      <td>{a.cliente}</td>
                      <td>{a.piattaforma}</td>
                      <td>{a.tipoAsset}</td>
                      <td>{a.nome}</td>
                      <td>
                        {guida && (
                          <Pastiglia tipo={guida.utenti.esportazione === 'csv' ? 'basso' : 'neutra'}>
                            {guida.utenti.esportazione === 'csv' ? 'esporta in CSV' : 'da copiare'}
                          </Pastiglia>
                        )}
                      </td>
                      <td>
                        <button type="button" className="piatto piccolo" onClick={() => setInModifica(a)}>
                          Modifica
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Riquadro>

      {inModifica && (
        <ModificaAsset
          asset={inModifica}
          chiudi={() => setInModifica(null)}
          salva={(nuovo) => {
            archivio.aggiorna((d) => ({
              ...d,
              asset: d.asset.some((a) => a.id === nuovo.id)
                ? d.asset.map((a) => (a.id === nuovo.id ? nuovo : a))
                : [...d.asset, nuovo],
            }))
            setInModifica(null)
          }}
        />
      )}

      <Navigazione
        indietro={indietro}
        avanti={avanti}
        etichettaAvanti={asset.length === 0 ? 'Salta per ora' : 'Avanti'}
      />
    </>
  )
}

function PassoAccessi({ indietro, avanti }: { indietro: () => void; avanti: () => void }) {
  const { documento } = useArchivio()
  const conEsportazione = documento.asset.filter(
    (a) => guidaPer(a.piattaforma, a.tipoAsset)?.utenti.esportazione === 'csv',
  )
  const daCopiare = documento.asset.filter(
    (a) => guidaPer(a.piattaforma, a.tipoAsset)?.utenti.esportazione === 'copia',
  )

  return (
    <>
      <Riquadro
        titolo="Chi accede a cosa"
        didascalia="È la parte più lunga, e c’è un modo rapido che è anche il più affidabile."
      >
        <Avviso tono="informazione" titolo="Non scriverli a mano">
          <p>
            Il modo rapido non è compilare il registro a memoria: è partire dagli <strong>elenchi utenti delle
            piattaforme</strong>. Si scarica o si copia l’elenco di chi ha accesso, l’applicativo lo interpreta, e
            da ogni riga si crea la voce del registro con un clic — con il profilo già riconosciuto.
          </p>
          <p style={{ margin: 0 }}>
            È anche l’unico modo affidabile: un registro compilato a memoria contiene quello che ci si ricorda di
            aver autorizzato, non quello che è davvero configurato sulle piattaforme. La differenza fra le due
            cose è esattamente ciò che questa mappatura deve far emergere.
          </p>
        </Avviso>

        {documento.asset.length === 0 ? (
          <p className="vuoto">
            Nessun asset censito: l’import si fa un asset alla volta, quindi conviene tornare al passo precedente.
          </p>
        ) : (
          <>
            <p>
              Per i {numero(documento.asset.length, 'asset censito', 'asset censiti')} il quadro è questo:
            </p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.75 }}>
              {conEsportazione.length > 0 && (
                <li>
                  <strong>{numero(conEsportazione.length, 'asset', 'asset')}</strong> su piattaforme che hanno un
                  pulsante di download: si scarica il CSV e si carica.{' '}
                  <span className="aiuto-campo">
                    ({[...new Set(conEsportazione.map((a) => a.piattaforma))].join(', ')})
                  </span>
                </li>
              )}
              {daCopiare.length > 0 && (
                <li>
                  <strong>{numero(daCopiare.length, 'asset', 'asset')}</strong> su piattaforme senza export: si
                  seleziona l’elenco nella pagina e si incolla.{' '}
                  <span className="aiuto-campo">
                    ({[...new Set(daCopiare.map((a) => a.piattaforma))].join(', ')})
                  </span>
                </li>
              )}
            </ul>
            <p className="aiuto-campo" style={{ margin: 0 }}>
              L’import sta nella sezione «Importa elenchi», e il percorso preciso per ogni piattaforma compare
              lì. Si può fare adesso oppure dopo: il setup non serve completarlo in una sessione.
            </p>
          </>
        )}
      </Riquadro>

      <Navigazione indietro={indietro} avanti={avanti} etichettaAvanti="Avanti" />
    </>
  )
}

function PassoFine({ indietro }: { indietro: () => void }) {
  const archivio = useArchivio()
  const { documento } = archivio
  const giorno = oggi()
  const codice = prossimoCodiceCampagna(giorno, documento.campagne)
  const [apri, setApri] = useState(true)

  return (
    <>
      <Riquadro titolo="Tutto pronto" didascalia="Riepilogo di quello che c’è in archivio adesso.">
        <div className="indicatori" style={{ marginBottom: 16 }}>
          <div className="indicatore">
            <div className="valore">{documento.persone.length}</div>
            <div className="etichetta">Persone</div>
          </div>
          <div className="indicatore">
            <div className="valore">{documento.asset.length}</div>
            <div className="etichetta">Asset</div>
          </div>
          <div className="indicatore">
            <div className="valore">{documento.accessi.length}</div>
            <div className="etichetta">Accessi censiti</div>
          </div>
        </div>

        <label className="schiera" style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={apri}
            onChange={(e) => setApri(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <span>
            Apri subito la campagna <strong>{codice}</strong> e comincia a verificare
          </span>
        </label>
        <p className="aiuto-campo">
          Una campagna raccoglie le verifiche di un semestre e permette di generare il verbale alla chiusura. Si
          può aprire anche più tardi dal cruscotto.
        </p>
      </Riquadro>

      <Riquadro titolo="Due cose da ricordare">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75 }}>
          <li>
            <strong>Mai password, token o chiavi API</strong> in nessun campo, note comprese: questo archivio
            viene esportato e mandato al DPO.
          </li>
          <li>
            <strong>Le revoche si eseguono prima sulla piattaforma</strong> e poi si registrano qui con la data.
            L’applicativo non tocca le piattaforme, di proposito.
          </li>
        </ul>
      </Riquadro>

      <div className="riga-azioni fine">
        <button type="button" onClick={indietro}>
          Indietro
        </button>
        <button
          type="button"
          className="principale"
          onClick={() =>
            archivio.aggiorna((d) => {
              const conCampagna = apri ? apriCampagna(d, codice, giorno) : d
              return { ...conCampagna, setup: { completato: true, passoRaggiunto: 4 } }
            })
          }
        >
          Entra in Mapicy
        </button>
      </div>
    </>
  )
}
