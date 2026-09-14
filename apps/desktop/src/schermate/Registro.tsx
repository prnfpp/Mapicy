import { useMemo, useState } from 'react'
import { profiliPer, trovaProfilo } from '@mapicy/catalogo'
import {
  derivaAccesso,
  eseguiControlli,
  giorniFra,
  registraVerifica,
  type Accesso,
  type AccessoDerivato,
  type EsitoVerifica,
} from '@mapicy/core'
import { useArchivio } from '../stato.js'
import { generaId, oggi } from '../ponte.js'
import { Avviso, Campo, DataBreve, Modale, Pastiglia, Riquadro } from '../componenti/base.js'
import { ESITO_VERIFICA, MFA, RISCHIO, STATO_ACCESSO } from '../etichette.js'

function accessoVuoto(codiceAsset: string): Accesso {
  return {
    id: generaId(),
    codiceAsset,
    personaId: '',
    profilo: '',
    email: '',
    stato: 'attivo',
    dataConcessione: oggi(),
    dataUltimaVerifica: null,
    esitoUltimaVerifica: null,
    campagnaVerifica: '',
    verificatoDa: '',
    dataRevoca: null,
    mfaAttiva: 'da-verificare',
    autorizzatoDa: '',
    finalita: '',
    note: '',
  }
}

type Filtro = 'tutti' | 'attivi' | 'da-verificare' | 'rischio-alto' | 'revocati'

export function Registro() {
  const archivio = useArchivio()
  const { documento } = archivio
  const giorno = oggi()
  const [filtro, setFiltro] = useState<Filtro>('attivi')
  const [filtroAsset, setFiltroAsset] = useState('')
  const [ricerca, setRicerca] = useState('')
  const [inModifica, setInModifica] = useState<Accesso | null>(null)
  const [inVerifica, setInVerifica] = useState<AccessoDerivato | null>(null)

  const idDaVerificare = useMemo(() => {
    const c07 = eseguiControlli(documento, giorno).find((c) => c.codice === 'C07')
    return new Set(c07?.casi.map((c) => c.id) ?? [])
  }, [documento, giorno])

  const derivati = useMemo(
    () => documento.accessi.map((a) => derivaAccesso(documento, a)),
    [documento],
  )

  const visibili = derivati
    .filter((d) => {
      if (filtroAsset && d.accesso.codiceAsset !== filtroAsset) return false
      if (filtro === 'attivi' && d.accesso.stato !== 'attivo') return false
      if (filtro === 'revocati' && d.accesso.stato !== 'revocato') return false
      if (filtro === 'da-verificare' && !idDaVerificare.has(d.accesso.id)) return false
      if (filtro === 'rischio-alto' && !(d.rischio === 'alto' && d.accesso.stato === 'attivo')) return false
      if (ricerca) {
        const q = ricerca.toLowerCase()
        const dove = [
          d.persona?.nome,
          d.accesso.email,
          d.accesso.codiceAsset,
          d.asset?.cliente,
          d.asset?.nome,
          d.accesso.profilo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!dove.includes(q)) return false
      }
      return true
    })
    .sort(
      (a, b) =>
        a.accesso.codiceAsset.localeCompare(b.accesso.codiceAsset) ||
        (a.persona?.nome ?? '').localeCompare(b.persona?.nome ?? ''),
    )

  const codiciAsset = [...documento.asset].sort((a, b) => a.codice.localeCompare(b.codice))

  return (
    <>
      {!documento.campagnaCorrente && (
        <Avviso tono="informazione" titolo="Nessuna campagna aperta">
          <p style={{ margin: 0 }}>
            Le verifiche si possono registrare comunque, ma non verranno attribuite a una campagna e non
            finiranno in un verbale. La campagna si apre dal cruscotto.
          </p>
        </Avviso>
      )}

      <Riquadro
        titolo={`Registro accessi (${visibili.length} di ${documento.accessi.length})`}
        didascalia="Una riga per ogni persona su ogni asset. Gli accessi revocati restano: sono l’evidenza che la revoca è stata fatta."
        azioni={
          <button
            type="button"
            className="principale"
            disabled={documento.asset.length === 0}
            title={documento.asset.length === 0 ? 'Prima va censito almeno un asset.' : undefined}
            onClick={() => setInModifica(accessoVuoto(filtroAsset || codiciAsset[0].codice))}
          >
            Aggiungi un accesso
          </button>
        }
      >
        <div className="filtri">
          <div>
            <label>Mostra</label>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
              <option value="attivi">Solo accessi attivi</option>
              <option value="da-verificare">Da verificare in questa campagna</option>
              <option value="rischio-alto">Solo rischio alto</option>
              <option value="revocati">Solo revocati</option>
              <option value="tutti">Tutti</option>
            </select>
          </div>
          <div>
            <label>Asset</label>
            <select value={filtroAsset} onChange={(e) => setFiltroAsset(e.target.value)}>
              <option value="">Tutti gli asset</option>
              {codiciAsset.map((a) => (
                <option key={a.codice} value={a.codice}>
                  {a.codice} — {a.cliente}
                </option>
              ))}
            </select>
          </div>
          <div className="cresci">
            <label>Cerca</label>
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Nome, indirizzo, cliente, profilo…"
            />
          </div>
        </div>

        {visibili.length === 0 ? (
          <p className="vuoto">
            {documento.accessi.length === 0
              ? 'Nessun accesso censito. Il modo più rapido per costruire la prima fotografia è importare gli elenchi dalle piattaforme.'
              : 'Nessun accesso corrisponde ai filtri.'}
          </p>
        ) : (
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Asset</th>
                  <th>Profilo autorizzativo</th>
                  <th>Rischio</th>
                  <th>Stato</th>
                  <th>MFA</th>
                  <th>Ultima verifica</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibili.map((d) => (
                  <tr key={d.accesso.id} className={d.accesso.stato === 'revocato' ? 'attenuata' : undefined}>
                    <td>
                      <strong>{d.persona?.nome ?? <Pastiglia tipo="medio">persona assente</Pastiglia>}</strong>
                      <div className="aiuto-campo mono">{d.accesso.email}</div>
                    </td>
                    <td>
                      <span className="mono">{d.accesso.codiceAsset}</span>
                      <div className="aiuto-campo">
                        {d.asset ? `${d.asset.cliente} · ${d.asset.piattaforma}` : 'asset non in anagrafica'}
                      </div>
                    </td>
                    <td>
                      {d.accesso.profilo || <Pastiglia tipo="medio">manca</Pastiglia>}
                      {d.problema && <div className="aiuto-campo">{d.problema}</div>}
                    </td>
                    <td>{d.rischio ? <Pastiglia tipo={d.rischio}>{RISCHIO[d.rischio]}</Pastiglia> : <span className="vuoto">—</span>}</td>
                    <td>
                      <Pastiglia
                        tipo={
                          d.accesso.stato === 'attivo' ? 'ok' : d.accesso.stato === 'revocato' ? 'neutra' : 'medio'
                        }
                      >
                        {STATO_ACCESSO[d.accesso.stato]}
                      </Pastiglia>
                    </td>
                    <td>
                      {d.accesso.mfaAttiva === 'si' ? (
                        'Sì'
                      ) : d.accesso.mfaAttiva === 'non-applicabile' ? (
                        <span className="vuoto">n.a.</span>
                      ) : (
                        <Pastiglia tipo="medio">{MFA[d.accesso.mfaAttiva]}</Pastiglia>
                      )}
                    </td>
                    <td>
                      {d.accesso.dataUltimaVerifica ? (
                        <>
                          <DataBreve valore={d.accesso.dataUltimaVerifica} />
                          <div className="aiuto-campo">
                            {giorniFra(d.accesso.dataUltimaVerifica, giorno)} giorni fa
                            {d.accesso.esitoUltimaVerifica
                              ? ` · ${ESITO_VERIFICA[d.accesso.esitoUltimaVerifica]}`
                              : ''}
                          </div>
                        </>
                      ) : (
                        <Pastiglia tipo="medio">mai</Pastiglia>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {d.accesso.stato !== 'revocato' && (
                        <button type="button" className="piccolo" onClick={() => setInVerifica(d)}>
                          Verifica
                        </button>
                      )}{' '}
                      <button type="button" className="piatto piccolo" onClick={() => setInModifica(d.accesso)}>
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

      {inModifica && (
        <ModificaAccesso
          accesso={inModifica}
          chiudi={() => setInModifica(null)}
          salva={(accesso) => {
            archivio.aggiorna((d) => ({
              ...d,
              accessi: d.accessi.some((a) => a.id === accesso.id)
                ? d.accessi.map((a) => (a.id === accesso.id ? accesso : a))
                : [...d.accessi, accesso],
            }))
            setInModifica(null)
          }}
        />
      )}

      {inVerifica && (
        <RegistraVerifica
          derivato={inVerifica}
          chiudi={() => setInVerifica(null)}
          conferma={(esito, nuovoProfilo, note) => {
            archivio.aggiorna((d) =>
              registraVerifica(
                d,
                {
                  accessoId: inVerifica.accesso.id,
                  esito,
                  nuovoProfilo,
                  note,
                  verificatoDa: archivio.operatore(),
                  idRevisione: generaId(),
                },
                giorno,
              ),
            )
            setInVerifica(null)
          }}
        />
      )}
    </>
  )
}

/**
 * La verifica di un accesso: le tre decisioni possibili, con la conseguenza
 * scritta accanto. La revoca dice esplicitamente che va eseguita prima sulla
 * piattaforma: l'applicativo non tocca le piattaforme, e chi verifica deve
 * saperlo prima di cliccare, non dopo.
 */
function RegistraVerifica({
  derivato,
  conferma,
  chiudi,
}: {
  derivato: AccessoDerivato
  conferma: (esito: EsitoVerifica, nuovoProfilo: string | undefined, note: string) => void
  chiudi: () => void
}) {
  const [esito, setEsito] = useState<EsitoVerifica>('confermato')
  const [nuovoProfilo, setNuovoProfilo] = useState('')
  const [note, setNote] = useState('')
  const profili = derivato.asset ? profiliPer(derivato.asset.piattaforma, derivato.asset.tipoAsset) : []
  const profiloScelto = derivato.asset ? trovaProfilo(derivato.asset.piattaforma, derivato.asset.tipoAsset, nuovoProfilo) : null

  return (
    <Modale
      titolo={`Verifica: ${derivato.persona?.nome ?? derivato.accesso.email}`}
      didascalia={`${derivato.accesso.codiceAsset} · ${derivato.accesso.profilo || 'profilo non indicato'}`}
      chiudi={chiudi}
    >
      {derivato.rischio === 'alto' && (
        <Avviso tono="attenzione" titolo="Profilo a rischio privacy alto">
          <p style={{ margin: 0 }}>
            Questo profilo può gestire utenti, toccare dati finanziari o esportare dati personali. Vale la
            domanda della minimizzazione: serve davvero così ampio?
          </p>
        </Avviso>
      )}

      <Campo etichetta="Decisione">
        <select value={esito} onChange={(e) => setEsito(e.target.value as EsitoVerifica)}>
          <option value="confermato">Confermo: l’accesso serve così com’è</option>
          <option value="profilo-ridotto">Riduco il profilo a uno più ristretto</option>
          <option value="revocato">Revoco l’accesso</option>
          <option value="da-verificare">Rinvio: non ho ancora gli elementi per decidere</option>
        </select>
      </Campo>

      {esito === 'profilo-ridotto' && (
        <div style={{ marginTop: 14 }}>
          <Campo etichetta="Nuovo profilo" obbligatorio aiuto="Solo i profili reali di questo tipo di asset.">
            <select value={nuovoProfilo} onChange={(e) => setNuovoProfilo(e.target.value)}>
              <option value="">Scegli il profilo</option>
              {profili
                .filter((p) => p.profilo !== derivato.accesso.profilo)
                .map((p) => (
                  <option key={p.profilo} value={p.profilo}>
                    {p.profilo} — rischio {RISCHIO[p.rischio].toLowerCase()}
                  </option>
                ))}
            </select>
          </Campo>
          {profiloScelto && (
            <div className="guida" style={{ marginTop: 12 }}>
              <h3>Cosa potrà fare con il nuovo profilo</h3>
              <p className="attivita-testo" style={{ margin: 0 }}>
                {profiloScelto.attivita}
              </p>
            </div>
          )}
        </div>
      )}

      {esito === 'revocato' && (
        <Avviso tono="attenzione" titolo="Prima sulla piattaforma, poi qui">
          <p style={{ margin: 0 }}>
            Mapicy non revoca gli accessi: la rimozione va fatta sulla piattaforma. Confermando, qui si registra
            che è stata fatta oggi, e la riga resta in archivio come evidenza.
          </p>
        </Avviso>
      )}

      <div style={{ marginTop: 14 }}>
        <Campo etichetta="Nota" aiuto="Finisce nel registro delle revisioni e nel verbale della campagna.">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 70 }} />
        </Campo>
      </div>

      <div className="riga-azioni fine">
        <button type="button" onClick={chiudi}>
          Annulla
        </button>
        <button
          type="button"
          className={esito === 'revocato' ? 'pericolo' : 'principale'}
          disabled={esito === 'profilo-ridotto' && !nuovoProfilo}
          onClick={() => conferma(esito, esito === 'profilo-ridotto' ? nuovoProfilo : undefined, note.trim())}
        >
          {esito === 'revocato' ? 'Registra la revoca' : 'Registra la verifica'}
        </button>
      </div>
    </Modale>
  )
}

function ModificaAccesso({
  accesso,
  salva,
  chiudi,
}: {
  accesso: Accesso
  salva: (accesso: Accesso) => void
  chiudi: () => void
}) {
  const { documento } = useArchivio()
  const [bozza, setBozza] = useState(accesso)
  const asset = documento.asset.find((a) => a.codice === bozza.codiceAsset)
  const profili = asset ? profiliPer(asset.piattaforma, asset.tipoAsset) : []
  const profilo = asset ? trovaProfilo(asset.piattaforma, asset.tipoAsset, bozza.profilo) : null
  const persone = [...documento.persone].sort((a, b) => a.nome.localeCompare(b.nome))
  const nuovo = !documento.accessi.some((a) => a.id === accesso.id)

  const modifica = <K extends keyof Accesso>(campo: K, valore: Accesso[K]) =>
    setBozza((a) => ({ ...a, [campo]: valore }))

  const puoSalvare = Boolean(bozza.codiceAsset && bozza.personaId && bozza.profilo && bozza.email.trim())

  return (
    <Modale
      titolo={nuovo ? 'Nuovo accesso' : 'Modifica accesso'}
      didascalia="Scelto l’asset e il profilo, la tipologia di dati trattati, le attività e il livello di rischio si compilano dal catalogo: non vanno scritti a mano."
      larga
      chiudi={chiudi}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 1fr)', gap: 22 }}>
        <div>
          <div className="griglia due">
            <Campo etichetta="Asset" obbligatorio>
              <select
                value={bozza.codiceAsset}
                onChange={(e) => setBozza((a) => ({ ...a, codiceAsset: e.target.value, profilo: '' }))}
              >
                {documento.asset.map((a) => (
                  <option key={a.codice} value={a.codice}>
                    {a.codice} — {a.cliente} · {a.tipoAsset}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etichetta="Persona" obbligatorio>
              <select
                value={bozza.personaId}
                onChange={(e) => {
                  const personaId = e.target.value
                  const persona = documento.persone.find((p) => p.id === personaId)
                  // Si propone l'indirizzo dell'anagrafica: è quello che quasi
                  // sempre compare nell'estrazione della piattaforma.
                  setBozza((a) => ({ ...a, personaId, email: a.email || persona?.email || '' }))
                }}
              >
                <option value="">Scegli la persona</option>
                {persone.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                    {p.stato === 'cessato' ? ' (cessata)' : ''}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Profilo autorizzativo"
              obbligatorio
              aiuto={
                asset
                  ? `Solo i profili reali di ${asset.piattaforma} / ${asset.tipoAsset}: ${profili.length} disponibili.`
                  : 'Scegli prima un asset.'
              }
            >
              <select value={bozza.profilo} onChange={(e) => modifica('profilo', e.target.value)}>
                <option value="">Scegli il profilo</option>
                {profili.map((p) => (
                  <option key={p.profilo} value={p.profilo}>
                    {p.profilo} — rischio {RISCHIO[p.rischio].toLowerCase()}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Account usato per l’accesso"
              obbligatorio
              aiuto="È metà della chiave con cui il confronto con le estrazioni riconosce questa riga. Deve essere l’indirizzo che compare sulla piattaforma."
            >
              <input
                type="email"
                className="mono"
                value={bozza.email}
                onChange={(e) => modifica('email', e.target.value)}
              />
            </Campo>

            <Campo etichetta="Stato dell’accesso">
              <select
                value={bozza.stato}
                onChange={(e) => {
                  const stato = e.target.value as Accesso['stato']
                  setBozza((a) => ({
                    ...a,
                    stato,
                    dataRevoca: stato === 'revocato' ? (a.dataRevoca ?? oggi()) : a.dataRevoca,
                  }))
                }}
              >
                {(['da-attivare', 'attivo', 'sospeso', 'revocato'] as const).map((v) => (
                  <option key={v} value={v}>
                    {STATO_ACCESSO[v]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Verifica in due passaggi sull’account"
              aiuto="Riguarda l’account con cui si accede, non il profilo. È il controllo C06."
            >
              <select value={bozza.mfaAttiva} onChange={(e) => modifica('mfaAttiva', e.target.value as Accesso['mfaAttiva'])}>
                {(['si', 'no', 'non-applicabile', 'da-verificare'] as const).map((v) => (
                  <option key={v} value={v}>
                    {MFA[v]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etichetta="Data di concessione" aiuto="Da quando la persona ha questo accesso. Se non è ricostruibile con precisione, va indicata la data più probabile.">
              <input
                type="date"
                value={bozza.dataConcessione ?? ''}
                onChange={(e) => modifica('dataConcessione', e.target.value || null)}
              />
            </Campo>

            <Campo etichetta="Data di revoca">
              <input
                type="date"
                value={bozza.dataRevoca ?? ''}
                disabled={bozza.stato !== 'revocato'}
                onChange={(e) => modifica('dataRevoca', e.target.value || null)}
              />
            </Campo>

            <Campo etichetta="Accesso autorizzato da" aiuto="Chi in agenzia ha deciso di concedere questo accesso.">
              <input value={bozza.autorizzatoDa} onChange={(e) => modifica('autorizzatoDa', e.target.value)} />
            </Campo>

            <Campo
              etichetta="Finalità dell’accesso"
              aiuto="Perché serve. È la domanda a cui rispondere in sede di verifica: senza una finalità scritta, non c’è modo di dire se l’accesso è ancora necessario."
            >
              <input value={bozza.finalita} onChange={(e) => modifica('finalita', e.target.value)} />
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Campo etichetta="Note" aiuto="Mai password, token o chiavi API.">
              <textarea value={bozza.note} onChange={(e) => modifica('note', e.target.value)} style={{ minHeight: 70 }} />
            </Campo>
          </div>
        </div>

        <div>
          {profilo ? (
            <div className="guida">
              <h3>
                Si compila da sé <Pastiglia tipo={profilo.rischio}>rischio {RISCHIO[profilo.rischio].toLowerCase()}</Pastiglia>
              </h3>
              <dl>
                <dt>Tipologia di dati trattati</dt>
                <dd>{profilo.datiTrattati}</dd>
                <dt>Attività di trattamento</dt>
                <dd className="attivita-testo">{profilo.attivita}</dd>
              </dl>
              <p className="aiuto-campo" style={{ marginTop: 12 }}>
                Questo testo non viene copiato nella riga: si legge dal catalogo ogni volta. Se il catalogo si
                aggiorna, si aggiorna anche qui.
              </p>
            </div>
          ) : (
            <div className="guida">
              <p className="vuoto" style={{ margin: 0 }}>
                Scegliendo l’asset e il profilo, in questo riquadro compariranno la tipologia di dati trattati, le
                attività di trattamento e il livello di rischio, presi dal catalogo.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="riga-azioni fine">
        <button type="button" onClick={chiudi}>
          Annulla
        </button>
        <button type="button" className="principale" disabled={!puoSalvare} onClick={() => salva(bozza)}>
          Salva
        </button>
      </div>
    </Modale>
  )
}
