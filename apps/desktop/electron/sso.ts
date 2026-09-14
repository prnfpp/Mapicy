import { shell } from 'electron'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Identita, ImpostazioniApp } from './ponte.js'

/**
 * Accesso con Google Workspace, flusso per applicazioni installate: codice di
 * autorizzazione con PKCE e reindirizzamento su loopback.
 *
 * Su un applicativo locale questo accesso non è una barriera di sicurezza — i
 * dati sono sul disco di chi lo usa, e la barriera è l'account del sistema
 * operativo con la cifratura del disco. Serve a timbrare il registro con
 * un'identità vera invece di un nome digitato a mano, e a riusare la stessa
 * autorizzazione quando arriveranno i connettori per GA4 e Google Ads.
 *
 * Senza un ID client configurato l'applicativo funziona con un profilo locale:
 * un applicativo che non parte finché non hai creato un progetto su Google
 * Cloud non lo userebbe nessuno.
 */

const AUTORIZZAZIONE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const AMBITI = 'openid email profile'

export class ErroreAccesso extends Error {}

function base64url(dati: Buffer): string {
  return dati.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface Rivendicazioni {
  email?: string
  email_verified?: boolean
  name?: string
  hd?: string
  aud?: string
}

/**
 * Legge le rivendicazioni dell'id_token senza verificarne la firma.
 *
 * È accettabile solo perché il token arriva dalla risposta diretta
 * dell'endpoint di Google su TLS, non dal reindirizzamento nel browser: in
 * questo flusso è la garanzia del canale a fare da garanzia sul token. Se un
 * giorno l'id_token arrivasse da un'altra strada, questa funzione non basta
 * più.
 */
function leggiRivendicazioni(idToken: string): Rivendicazioni {
  const parti = idToken.split('.')
  if (parti.length !== 3) throw new ErroreAccesso('Google ha restituito un id_token in un formato inatteso.')
  return JSON.parse(Buffer.from(parti[1], 'base64').toString('utf8')) as Rivendicazioni
}

function confrontaSicuro(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Attende sul loopback il codice di autorizzazione. Restituisce anche la porta scelta, che serve nell'URL. */
function attendiCodice(statoAtteso: string): {
  porta: Promise<number>
  codice: Promise<string>
  chiudi: () => void
} {
  let risolviPorta: (p: number) => void
  let risolviCodice: (c: string) => void
  let rifiutaCodice: (e: Error) => void
  const porta = new Promise<number>((r) => (risolviPorta = r))
  const codice = new Promise<string>((r, j) => {
    risolviCodice = r
    rifiutaCodice = j
  })

  const server = createServer((richiesta, risposta) => {
    const url = new URL(richiesta.url ?? '/', 'http://127.0.0.1')
    const rispondi = (titolo: string, testo: string) => {
      risposta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      risposta.end(
        `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${titolo}</title></head>` +
          `<body style="font:16px/1.6 system-ui;margin:60px auto;max-width:34em;color:#1a1a1a">` +
          `<h1 style="font-size:20px">${titolo}</h1><p>${testo}</p></body></html>`,
      )
    }

    const errore = url.searchParams.get('error')
    if (errore) {
      rispondi('Accesso non completato', 'Si può chiudere questa finestra e riprovare da Mapicy.')
      rifiutaCodice(new ErroreAccesso(`Google ha rifiutato l'accesso: ${errore}`))
      return
    }
    const ricevuto = url.searchParams.get('code')
    const stato = url.searchParams.get('state')
    if (!ricevuto || !stato) {
      rispondi('Richiesta non valida', 'Si può chiudere questa finestra.')
      return
    }
    if (!confrontaSicuro(stato, statoAtteso)) {
      rispondi('Accesso non completato', 'Il controllo di sicurezza non è andato a buon fine. Riprovare da Mapicy.')
      rifiutaCodice(new ErroreAccesso('Il parametro di stato non corrisponde: accesso interrotto.'))
      return
    }
    rispondi('Accesso completato', 'Si può chiudere questa finestra e tornare a Mapicy.')
    risolviCodice(ricevuto)
  })

  // Solo su loopback: il server non deve essere raggiungibile dalla rete.
  server.listen(0, '127.0.0.1', () => {
    risolviPorta((server.address() as AddressInfo).port)
  })

  return { porta, codice, chiudi: () => server.close() }
}

export async function accediConGoogle(impostazioni: ImpostazioniApp): Promise<Identita> {
  if (!impostazioni.clientIdGoogle) {
    throw new ErroreAccesso(
      "L'accesso con Google Workspace non è configurato. In Impostazioni va inserito l'ID client OAuth " +
        'creato dall\'agenzia su Google Cloud (tipo "Applicazione desktop"). Fino ad allora Mapicy funziona con il profilo locale.',
    )
  }

  const verificatore = base64url(randomBytes(32))
  const sfida = base64url(createHash('sha256').update(verificatore).digest())
  const stato = base64url(randomBytes(16))

  const { porta, codice, chiudi } = attendiCodice(stato)
  try {
    const reindirizzamento = `http://127.0.0.1:${await porta}`
    const url = new URL(AUTORIZZAZIONE)
    url.searchParams.set('client_id', impostazioni.clientIdGoogle)
    url.searchParams.set('redirect_uri', reindirizzamento)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', AMBITI)
    url.searchParams.set('code_challenge', sfida)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('state', stato)
    url.searchParams.set('access_type', 'online')
    if (impostazioni.dominioAmmesso) {
      // Suggerisce a Google di accettare solo il dominio dell'agenzia. È un
      // suggerimento, non una garanzia: la verifica vera è sulla
      // rivendicazione `hd` più sotto.
      url.searchParams.set('hd', impostazioni.dominioAmmesso)
    }

    await shell.openExternal(url.toString())

    const scaduto = new Promise<never>((_, rifiuta) =>
      setTimeout(() => rifiuta(new ErroreAccesso("L'accesso non è stato completato entro cinque minuti.")), 300_000),
    )
    const ricevuto = await Promise.race([codice, scaduto])

    const risposta = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: impostazioni.clientIdGoogle,
        code: ricevuto,
        code_verifier: verificatore,
        grant_type: 'authorization_code',
        redirect_uri: reindirizzamento,
      }),
    })
    if (!risposta.ok) {
      throw new ErroreAccesso(
        `Google non ha rilasciato il token (${risposta.status}). Controllare che l'ID client sia di tipo "Applicazione desktop" ` +
          'e che il flusso PKCE sia consentito per quel client.',
      )
    }
    const dati = (await risposta.json()) as { id_token?: string }
    if (!dati.id_token) throw new ErroreAccesso('Google non ha restituito un id_token.')

    const r = leggiRivendicazioni(dati.id_token)
    if (r.aud !== impostazioni.clientIdGoogle) {
      throw new ErroreAccesso("L'id_token non è stato emesso per questo applicativo.")
    }
    if (!r.email || r.email_verified === false) {
      throw new ErroreAccesso("L'account Google non ha un indirizzo verificato.")
    }
    if (impostazioni.dominioAmmesso && r.hd !== impostazioni.dominioAmmesso) {
      throw new ErroreAccesso(
        `L'account ${r.email} non appartiene al dominio ${impostazioni.dominioAmmesso}, che è quello ammesso in Impostazioni.`,
      )
    }

    return { nome: r.name || r.email, email: r.email, origine: 'google' }
  } finally {
    chiudi()
  }
}
