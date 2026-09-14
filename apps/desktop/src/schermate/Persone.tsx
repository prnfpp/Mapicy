import { useState } from 'react'
import { elenchi } from '@mapicy/catalogo'
import { accessiDaChiudere, type Persona } from '@mapicy/core'
import { useArchivio } from '../stato.js'
import { generaId, oggi } from '../ponte.js'
import { Avviso, Campo, DataBreve, Modale, Pastiglia, Riquadro } from '../componenti/base.js'
import { STATO_PERSONA, numero } from '../etichette.js'

export function personaVuota(): Persona {
  return {
    id: generaId(),
    nome: '',
    rapportoLavoro: elenchi.rapportoLavoro[0] ?? 'Dipendente',
    ruoloAziendale: elenchi.ruoloAziendale[0] ?? '',
    stato: 'attivo',
    email: '',
    dataCessazione: null,
    note: '',
  }
}

export function Persone() {
  const archivio = useArchivio()
  const { documento } = archivio
  const [inModifica, setInModifica] = useState<Persona | null>(null)
  const [incollaggio, setIncollaggio] = useState(false)

  const ordinate = [...documento.persone].sort(
    (a, b) =>
      Number(a.stato === 'cessato') - Number(b.stato === 'cessato') || a.nome.localeCompare(b.nome),
  )
  const cessateConAccessi = documento.persone.filter(
    (p) => p.stato === 'cessato' && accessiDaChiudere(documento, p.id).length > 0,
  )

  return (
    <>
      {cessateConAccessi.length > 0 && (
        <Avviso tono="allerta" titolo="Persone uscite con accessi ancora aperti">
          <p>
            La revisione non va fatta solo a calendario: quando una persona esce, i suoi accessi vanno chiusi
            subito. Queste persone risultano cessate e hanno ancora accessi non revocati.
          </p>
          <ul className="elenco-casi">
            {cessateConAccessi.map((p) => (
              <li key={p.id}>
                <strong>{p.nome}</strong>: {accessiDaChiudere(documento, p.id).join(', ')}
              </li>
            ))}
          </ul>
        </Avviso>
      )}

      <Riquadro
        titolo={`Persone (${documento.persone.length})`}
        didascalia="Chi può accedere alle proprietà dei clienti. Lo stato è il campo che conta: da qui nasce il controllo più grave, la persona uscita che ha ancora accesso."
        azioni={
          <>
            <button type="button" onClick={() => setIncollaggio(true)}>
              Incolla un elenco
            </button>
            <button type="button" className="principale" onClick={() => setInModifica(personaVuota())}>
              Aggiungi una persona
            </button>
          </>
        }
      >
        {ordinate.length === 0 ? (
          <p className="vuoto">Nessuna persona in anagrafica.</p>
        ) : (
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Rapporto</th>
                  <th>Ruolo</th>
                  <th>Account usato</th>
                  <th>Stato</th>
                  <th>Cessazione</th>
                  <th className="num">Accessi aperti</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ordinate.map((persona) => {
                  const aperti = accessiDaChiudere(documento, persona.id).length
                  return (
                    <tr key={persona.id} className={persona.stato === 'cessato' ? 'attenuata' : undefined}>
                      <td>
                        <strong>{persona.nome}</strong>
                      </td>
                      <td>{persona.rapportoLavoro}</td>
                      <td>{persona.ruoloAziendale}</td>
                      <td className="mono">{persona.email || <span className="vuoto">—</span>}</td>
                      <td>
                        <Pastiglia tipo={persona.stato === 'cessato' ? 'medio' : persona.stato === 'sospeso' ? 'neutra' : 'ok'}>
                          {STATO_PERSONA[persona.stato]}
                        </Pastiglia>
                      </td>
                      <td>
                        <DataBreve valore={persona.dataCessazione} />
                      </td>
                      <td className="num">
                        {aperti > 0 ? (
                          <Pastiglia tipo={persona.stato === 'cessato' ? 'alto' : 'neutra'}>{aperti}</Pastiglia>
                        ) : (
                          ''
                        )}
                      </td>
                      <td>
                        <button type="button" className="piatto piccolo" onClick={() => setInModifica(persona)}>
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

      {incollaggio && (
        <IncollaPersone
          chiudi={() => setIncollaggio(false)}
          conferma={(nuove) => {
            archivio.aggiorna((d) => ({ ...d, persone: [...d.persone, ...nuove] }))
            setIncollaggio(false)
          }}
        />
      )}
    </>
  )
}

export function ModificaPersona({
  persona,
  salva,
  chiudi,
}: {
  persona: Persona
  salva: (persona: Persona) => void
  chiudi: () => void
}) {
  const [bozza, setBozza] = useState(persona)
  const modifica = <K extends keyof Persona>(campo: K, valore: Persona[K]) =>
    setBozza((p) => ({ ...p, [campo]: valore }))

  return (
    <Modale titolo={persona.nome ? `Modifica ${persona.nome}` : 'Nuova persona'} chiudi={chiudi}>
      <div className="griglia due">
        <Campo etichetta="Nome e cognome" obbligatorio>
          <input value={bozza.nome} onChange={(e) => modifica('nome', e.target.value)} autoFocus />
        </Campo>
        <Campo
          etichetta="Account usato per gli accessi"
          aiuto="L’indirizzo con cui questa persona entra nelle piattaforme. È la chiave con cui il confronto con le estrazioni la riconosce: se è sbagliato, il confronto la segnalerà come non censita."
        >
          <input
            type="email"
            value={bozza.email}
            onChange={(e) => modifica('email', e.target.value)}
            placeholder="nome.cognome@agenzia.it"
          />
        </Campo>
        <Campo etichetta="Rapporto di lavoro">
          <select value={bozza.rapportoLavoro} onChange={(e) => modifica('rapportoLavoro', e.target.value)}>
            {elenchi.rapportoLavoro.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Ruolo aziendale">
          <input
            value={bozza.ruoloAziendale}
            onChange={(e) => modifica('ruoloAziendale', e.target.value)}
            list="ruoli-aziendali"
          />
          <datalist id="ruoli-aziendali">
            {elenchi.ruoloAziendale.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Campo>
        <Campo
          etichetta="Stato"
          aiuto="«Cessata» è il campo che fa scattare il controllo bloccante sugli accessi ancora attivi."
        >
          <select
            value={bozza.stato}
            onChange={(e) => {
              const stato = e.target.value as Persona['stato']
              setBozza((p) => ({
                ...p,
                stato,
                // Impostare «cessata» senza data lascerebbe il registro senza
                // la data da cui far partire la revoca: si propone oggi.
                dataCessazione: stato === 'cessato' ? (p.dataCessazione ?? oggi()) : null,
              }))
            }}
          >
            {(['attivo', 'sospeso', 'cessato'] as const).map((v) => (
              <option key={v} value={v}>
                {STATO_PERSONA[v]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Data di cessazione">
          <input
            type="date"
            value={bozza.dataCessazione ?? ''}
            disabled={bozza.stato !== 'cessato'}
            onChange={(e) => modifica('dataCessazione', e.target.value || null)}
          />
        </Campo>
      </div>
      <div style={{ marginTop: 14 }}>
        <Campo etichetta="Note">
          <textarea value={bozza.note} onChange={(e) => modifica('note', e.target.value)} />
        </Campo>
      </div>
      <div className="riga-azioni fine">
        <button type="button" onClick={chiudi}>
          Annulla
        </button>
        <button type="button" className="principale" disabled={!bozza.nome.trim()} onClick={() => salva(bozza)}>
          Salva
        </button>
      </div>
    </Modale>
  )
}

/**
 * Inserimento in blocco. L'anagrafica di un'agenzia sta già in un foglio di
 * calcolo o in un gestionale: chiedere di riscrivere trentacinque persone una
 * per una è il modo più rapido per far abbandonare l'applicativo al primo
 * avvio.
 */
export function IncollaPersone({
  conferma,
  chiudi,
}: {
  conferma: (persone: Persona[]) => void
  chiudi: () => void
}) {
  const [testo, setTesto] = useState('')

  const righe = testo
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((riga) => {
      const celle = riga.split(/\t|;|,/).map((c) => c.trim())
      const email = celle.find((c) => c.includes('@')) ?? ''
      const senzaEmail = celle.filter((c) => c !== email)
      return {
        ...personaVuota(),
        nome: senzaEmail[0] ?? '',
        rapportoLavoro: senzaEmail[1] || (elenchi.rapportoLavoro[0] ?? ''),
        ruoloAziendale: senzaEmail[2] ?? '',
        email,
      }
    })
    .filter((p) => p.nome)

  return (
    <Modale
      titolo="Incolla l’elenco delle persone"
      didascalia="Una persona per riga. Le colonne possono essere separate da tabulazione, punto e virgola o virgola — copiare direttamente da Excel funziona."
      chiudi={chiudi}
    >
      <Campo
        etichetta="Elenco"
        aiuto="Ordine delle colonne: nome, rapporto di lavoro, ruolo aziendale, indirizzo e-mail. L’indirizzo viene riconosciuto in qualunque posizione, purché contenga la chiocciola."
      >
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          style={{ minHeight: 190, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
          placeholder={'Mario Rossi\tDipendente\tDigital\tmario.rossi@agenzia.it\nSabrina Fonte\tP.IVA\tDesign\tsabrina.fonte@agenzia.it'}
          autoFocus
        />
      </Campo>

      {righe.length > 0 && (
        <>
          <p className="didascalia" style={{ marginTop: 14 }}>
            Anteprima: {numero(righe.length, 'persona riconosciuta', 'persone riconosciute')}.
          </p>
          <div className="contenitore-tabella">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Rapporto</th>
                  <th>Ruolo</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {righe.slice(0, 12).map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.rapportoLavoro}</td>
                    <td>{p.ruoloAziendale || <span className="vuoto">—</span>}</td>
                    <td className="mono">{p.email || <span className="vuoto">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {righe.length > 12 && <p className="aiuto-campo">…e altre {righe.length - 12}.</p>}
        </>
      )}

      <div className="riga-azioni fine">
        <button type="button" onClick={chiudi}>
          Annulla
        </button>
        <button type="button" className="principale" disabled={righe.length === 0} onClick={() => conferma(righe)}>
          Aggiungi {righe.length > 0 ? numero(righe.length, 'persona', 'persone') : ''}
        </button>
      </div>
    </Modale>
  )
}
