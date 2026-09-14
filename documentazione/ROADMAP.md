# Roadmap

Stato dei lavori. Quello che c'è, quello che manca, e quello che è stato deciso di non fare.

## Fatto

- **Catalogo** — 121 profili autorizzativi su 14 piattaforme con dati trattati, attività di trattamento e livello di rischio; 14 fornitori con ruolo privacy, trasferimenti extra-UE e riferimenti contrattuali; elenchi per i menu; guide di reperimento per piattaforma.
- **Core** — documento con `schemaVersion` e migrazioni, derivazioni dal catalogo, 17 controlli automatici, riconciliazione a quattro esiti, campagne di verifica, cruscotto.
- **Import guidato** — parser per CSV, TSV e testo incollato, riconoscimento colonne, mappatura dei ruoli dichiarati, anteprima prima della conferma.
- **Esportazioni** — JSON (backup completo reimportabile), Excel, PDF (scheda asset, registro, controlli, verbale di chiusura campagna).
- **App desktop** — setup iniziale accompagnato, cruscotto, anagrafica asset, registro accessi, import, controlli, persone, esportazioni.

## Prossimi passi

**Connettori API in sola lettura.** L'ordine è dettato da quanto costa ottenerli, non da quanto sono utili:

1. **Google** — GA4 Admin API e Google Ads API danno l'elenco utenti con un OAuth normale. Serve un progetto Google Cloud; per Google Ads anche un developer token. È il connettore da fare per primo perché non dipende dall'approvazione di nessuno.
2. **Shopify e WordPress** — token dell'amministratore del negozio o del sito, nessuna review.
3. **TikTok** — Business API, richiede una app approvata ma il processo è più breve di quello di Meta.
4. **Meta e LinkedIn** — Business Management API e Marketing API richiedono App Review del fornitore: settimane di attesa, esito non garantito. Restano su import guidato finché non c'è una app approvata. Fingere il contrario nella pianificazione non accorcia i tempi.

Un connettore non deve poter scrivere: `scope` in sola lettura, sempre. Le credenziali nel portachiavi del sistema operativo, mai nel documento.

**Promemoria delle scadenze.** L'asset ha già `prossimaVerifica`. Manca l'avviso all'apertura e l'apertura automatica della campagna quando la data si avvicina.

**Verifica puntuale fuori campagna.** La revisione non va fatta solo a calendario: a ogni cessazione, cambio di ruolo o fine contratto con un cliente serve un percorso breve "questa persona è uscita, mostrami tutto quello che le va revocato" che non richieda di aprire una campagna semestrale.

**Firma delle esportazioni.** Un hash del documento riportato sul PDF, perché il DPO possa dire che il file che ha in mano è quello generato quel giorno.

## Deciso di non fare

**Multiutente e server condiviso.** È stata una scelta esplicita: applicativo locale su una macchina, esportazioni come mezzo di condivisione. Quando servirà lavorare in più persone contemporaneamente il modello dati è già pronto per la migrazione, ma aggiungere un server adesso vorrebbe dire ospitare dati personali di collaboratori e clienti senza averne bisogno.

**Scrittura sulle piattaforme.** Mapicy non revoca accessi. La revoca si esegue sulla piattaforma e poi si registra qui con la data. Un applicativo che può togliere l'accesso a ventisette persone con un clic sbagliato è un rischio operativo che non vale la comodità.

**Conservare le estrazioni per sempre.** Sono dati personali con una finalità precisa e a tempo: servono a riconciliare una campagna. Le estrazioni vecchie di due campagne non servono a niente e vanno tolte. Non è ancora implementato ed è il primo debito da pagare.
