import { useMemo, useState } from 'react'
import { elenchi, fornitorePer, piattaforme, tipiAssetPer } from '@mapicy/catalogo'
import { codiceAssetModificabile, proponiCodiceAsset, type Asset } from '@mapicy/core'
import { useArchivio } from '../stato.js'
import { generaId, oggi } from '../ponte.js'
import { Avviso, Campo, DataBreve, GuidaReperimento, Modale, Pastiglia, Riquadro } from '../componenti/base.js'
import { STATO_ASSET } from '../etichette.js'

export function assetVuoto(): Asset {
  return {
    id: generaId(),
    codice: '',
    cliente: '',
    // Nessuna piattaforma preselezionata: con un valore predefinito si
    // salverebbero asset sulla prima piattaforma dell'elenco per distrazione,
    // e il tipo di asset sbagliato porta con sé i profili sbagliati.
    piattaforma: '',
    tipoAsset: '',
    nome: '',
    idPiattaforma: '',
    proprieta: 'Cliente',
    titolare: '',
    ruoloAgenzia: 'Responsabile del trattamento (art. 28)',
    baseGiuridica: 'Contratto (art. 6.1.b)',
    trasferimentoExtraUe: '',
    conservazione: '',
    prossimaVerifica: null,
    stato: 'attivo',
    note: '',
  }
}

export function SchermataAsset() {
  const archivio = useArchivio()
  const { documento } = archivio
  const [inModifica, setInModifica] = useState<Asset | null>(null)
  const [filtroCliente, setFiltroCliente] = useState('')

  const clienti = useMemo(
    () => [...new Set(documento.asset.map((a) => a.cliente).filter(Boolean))].sort(),
    [documento.asset],
  )
  const visibili = documento.asset
    .filter((a) => !filtroCliente || a.cliente === filtroCliente)
    .sort((a, b) => a.cliente.localeCompare(b.cliente) || a.codice.localeCompare(b.codice))

  return (
    <>
      <Riquadro
        titolo={`Asset (${documento.asset.length})`}
        didascalia="Una riga per ogni proprietà digitale di ogni cliente: la Pagina Facebook, l’account Google Ads, il sito. Il codice è la chiave che lega registro ed estrazioni, e non si cambia più."
        azioni={
          <button type="button" className="principale" onClick={() => setInModifica(assetVuoto())}>
            Aggiungi un asset
          </button>
        }
      >
        {clienti.length > 1 && (
          <div className="filtri">
            <div>
              <label>Cliente</label>
              <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
                <option value="">Tutti i clienti</option>
                {clienti.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {visibili.length === 0 ? (
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
                  <th>Titolare</th>
                  <th className="num">Accessi attivi</th>
                  <th>Prossima verifica</th>
                  <th>Stato</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibili.map((asset) => {
                  const attivi = documento.accessi.filter(
                    (a) => a.codiceAsset === asset.codice && a.stato === 'attivo',
                  ).length
                  const scaduta = asset.prossimaVerifica !== null && asset.prossimaVerifica < oggi()
                  return (
                    <tr key={asset.id} className={asset.stato === 'dismesso' ? 'attenuata' : undefined}>
                      <td className="mono">
                        <strong>{asset.codice}</strong>
                      </td>
                      <td>{asset.cliente}</td>
                      <td>{asset.piattaforma}</td>
                      <td>{asset.tipoAsset}</td>
                      <td>{asset.nome}</td>
                      <td>{asset.titolare || <Pastiglia tipo="medio">manca</Pastiglia>}</td>
                      <td className="num">{attivi || ''}</td>
                      <td>
                        {asset.prossimaVerifica ? (
                          scaduta ? (
                            <Pastiglia tipo="medio">
                              <DataBreve valore={asset.prossimaVerifica} />
                            </Pastiglia>
                          ) : (
                            <DataBreve valore={asset.prossimaVerifica} />
                          )
                        ) : (
                          <Pastiglia tipo="medio">da pianificare</Pastiglia>
                        )}
                      </td>
                      <td>
                        <Pastiglia tipo={asset.stato === 'attivo' ? 'ok' : 'neutra'}>
                          {STATO_ASSET[asset.stato]}
                        </Pastiglia>
                      </td>
                      <td>
                        <button type="button" className="piatto piccolo" onClick={() => setInModifica(asset)}>
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
          salva={(asset) => {
            archivio.aggiorna((d) => ({
              ...d,
              asset: d.asset.some((a) => a.id === asset.id)
                ? d.asset.map((a) => (a.id === asset.id ? asset : a))
                : [...d.asset, asset],
            }))
            setInModifica(null)
          }}
        />
      )}
    </>
  )
}

export function ModificaAsset({
  asset,
  salva,
  chiudi,
}: {
  asset: Asset
  salva: (asset: Asset) => void
  chiudi: () => void
}) {
  const { documento } = useArchivio()
  const [bozza, setBozza] = useState(asset)
  const nuovo = !documento.asset.some((a) => a.id === asset.id)
  const codiceBloccato = !nuovo && !codiceAssetModificabile(documento, asset.codice)
  const fornitore = fornitorePer(bozza.piattaforma)
  const tipi = tipiAssetPer(bozza.piattaforma)
  const clientiNoti = [...new Set(documento.asset.map((a) => a.cliente).filter(Boolean))].sort()

  const modifica = <K extends keyof Asset>(campo: K, valore: Asset[K]) =>
    setBozza((a) => ({ ...a, [campo]: valore }))

  /** Il codice si propone da cliente e tipo di asset, e resta modificabile finché non è in uso. */
  const proponi = (cliente: string, piattaforma: string, tipoAsset: string) =>
    proponiCodiceAsset(
      cliente,
      piattaforma,
      tipoAsset,
      documento.asset.filter((a) => a.id !== bozza.id).map((a) => a.codice),
    )

  const codiceDuplicato = documento.asset.some((a) => a.id !== bozza.id && a.codice === bozza.codice.trim())
  const puoSalvare =
    Boolean(
      bozza.codice.trim() && bozza.cliente.trim() && bozza.nome.trim() && bozza.piattaforma && bozza.tipoAsset,
    ) && !codiceDuplicato

  return (
    <Modale
      titolo={nuovo ? 'Nuovo asset' : `Modifica ${asset.codice}`}
      didascalia="I campi con l’asterisco sono necessari. Per gli altri, la guida a destra dice dove andare a prendere il dato sulla piattaforma."
      larga
      chiudi={chiudi}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 1fr)', gap: 22 }}>
        <div>
          <div className="griglia due">
            <Campo etichetta="Cliente / progetto" obbligatorio>
              <input
                value={bozza.cliente}
                list="clienti-noti"
                autoFocus
                onChange={(e) => {
                  const cliente = e.target.value
                  setBozza((a) => ({
                    ...a,
                    cliente,
                    codice: nuovo && !codiceBloccato ? proponi(cliente, a.piattaforma, a.tipoAsset) : a.codice,
                    // Nella maggioranza dei casi il titolare del trattamento è
                    // il cliente: si propone, e resta correggibile.
                    titolare: a.titolare || cliente,
                  }))
                }}
              />
              <datalist id="clienti-noti">
                {clientiNoti.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>

            <Campo etichetta="Piattaforma" obbligatorio>
              <select
                value={bozza.piattaforma}
                onChange={(e) => {
                  const piattaforma = e.target.value
                  const tipi = tipiAssetPer(piattaforma)
                  // Se la piattaforma ha un solo tipo di asset la scelta è
                  // già fatta e chiederla sarebbe un passaggio a vuoto.
                  const tipoAsset = tipi.length === 1 ? tipi[0].tipoAsset : ''
                  setBozza((a) => ({
                    ...a,
                    piattaforma,
                    tipoAsset,
                    codice: nuovo && !codiceBloccato ? proponi(a.cliente, piattaforma, tipoAsset) : a.codice,
                    trasferimentoExtraUe:
                      fornitorePer(piattaforma)?.trasferimentoExtraUe ?? a.trasferimentoExtraUe,
                  }))
                }}
              >
                <option value="">Scegli la piattaforma</option>
                {piattaforme().map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Tipo di asset"
              obbligatorio
              aiuto="Determina quali profili autorizzativi saranno proponibili sugli accessi a questo asset."
            >
              <select
                value={bozza.tipoAsset}
                onChange={(e) => {
                  const tipoAsset = e.target.value
                  setBozza((a) => ({
                    ...a,
                    tipoAsset,
                    codice: nuovo && !codiceBloccato ? proponi(a.cliente, a.piattaforma, tipoAsset) : a.codice,
                  }))
                }}
                disabled={!bozza.piattaforma}
              >
                <option value="">
                  {bozza.piattaforma ? 'Scegli il tipo di asset' : 'Prima scegli la piattaforma'}
                </option>
                {tipi.map((t) => (
                  <option key={t.tipoAsset} value={t.tipoAsset}>
                    {t.tipoAsset}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Codice asset"
              obbligatorio
              aiuto={
                codiceBloccato
                  ? 'Non modificabile: questo codice è già usato da accessi o estrazioni, e cambiarlo scollegherebbe quelle righe senza dirlo.'
                  : 'Proposto da cliente e tipo di asset. Si può correggere adesso; dopo il primo accesso censito non si cambia più.'
              }
            >
              <input
                className="mono"
                value={bozza.codice}
                readOnly={codiceBloccato}
                onChange={(e) => modifica('codice', e.target.value.toUpperCase())}
              />
            </Campo>

            <Campo etichetta="Nome dell’asset" obbligatorio aiuto="Come lo chiamate voi, per riconoscerlo negli elenchi.">
              <input value={bozza.nome} onChange={(e) => modifica('nome', e.target.value)} />
            </Campo>

            <Campo etichetta="Identificativo sulla piattaforma" aiuto="Vedi la guida a destra: serve a non confondere due asset con lo stesso nome.">
              <input
                className="mono"
                value={bozza.idPiattaforma}
                onChange={(e) => modifica('idPiattaforma', e.target.value)}
              />
            </Campo>

            <Campo etichetta="Proprietà dell’asset" aiuto="Di chi è la proprietà: normalmente il cliente, a volte l’agenzia.">
              <select value={bozza.proprieta} onChange={(e) => modifica('proprieta', e.target.value)}>
                {['Cliente', 'Agenzia', 'Terzo fornitore', 'Da verificare'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Titolare del trattamento"
              aiuto="Chi decide finalità e modi del trattamento. Di norma è il cliente. È il campo che il controllo C15 verifica."
            >
              <input value={bozza.titolare} onChange={(e) => modifica('titolare', e.target.value)} />
            </Campo>

            <Campo
              etichetta="Ruolo dell’agenzia"
              aiuto="Nella maggior parte dei casi l’agenzia è responsabile del trattamento (art. 28), perché tratta i dati per conto del cliente."
            >
              <select value={bozza.ruoloAgenzia} onChange={(e) => modifica('ruoloAgenzia', e.target.value)}>
                {elenchi.ruoloPrivacy.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etichetta="Base giuridica">
              <select value={bozza.baseGiuridica} onChange={(e) => modifica('baseGiuridica', e.target.value)}>
                {elenchi.baseGiuridica.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etichetta="Trasferimento extra-UE"
              aiuto={
                fornitore
                  ? `Proposto dal catalogo per ${bozza.piattaforma}: "${fornitore.trasferimentoExtraUe}". Va confermato, perché dipende anche dalla regione dell’account.`
                  : undefined
              }
            >
              <select
                value={bozza.trasferimentoExtraUe}
                onChange={(e) => modifica('trasferimentoExtraUe', e.target.value)}
              >
                <option value="">Da indicare</option>
                {[...new Set([...elenchi.trasferimentoExtraUe, bozza.trasferimentoExtraUe].filter(Boolean))].map(
                  (v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ),
                )}
              </select>
            </Campo>

            <Campo etichetta="Conservazione dei dati" aiuto="Per quanto tempo i dati restano sulla piattaforma. Esempio: «24 mesi dalla raccolta».">
              <input value={bozza.conservazione} onChange={(e) => modifica('conservazione', e.target.value)} />
            </Campo>

            <Campo
              etichetta="Prossima verifica accessi"
              aiuto="Alla chiusura di una campagna viene ripianificata da sola a sei mesi."
            >
              <input
                type="date"
                value={bozza.prossimaVerifica ?? ''}
                onChange={(e) => modifica('prossimaVerifica', e.target.value || null)}
              />
            </Campo>

            <Campo etichetta="Stato" aiuto="«Dismesso» toglie l’asset dai controlli senza cancellarne la storia.">
              <select value={bozza.stato} onChange={(e) => modifica('stato', e.target.value as Asset['stato'])}>
                {(['attivo', 'dismesso'] as const).map((v) => (
                  <option key={v} value={v}>
                    {STATO_ASSET[v]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Campo etichetta="Note" aiuto="Mai password, token o chiavi API: questo archivio viene esportato e mandato al DPO.">
              <textarea value={bozza.note} onChange={(e) => modifica('note', e.target.value)} />
            </Campo>
          </div>

          {codiceDuplicato && (
            <Avviso tono="allerta" titolo="Codice già usato">
              <p style={{ margin: 0 }}>
                Un altro asset ha già il codice <span className="mono">{bozza.codice}</span>. Il codice deve essere
                univoco: è la chiave con cui gli accessi puntano all’asset.
              </p>
            </Avviso>
          )}
        </div>

        <div>
          <GuidaReperimento piattaforma={bozza.piattaforma} tipoAsset={bozza.tipoAsset} />
          {fornitore && (
            <div className="guida" style={{ marginTop: 14 }}>
              <h3>Il fornitore di {bozza.piattaforma}</h3>
              <dl>
                <dt>Chi è</dt>
                <dd>{fornitore.fornitore}</dd>
                <dt>Ruolo privacy dichiarato</dt>
                <dd>{fornitore.ruoloPrivacyFornitore}</dd>
                <dt>Riferimenti contrattuali</dt>
                <dd>{fornitore.riferimentiContrattuali}</dd>
              </dl>
              <p className="aiuto-campo" style={{ marginTop: 12 }}>
                Da confermare con il consulente privacy o il DPO prima di riportarlo in documentazione ufficiale:
                i fornitori cambiano ruolo e garanzie nel tempo.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="riga-azioni fine">
        <button type="button" onClick={chiudi}>
          Annulla
        </button>
        <button type="button" className="principale" disabled={!puoSalvare} onClick={() => salva({ ...bozza, codice: bozza.codice.trim() })}>
          Salva
        </button>
      </div>
    </Modale>
  )
}
