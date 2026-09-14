import { useMemo, useState } from 'react'
import { guidaPer } from '@mapicy/catalogo'
import {
  analizzaImport,
  anteprimaImport,
  applicaImport,
  costruisciEstrazioni,
  normalizzaEmail,
  riconcilia,
  type AnalisiImport,
  type Documento,
  type RigaEstrazione,
  type RigaRiconciliata,
} from '@mapicy/core'
import { useArchivio } from '../stato.js'
import { dentroApplicativo, generaId, oggi, ponte } from '../ponte.js'
import { Avviso, Campo, GuidaReperimento, Pastiglia, Riquadro } from '../componenti/base.js'
import { CLASSE_CONFRONTO, ESITO_CONFRONTO, SPIEGA_CONFRONTO, numero } from '../etichette.js'

export function Importa() {
  const archivio = useArchivio()
  const { documento } = archivio
  const giorno = oggi()

  const [codiceAsset, setCodiceAsset] = useState(documento.asset[0]?.codice ?? '')
  const [testo, setTesto] = useState('')
  const [nomeFile, setNomeFile] = useState('')
  const [dataEstrazione, setDataEstrazione] = useState(giorno)
  const [errore, setErrore] = useState('')
  const [importato, setImportato] = useState<{ codiceAsset: string; righe: number } | null>(null)

  const asset = documento.asset.find((a) => a.codice === codiceAsset)
  const guida = asset ? guidaPer(asset.piattaforma, asset.tipoAsset) : null

  const analisi: AnalisiImport | null = useMemo(() => {
    if (!testo.trim() || !asset) return null
    return analizzaImport({ testo, codiceAsset, documento })
  }, [testo, codiceAsset, documento, asset])

  const candidate: RigaEstrazione[] = useMemo(() => {
    if (!analisi || !asset) return []
    return costruisciEstrazioni(analisi, {
      fonte: asset.piattaforma,
      codiceAsset,
      nomeAssetPiattaforma: asset.nome,
      dataEstrazione,
      identificativi: analisi.righe.map(() => generaId()),
    })
  }, [analisi, asset, codiceAsset, dataEstrazione])

  const anteprima = useMemo(
    () => (candidate.length > 0 ? anteprimaImport(documento, candidate, codiceAsset, giorno) : null),
    [documento, candidate, codiceAsset, giorno],
  )

  const confronto = useMemo(() => {
    const r = riconcilia(documento, giorno)
    return r.righe.filter((x) => x.codiceAsset === codiceAsset)
  }, [documento, giorno, codiceAsset])

  async function apriFile() {
    setErrore('')
    try {
      const file = await ponte().leggiFileTesto()
      if (!file) return
      setTesto(file.testo)
      setNomeFile(file.nome)
      setImportato(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    }
  }

  if (documento.asset.length === 0) {
    return (
      <Avviso tono="informazione" titolo="Prima vanno censiti gli asset">
        <p style={{ margin: 0 }}>
          L’import confronta l’elenco utenti di una piattaforma con il registro di un asset preciso. Va aggiunto
          almeno un asset nella sezione Asset.
        </p>
      </Avviso>
    )
  }

  return (
    <>
      <Riquadro
        titolo="1. Scegli l’asset da confrontare"
        didascalia="L’elenco utenti si importa un asset alla volta, perché ogni asset ha i suoi profili e il suo elenco sulla piattaforma."
      >
        <div className="filtri" style={{ marginBottom: 0 }}>
          <div className="cresci">
            <label>Asset</label>
            <select
              value={codiceAsset}
              onChange={(e) => {
                setCodiceAsset(e.target.value)
                setTesto('')
                setNomeFile('')
                setImportato(null)
              }}
            >
              {documento.asset.map((a) => (
                <option key={a.codice} value={a.codice}>
                  {a.codice} — {a.cliente} · {a.piattaforma} · {a.tipoAsset}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Data dell’estrazione</label>
            <input type="date" value={dataEstrazione} max={giorno} onChange={(e) => setDataEstrazione(e.target.value)} />
          </div>
        </div>
        {dataEstrazione !== giorno && (
          <p className="aiuto-campo" style={{ marginTop: 8 }}>
            Un’estrazione più vecchia di {documento.impostazioni.giorniValiditaEstrazione} giorni non viene usata
            dal confronto.
          </p>
        )}
      </Riquadro>

      {asset && (
        <Riquadro
          titolo="2. Scarica o copia l’elenco dalla piattaforma"
          didascalia={
            guida?.utenti.esportazione === 'csv'
              ? `${asset.piattaforma} permette di scaricare l’elenco in CSV: si scarica e si carica qui.`
              : `${asset.piattaforma} non offre un export: l’elenco si seleziona nella pagina, si copia e si incolla qui.`
          }
        >
          <GuidaReperimento
            piattaforma={asset.piattaforma}
            tipoAsset={asset.tipoAsset}
            mostraIdentificativo={false}
          />
        </Riquadro>
      )}

      <Riquadro
        titolo="3. Carica o incolla l’elenco"
        didascalia="Vanno bene un CSV, un file separato da tabulazioni, o il testo copiato direttamente dalla pagina. L’applicativo riconosce le colonne da sé."
        azioni={
          <button type="button" onClick={apriFile} disabled={!dentroApplicativo()} title={dentroApplicativo() ? undefined : 'Disponibile solo nell’applicativo installato.'}>
            Apri un file CSV
          </button>
        }
      >
        {errore && (
          <Avviso tono="allerta">
            <p style={{ margin: 0 }}>{errore}</p>
          </Avviso>
        )}
        <Campo etichetta={nomeFile ? `Contenuto di ${nomeFile}` : 'Elenco utenti'}>
          <textarea
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value)
              setNomeFile('')
              setImportato(null)
            }}
            style={{ minHeight: 150, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}
            placeholder={'Email,Ruolo\nmario.rossi@agenzia.it,Accesso parziale alla Pagina'}
          />
        </Campo>
      </Riquadro>

      {analisi && (
        <Riquadro
          titolo="4. Controlla l’anteprima"
          didascalia={`${numero(analisi.righe.length, 'riga riconosciuta', 'righe riconosciute')}${analisi.scartate.length > 0 ? `, ${numero(analisi.scartate.length, 'riga scartata', 'righe scartate')}` : ''}. Niente viene scritto finché non si conferma.`}
        >
          {analisi.avvisi.map((avviso) => (
            <Avviso key={avviso} tono="attenzione">
              <p style={{ margin: 0 }}>{avviso}</p>
            </Avviso>
          ))}

          {analisi.righe.length > 0 && anteprima && (
            <>
              <div className="contenitore-tabella" style={{ marginBottom: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Persona sulla piattaforma</th>
                      <th>Account</th>
                      <th>Ruolo dichiarato</th>
                      <th>Profilo riconosciuto</th>
                      <th>Esito del confronto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisi.righe.map((riga) => {
                      const esito = anteprima.righe.find(
                        (x) => normalizzaEmail(x.email) === normalizzaEmail(riga.email),
                      )
                      return (
                        <tr key={riga.numeroRiga}>
                          <td>{riga.nomePersona || <span className="vuoto">non indicata</span>}</td>
                          <td className="mono">{riga.email}</td>
                          <td>{riga.ruoloDichiarato || <span className="vuoto">non indicato</span>}</td>
                          <td>
                            {riga.profiloRiconosciuto ?? (
                              <Pastiglia tipo="medio">non riconosciuto nel catalogo</Pastiglia>
                            )}
                          </td>
                          <td>
                            {esito ? (
                              <Pastiglia tipo={CLASSE_CONFRONTO[esito.esito]}>{ESITO_CONFRONTO[esito.esito]}</Pastiglia>
                            ) : (
                              <span className="vuoto">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {anteprima.righe.some((x) => x.esito === 'non-riscontrato') && (
                <Avviso tono="attenzione" titolo="Accessi del registro che questo elenco non conferma">
                  <p>
                    {SPIEGA_CONFRONTO['non-riscontrato']} Dopo l’import compariranno fra i casi del controllo C03.
                  </p>
                  <ul className="elenco-casi">
                    {anteprima.righe
                      .filter((x) => x.esito === 'non-riscontrato')
                      .map((x) => (
                        <li key={x.accessoId}>
                          {x.nomePersona || x.email} — {x.profiloRegistro}
                        </li>
                      ))}
                  </ul>
                </Avviso>
              )}
            </>
          )}

          {analisi.scartate.length > 0 && (
            <Avviso tono="informazione" titolo="Righe che non sono state interpretate">
              <ul className="elenco-casi">
                {analisi.scartate.map((s) => (
                  <li key={s.numeroRiga}>
                    Riga {s.numeroRiga}: {s.motivo}
                  </li>
                ))}
              </ul>
            </Avviso>
          )}

          <div className="riga-azioni">
            <button
              type="button"
              className="principale"
              disabled={analisi.righe.length === 0}
              onClick={() => {
                archivio.aggiorna((d) => applicaImport(d, candidate, codiceAsset));
                setImportato({ codiceAsset, righe: candidate.length })
                setTesto('')
                setNomeFile('')
              }}
            >
              Conferma l’import di {numero(analisi.righe.length, 'riga', 'righe')}
            </button>
            <span className="aiuto-campo">
              Le righe di estrazione precedenti di questo asset vengono sostituite: un’estrazione è la fotografia
              di un momento, non un archivio da accumulare.
            </span>
          </div>
        </Riquadro>
      )}

      {importato && (
        <Avviso tono="riuscito" titolo="Import completato">
          <p style={{ margin: 0 }}>
            {numero(importato.righe, 'riga importata', 'righe importate')} per {importato.codiceAsset}. Il
            confronto qui sotto è aggiornato.
          </p>
        </Avviso>
      )}

      {confronto.length > 0 && (
        <EsitoConfronto righe={confronto} codiceAsset={codiceAsset} />
      )}
    </>
  )
}

/**
 * L'esito del confronto dopo l'import, con l'azione che serve davvero: dalla
 * riga «non censito» si crea la riga del registro. È il passaggio che rende
 * automatica la prima mappatura — si parte dagli elenchi delle piattaforme
 * invece di scrivere a mano centinaia di righe.
 */
function EsitoConfronto({ righe, codiceAsset }: { righe: RigaRiconciliata[]; codiceAsset: string }) {
  const archivio = useArchivio()
  const { documento } = archivio
  const asset = documento.asset.find((a) => a.codice === codiceAsset)
  const nonCensiti = righe.filter((x) => x.esito === 'non-censito')

  return (
    <Riquadro
      titolo="Esito del confronto con la piattaforma"
      didascalia="Quello che il registro dice, messo accanto a quello che la piattaforma dice davvero."
      azioni={
        nonCensiti.length > 0 ? (
          <button
            type="button"
            className="principale"
            onClick={() =>
              archivio.aggiorna((d) =>
                nonCensiti.reduce((corrente, riga) => censisci(corrente, riga, codiceAsset, asset?.piattaforma ?? ''), d),
              )
            }
          >
            Censisci tutti i {nonCensiti.length} non censiti
          </button>
        ) : undefined
      }
    >
      <div className="contenitore-tabella">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Account</th>
              <th>Registro</th>
              <th>Piattaforma</th>
              <th>Esito</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {righe.map((riga) => (
              <tr key={`${riga.email}-${riga.esito}`}>
                <td>{riga.nomePersona || <span className="vuoto">non indicata</span>}</td>
                <td className="mono">{riga.email}</td>
                <td>{riga.profiloRegistro || <span className="vuoto">assente</span>}</td>
                <td>{riga.ruoloDichiarato || <span className="vuoto">assente</span>}</td>
                <td>
                  <Pastiglia tipo={CLASSE_CONFRONTO[riga.esito]}>{ESITO_CONFRONTO[riga.esito]}</Pastiglia>
                  {riga.esito !== 'ok' && <div className="aiuto-campo">{SPIEGA_CONFRONTO[riga.esito]}</div>}
                </td>
                <td>
                  {riga.esito === 'non-censito' && (
                    <button
                      type="button"
                      className="piccolo"
                      onClick={() =>
                        archivio.aggiorna((d) => censisci(d, riga, codiceAsset, asset?.piattaforma ?? ''))
                      }
                    >
                      Censisci
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Riquadro>
  )
}

/**
 * Collega la riga a una persona dell'anagrafica per indirizzo o per nome. Se
 * non la trova, la crea con lo stato «da verificare» nelle note: un accesso
 * senza persona in anagrafica resterebbe segnalato dal controllo C11, e chi
 * importa non capirebbe perché.
 */
function trovaOCreaPersona(
  documento: Documento,
  riga: RigaRiconciliata,
): { documento: Documento; id: string } {
  const perEmail = documento.persone.find(
    (p) => p.email && normalizzaEmail(p.email) === normalizzaEmail(riga.email),
  )
  if (perEmail) return { documento, id: perEmail.id }

  const perNome = riga.nomePersona
    ? documento.persone.find((p) => p.nome.toLowerCase() === riga.nomePersona.toLowerCase())
    : undefined
  if (perNome) {
    // Si completa l'anagrafica con l'indirizzo trovato sulla piattaforma: è
    // quello con cui la persona accede davvero.
    return {
      documento: {
        ...documento,
        persone: documento.persone.map((p) => (p.id === perNome.id ? { ...p, email: p.email || riga.email } : p)),
      },
      id: perNome.id,
    }
  }

  const id = generaId()
  return {
    documento: {
      ...documento,
      persone: [
        ...documento.persone,
        {
          id,
          nome: riga.nomePersona || riga.email,
          rapportoLavoro: '',
          ruoloAziendale: '',
          stato: 'attivo',
          email: riga.email,
          dataCessazione: null,
          note: 'Aggiunta dall’import di un’estrazione: rapporto di lavoro e ruolo da completare.',
        },
      ],
    },
    id,
  }
}

/**
 * Crea la riga di registro a partire da una riga dell'estrazione che il
 * registro non prevedeva. È il passaggio che rende automatica la prima
 * mappatura: si parte dagli elenchi delle piattaforme invece di scrivere a
 * mano centinaia di righe.
 */
function censisci(
  documento: Documento,
  riga: RigaRiconciliata,
  codiceAsset: string,
  piattaforma: string,
): Documento {
  const persona = trovaOCreaPersona(documento, riga)
  const profilo = riga.profiloRiconosciuto ?? ''
  return {
    ...persona.documento,
    accessi: [
      ...persona.documento.accessi,
      {
        id: generaId(),
        codiceAsset,
        personaId: persona.id,
        profilo,
        email: riga.email,
        stato: 'attivo',
        dataConcessione: null,
        dataUltimaVerifica: null,
        esitoUltimaVerifica: null,
        campagnaVerifica: '',
        verificatoDa: '',
        dataRevoca: null,
        mfaAttiva: 'da-verificare',
        autorizzatoDa: '',
        finalita: '',
        note: `Censito dall’estrazione di ${piattaforma || 'piattaforma'} come "${riga.ruoloDichiarato}".`,
      },
    ],
  }
}
