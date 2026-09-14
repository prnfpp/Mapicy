import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cruscotto, eseguiControlli, type Documento } from '@mapicy/core'
import { FornitoreArchivio, type Archivio, type Sezione, type StatoSalvataggio } from './stato.js'
import { dentroApplicativo, nuovoDocumento, oggi, ponte } from './ponte.js'
import type { Identita, ImpostazioniApp, InfoArchivio } from './ponte.js'
import { Avviso } from './componenti/base.js'
import { Setup } from './schermate/Setup.js'
import { Cruscotto } from './schermate/Cruscotto.js'
import { SchermataAsset } from './schermate/Asset.js'
import { Registro } from './schermate/Registro.js'
import { Importa } from './schermate/Importa.js'
import { Controlli } from './schermate/Controlli.js'
import { Persone } from './schermate/Persone.js'
import { Esporta } from './schermate/Esporta.js'
import { Archivio as SchermataArchivio } from './schermate/Archivio.js'

const VOCI: { chiave: Sezione; titolo: string; sottotitolo: string }[] = [
  { chiave: 'cruscotto', titolo: 'Cruscotto', sottotitolo: 'Come sta la mappatura, e cosa fare adesso' },
  { chiave: 'controlli', titolo: 'Controlli', sottotitolo: 'I problemi che l’applicativo ha già trovato' },
  { chiave: 'registro', titolo: 'Registro accessi', sottotitolo: 'Chi accede a cosa, e con quale profilo' },
  { chiave: 'asset', titolo: 'Asset', sottotitolo: 'Le proprietà digitali dei clienti' },
  { chiave: 'persone', titolo: 'Persone', sottotitolo: 'Chi lavora in agenzia e chi è uscito' },
  { chiave: 'importa', titolo: 'Importa elenchi', sottotitolo: 'Confronta il registro con le piattaforme' },
  { chiave: 'esporta', titolo: 'Esporta', sottotitolo: 'Documenti per il DPO e backup' },
  { chiave: 'archivio', titolo: 'Archivio e impostazioni', sottotitolo: 'Dov’è il file, copie di sicurezza, accesso' },
]

const ATTESA_SALVATAGGIO = 700

export function App() {
  const [documento, setDocumento] = useState<Documento | null>(null)
  const [erroreAvvio, setErroreAvvio] = useState<string | null>(null)
  const [salvataggio, setSalvataggio] = useState<StatoSalvataggio>({ fase: 'fermo' })
  const [identita, setIdentita] = useState<Identita>({ nome: '', email: '', origine: 'locale' })
  const [impostazioni, setImpostazioni] = useState<ImpostazioniApp>({
    clientIdGoogle: '',
    dominioAmmesso: '',
    nomeLocale: '',
  })
  const [info, setInfo] = useState<InfoArchivio | null>(null)
  const [sezione, setSezione] = useState<Sezione>('cruscotto')

  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null)
  const daSalvare = useRef<Documento | null>(null)

  useEffect(() => {
    let annullato = false
    void (async () => {
      try {
        const api = ponte()
        const [aperto, identitaLetta, impostazioniLette, infoLetta] = await Promise.all([
          api.apriPredefinito(),
          api.identita(),
          api.impostazioni(),
          api.infoArchivio(),
        ])
        if (annullato) return
        setDocumento(aperto?.documento ?? nuovoDocumento())
        setIdentita(identitaLetta)
        setImpostazioni(impostazioniLette)
        setInfo(infoLetta)
      } catch (errore) {
        if (!annullato) setErroreAvvio(errore instanceof Error ? errore.message : String(errore))
      }
    })()
    return () => {
      annullato = true
    }
  }, [])

  /**
   * Il salvataggio è automatico e ritardato: si digita in un campo, e la
   * scrittura su disco avviene una volta sola quando si smette. Il salvataggio
   * a comando lo si dimentica, e l'archivio è il lavoro di un semestre.
   */
  const programmaSalvataggio = useCallback((prossimo: Documento) => {
    daSalvare.current = prossimo
    if (attesa.current) clearTimeout(attesa.current)
    attesa.current = setTimeout(() => {
      const documentoDaSalvare = daSalvare.current
      if (!documentoDaSalvare) return
      setSalvataggio({ fase: 'in-corso' })
      void ponte()
        .salva(documentoDaSalvare)
        .then((esito) => setSalvataggio({ fase: 'salvato', quando: esito.salvatoIl }))
        .catch((errore: unknown) =>
          setSalvataggio({
            fase: 'errore',
            messaggio: errore instanceof Error ? errore.message : String(errore),
          }),
        )
    }, ATTESA_SALVATAGGIO)
  }, [])

  /**
   * Un salvataggio in coda non deve andare perso alla chiusura. Il processo
   * principale sospende la chiusura e aspetta che questa funzione abbia
   * finito: qui si può attendere davvero la scrittura su disco, che con
   * `beforeunload` non era possibile.
   */
  useEffect(() => {
    ponte().allaChiusura(async () => {
      if (!attesa.current || !daSalvare.current) return
      clearTimeout(attesa.current)
      attesa.current = null
      await ponte().salva(daSalvare.current)
    })
  }, [])

  const aggiorna = useCallback(
    (modifica: (documento: Documento) => Documento) => {
      setDocumento((corrente) => {
        if (!corrente) return corrente
        const prossimo = modifica(corrente)
        programmaSalvataggio(prossimo)
        return prossimo
      })
    },
    [programmaSalvataggio],
  )

  const sostituisci = useCallback(
    (prossimo: Documento) => {
      setDocumento(prossimo)
      programmaSalvataggio(prossimo)
    },
    [programmaSalvataggio],
  )

  const archivio: Archivio | null = useMemo(() => {
    if (!documento) return null
    return {
      documento,
      identita,
      impostazioni,
      info,
      salvataggio,
      aggiorna,
      sostituisci,
      ricaricaIdentita: async () => setIdentita(await ponte().identita()),
      aggiornaImpostazioni: async (nuove) => setImpostazioni(await ponte().salvaImpostazioni(nuove)),
      ricaricaInfo: async () => setInfo(await ponte().infoArchivio()),
      operatore: () => identita.nome || impostazioni.nomeLocale || documento.agenzia.referentePrivacy || '',
    }
  }, [documento, identita, impostazioni, info, salvataggio, aggiorna, sostituisci])

  if (erroreAvvio) {
    return (
      <div className="contenuto" style={{ maxWidth: 680, margin: '60px auto' }}>
        <h1>Mapicy non è riuscito ad aprire l’archivio</h1>
        <Avviso tono="allerta" titolo="Dettaglio dell’errore">
          <p>{erroreAvvio}</p>
          <p>
            Se l’archivio è danneggiato si può ripristinare una copia di sicurezza: le copie stanno nella cartella
            dati dell’applicativo e ne vengono tenute le venti più recenti.
          </p>
        </Avviso>
      </div>
    )
  }

  if (!archivio) return <div className="caricamento">Apertura dell’archivio…</div>

  if (!archivio.documento.setup.completato) {
    return (
      <FornitoreArchivio value={archivio}>
        <Setup />
      </FornitoreArchivio>
    )
  }

  const stato = cruscotto(archivio.documento, oggi())
  const anomalie = eseguiControlli(archivio.documento, oggi()).filter((c) => c.stato === 'da-correggere')
  const bloccanti = anomalie.filter((c) => c.gravita === 'bloccante').length
  const voceCorrente = VOCI.find((v) => v.chiave === sezione)!

  const conteggi: Partial<Record<Sezione, { valore: number; allerta: boolean }>> = {
    controlli: { valore: anomalie.length, allerta: bloccanti > 0 },
    registro: { valore: stato.accessiAttivi, allerta: false },
    asset: { valore: stato.assetAttivi, allerta: false },
    persone: { valore: archivio.documento.persone.filter((p) => p.stato === 'attivo').length, allerta: false },
  }

  return (
    <FornitoreArchivio value={archivio}>
      <div className="telaio">
        <nav className="laterale" aria-label="Sezioni">
          <div className="marchio">
            <strong>Mapicy</strong>
            <span>{archivio.documento.agenzia.nome || 'Mappatura degli accessi'}</span>
          </div>
          {VOCI.map((voce, indice) => (
            <div key={voce.chiave}>
              {indice === VOCI.length - 2 && <div className="separatore-laterale" />}
              <button
                type="button"
                className="voce"
                aria-current={sezione === voce.chiave ? 'page' : undefined}
                onClick={() => setSezione(voce.chiave)}
              >
                {voce.titolo}
                {conteggi[voce.chiave] && conteggi[voce.chiave]!.valore > 0 && (
                  <span className={`conteggio${conteggi[voce.chiave]!.allerta ? ' allerta' : ''}`}>
                    {conteggi[voce.chiave]!.valore}
                  </span>
                )}
              </button>
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <div className="aiuto-campo">
              {archivio.documento.campagnaCorrente
                ? `Campagna in corso: ${archivio.documento.campagnaCorrente}`
                : 'Nessuna campagna aperta'}
            </div>
            <div className="aiuto-campo" style={{ marginTop: 4 }}>
              {archivio.identita.origine === 'google'
                ? `${archivio.identita.nome} (Google)`
                : archivio.impostazioni.nomeLocale || 'Profilo locale'}
            </div>
            {!dentroApplicativo() && (
              <div className="aiuto-campo" style={{ marginTop: 8 }}>
                Anteprima nel browser: i file non vengono salvati sul disco.
              </div>
            )}
          </div>
        </nav>

        <main className="area">
          <header className="testa">
            <div className="crescita">
              <h1>{voceCorrente.titolo}</h1>
              <p className="sottotesta">{voceCorrente.sottotitolo}</p>
            </div>
            <IndicatoreSalvataggio stato={salvataggio} />
          </header>
          <div className="contenuto">
            {sezione === 'cruscotto' && <Cruscotto vaiA={setSezione} />}
            {sezione === 'controlli' && <Controlli vaiA={setSezione} />}
            {sezione === 'registro' && <Registro />}
            {sezione === 'asset' && <SchermataAsset />}
            {sezione === 'persone' && <Persone />}
            {sezione === 'importa' && <Importa />}
            {sezione === 'esporta' && <Esporta />}
            {sezione === 'archivio' && <SchermataArchivio />}
          </div>
        </main>
      </div>
    </FornitoreArchivio>
  )
}

function IndicatoreSalvataggio({ stato }: { stato: StatoSalvataggio }) {
  if (stato.fase === 'fermo') return null
  if (stato.fase === 'in-corso') return <span className="stato-salvataggio">Salvataggio…</span>
  if (stato.fase === 'salvato') {
    const ora = new Date(stato.quando).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    return <span className="stato-salvataggio">Salvato alle {ora}</span>
  }
  return <span className="stato-salvataggio errore" title={stato.messaggio}>Salvataggio non riuscito</span>
}
