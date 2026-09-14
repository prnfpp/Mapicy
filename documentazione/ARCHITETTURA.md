# Architettura

Documento tecnico. Spiega com'è fatto Mapicy e, dove serve, perché è fatto così invece che in un altro modo ragionevole.

## Principi

1. **I profili delle piattaforme sono dati, non codice.** Nessuna descrizione di un ruolo Meta o Google compare in un file `.ts`. Stanno in `packages/catalogo/dati`, con un campo `verificato` e la data dell'ultimo controllo. I fornitori rinominano i ruoli quando vogliono: aggiornare il catalogo deve essere una modifica a un JSON, non un rilascio.
2. **Il core è puro.** Nessun accesso a rete, disco, DOM o orologio dentro `packages/core`. La data di riferimento entra come parametro esplicito (`oggi`), perché un controllo che dipende dall'orologio di sistema non è testabile e "questo accesso è scaduto" è un'affermazione che deve essere riproducibile.
3. **Nessun backend.** Non per minimalismo: un server che raccoglie l'elenco di chi ha accesso a cosa presso i clienti di un'agenzia è un bersaglio, e una responsabilità che il progetto non vuole. L'archivio sta sulla macchina di chi compila, le esportazioni sono file.
4. **Niente credenziali nell'archivio.** Mai password, token o chiavi API nel documento della mappatura. È una regola di prodotto, non un consiglio: il documento viene esportato e mandato al DPO.
5. **Il registro è append-only nella sostanza.** Una revoca non cancella una riga, cambia il suo stato e aggiunge una data. La tracciabilità è parte dell'adempimento: l'accesso revocato tre campagne fa è l'evidenza che la revoca è stata fatta.

## Struttura

```
packages/catalogo    profili autorizzativi, fornitori, elenchi, guide di reperimento
packages/core        tipi, documento, derivazioni, controlli, riconciliazione, campagne
packages/export      generatori JSON / Excel / PDF
apps/desktop         Electron: processo principale (disco, dialoghi, backup) + renderer React
```

`catalogo` non dipende da niente. `core` dipende solo da `catalogo`. `export` dipende da entrambi. `desktop` dipende da tutti e non contiene logica di dominio: se ti trovi a scrivere la regola di un controllo dentro un componente React, sei nel posto sbagliato.

## Il modello dati

Un unico documento JSON per agenzia, con `schemaVersion`. Le migrazioni sono gradini numerati in `documento.ts`: un file scritto con una versione vecchia si aggiorna all'apertura, uno scritto con una versione più nuova viene rifiutato con un messaggio chiaro invece di essere letto male e sovrascritto.

La scelta del JSON invece di SQLite non è pigrizia. Tre ragioni:

- **Il backup è il file.** L'utente ha chiesto di poter salvare tutto per il caso in cui la macchina si rompa. Con un documento JSON, esportare il backup e salvare l'archivio sono la stessa operazione, e il file è leggibile fra dieci anni anche senza Mapicy.
- **Nessun modulo nativo.** `better-sqlite3` va ricompilato per piattaforma e versione di Electron: è la causa più comune di un pacchetto che non si avvia sulla macchina di qualcun altro.
- **I volumi sono piccoli.** Il template Excel da cui nasce il progetto prevedeva 500-800 righe di registro. Anche diecimila accessi restano pochi megabyte e stanno in memoria senza problemi.

Tre entità portano il peso del modello:

**Asset** — una proprietà digitale di un cliente. Ha un `codice` stabile, assegnato una volta e mai modificato, perché è la chiave che lega registro, estrazioni e schede. Chi prova a cambiarlo su un asset già usato nel registro viene fermato.

**Accesso** — una persona su un asset con un profilo. Non ha `datiTrattati`, `attivita` e `rischio` come campi: quelli si derivano dal catalogo con `derivaAccesso()`. Copiarli dentro la riga sembrava comodo e invece congela il testo al giorno in cui è stato scritto, che è esattamente il difetto dell'Excel: si aggiornava il catalogo e le righe vecchie restavano con la descrizione vecchia. Chi ha bisogno del testo congelato per un'evidenza lo ottiene dall'esportazione PDF, che è datata e firmata.

**RigaEstrazione** — quello che la piattaforma dice davvero. Vive separata dal registro e non lo modifica mai da sola. La riconciliazione produce un esito, la decisione resta a chi verifica.

La distinzione che regge tutto il resto è fra **quello che l'agenzia dichiara** (il registro) e **quello che la piattaforma dichiara** (le estrazioni). Tenerle in due posti diversi è ciò che rende possibile trovare gli errori veri: se fossero la stessa tabella, un import sovrascriverebbe la memoria dell'agenzia e la domanda "qualcuno ha un accesso che non risulta autorizzato?" diventerebbe impossibile da porre.

## Le derivazioni

`derivaAccesso(accesso, asset, catalogo)` risolve la terna piattaforma + tipo asset + profilo e restituisce dati trattati, attività e rischio. Se la terna non esiste nel catalogo non inventa niente: restituisce `null` con il motivo, e il controllo C10 lo conta. Un dato mancante dichiarato è meglio di un dato plausibile inventato.

Il livello di rischio è una **classificazione interna**, non una dicitura delle piattaforme: `alto` significa che il profilo può gestire utenti, toccare dati finanziari o esportare dati personali. Sta nel catalogo accanto al profilo perché è una proprietà del profilo, non del singolo accesso.

## I controlli

Diciassette controlli, `C01`-`C17`, ognuno una funzione pura che riceve lo stato e restituisce i casi. Non un booleano: **l'elenco dei casi**, con il riferimento alla riga. Un controllo che dice "ci sono 3 problemi" senza dire quali costringe chi lo usa a cercarli a mano, e allora tanto valeva l'Excel.

La gravità (`bloccante`, `alta`, `media`, `informativo`) è un dato del controllo. Una campagna non si può chiudere con controlli bloccanti aperti: `puoChiudereCampagna()` è la regola, e l'interfaccia la rispetta invece di limitarsi a mostrare un avviso.

Quattro controlli (C02, C03, C04, C05) dipendono dalle estrazioni. Senza estrazioni recenti risultano a zero **senza essere davvero verificati**: il motore distingue i due casi e restituisce `stato: 'non-verificabile'`, perché uno zero che significa "tutto bene" e uno zero che significa "non ho guardato" non possono avere lo stesso aspetto sul cruscotto. Era il difetto più insidioso del file Excel di partenza.

## La riconciliazione

Confronto sulla coppia `codice asset` + `e-mail normalizzata`. Quattro esiti:

| Esito | Significato |
|---|---|
| `ok` | registro e piattaforma coincidono |
| `non-censito` | la piattaforma ha un utente che il registro non prevede — il caso più grave |
| `profilo-diverso` | il privilegio è cambiato senza autorizzazione, o il registro è disallineato |
| `non-riscontrato` | il registro dichiara un accesso attivo che la piattaforma non ha più |

La normalizzazione delle e-mail è minuscolo più spazi tolti, e niente altro. In particolare **non** si rimuovono i punti né i suffissi `+tag`: sono equivalenti su Gmail ma non su tutti i provider, e sbagliare l'accorpamento vuol dire dichiarare "OK" un accesso di una persona diversa.

## L'import guidato

Le piattaforme non esportano nello stesso modo, e alcune non esportano affatto. `packages/core/src/import` contiene un parser tollerante che accetta CSV, TSV e testo incollato, riconosce le colonne dai loro nomi in italiano e in inglese, e dove non ce la fa chiede. Il profilo dichiarato dalla piattaforma viene mappato sul catalogo con `mappaRuoloDichiarato()`, che tenta la corrispondenza esatta, poi quella normalizzata, poi si arrende e lo lascia come testo libero segnalandolo.

L'import non scrive mai direttamente: produce un'anteprima con gli esiti già calcolati, e chi importa conferma. Un import che modifica il registro da solo è un import che nessuno controlla.

## Perché Electron

L'alternativa era un'app web locale da avviare da terminale. L'applicativo lo usa l'amministrazione: `npm start` in un terminale non è un'interfaccia. Electron dà l'icona da cliccare, i dialoghi nativi di salvataggio, e `printToPDF` di Chromium, che genera i PDF per il DPO senza aggiungere una libreria di impaginazione.

Il processo principale è l'unico che tocca il disco. Il renderer non ha accesso a Node (`contextIsolation`, `nodeIntegration: false`) e comunica per IPC su un canale tipizzato dichiarato in `preload`. Non è cerimonia: è quello che impedisce a una stringa incollata dentro un'estrazione di diventare codice eseguito.

## Identità e SSO

Su un applicativo locale il login non è una barriera di sicurezza — i dati sono sul disco di chi lo usa, e la barriera è l'account del sistema operativo con la cifratura del disco. Serve a due altre cose, entrambe concrete: **timbrare il registro** (il campo "verificato da" di ogni riga verificata deve essere un'identità, non un nome digitato a mano) e **riusare la stessa autorizzazione Google** quando arriveranno i connettori API per GA4 e Google Ads.

Quindi: accesso con Google Workspace opzionale e configurabile, flusso OAuth con PKCE su loopback locale, vincolato al dominio dell'agenzia. Senza configurazione l'applicativo funziona comunque con un profilo locale, perché un applicativo che non parte finché non hai creato un progetto su Google Cloud non lo userà nessuno.
