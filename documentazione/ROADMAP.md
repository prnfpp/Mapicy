# Roadmap

Stato dei lavori. Quello che c'è, quello che manca, e quello che è stato deciso di non fare.

## Fatto

- **Catalogo** — 121 profili autorizzativi su 14 piattaforme con dati trattati, attività di trattamento e livello di rischio; 14 fornitori con ruolo privacy, trasferimenti extra-UE e riferimenti contrattuali; elenchi per i menu; guide di reperimento per piattaforma.
- **Core** — documento con `schemaVersion` e migrazioni, derivazioni dal catalogo, 17 controlli automatici, riconciliazione a quattro esiti, campagne di verifica, cruscotto.
- **Import guidato** — parser per CSV, TSV e testo incollato, riconoscimento colonne, mappatura dei ruoli dichiarati, anteprima prima della conferma.
- **Esportazioni** — JSON (backup completo reimportabile), Excel, PDF (scheda asset, registro, controlli, verbale di chiusura campagna).
- **App desktop** — setup iniziale accompagnato in cinque passi, cruscotto, controlli, registro accessi, asset, persone, import, esportazioni, archivio e impostazioni. Salvataggio automatico ritardato, copie di sicurezza a ogni scrittura che cambia qualcosa, accesso con Google Workspace opzionale.
- **Due verifiche automatiche** — una guida l'interfaccia in un browser, l'altra l'applicativo Electron vero, comprese le operazioni su disco e la generazione del PDF. Vedi il README.

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

**Conservare le estrazioni per sempre.** Sono dati personali con una finalità precisa e a tempo: servono a riconciliare una campagna. Un import sostituisce le righe dell'asset che riguarda, quindi non si accumulano fotografie dello stesso asset; ma le righe di un asset dismesso restano, e non esiste ancora una cancellazione periodica. È il primo debito da pagare.

## Difetti trovati dalle verifiche automatiche e corretti

Vale tenerne traccia, perché dicono a che cosa servono quelle due verifiche:

- I `label` non erano associati ai campi: il controllo stava accanto all'etichetta, non dentro. Chi usa un lettore di schermo non sentiva il nome del campo.
- Un nuovo asset nasceva con la prima piattaforma in ordine alfabetico già selezionata, e si poteva salvare una Pagina Facebook come account Brevo per distrazione.
- Il riquadro di sintesi del cruscotto era verde anche con quattro controlli da correggere.
- La chiusura della finestra non attendeva il salvataggio in coda, e lasciava accanto all'archivio un file temporaneo che faceva pensare a un archivio rotto.
- Lo script che genera gli alias dei ruoli ha intercettato due mappature che puntavano a profili inesistenti, prima che entrassero nel catalogo.
