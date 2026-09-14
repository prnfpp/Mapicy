# Guida per chi usa Mapicy

Scritta per l'amministrazione e per i project manager. Non serve sapere niente di tecnico.

## Cosa fa questo programma

Tiene l'elenco di **chi accede a cosa**: per ogni cliente, per ogni sua proprietà digitale (la Pagina Facebook, l'account Google Ads, il sito WordPress), quali persone dell'agenzia hanno accesso e con quale profilo. Due volte l'anno si controlla che l'elenco sia ancora vero e si toglie l'accesso a chi non serve più. Il programma tiene il conto, trova gli errori e prepara i documenti per il DPO.

## Il primo avvio

Al primo avvio il programma fa quattro domande e le spiega tutte. In ordine:

1. **Come si chiama l'agenzia** e chi è il referente privacy. Finiscono sui documenti esportati.
2. **Chi lavora in agenzia.** Nome, se è dipendente o partita IVA, che ruolo ha, se è ancora in forza. Si può incollare un elenco da Excel invece di scriverli uno per uno.
3. **Gli asset dei clienti.** Una riga per ogni proprietà di ogni cliente. Il programma assegna da sé un codice — per esempio `ROSSI-META-FB` — e non va più cambiato.
4. **Chi accede a cosa.** Il modo più rapido non è scriverlo a mano: è partire dagli elenchi utenti delle piattaforme. Si va su Meta, Google, LinkedIn, si scarica o si copia l'elenco di chi ha accesso, e il programma costruisce la prima fotografia da lì. Per ogni piattaforma c'è la guida con il percorso esatto: quale menu aprire, dove sta il pulsante di download.

Si può interrompere e riprendere in qualsiasi momento: il setup ricorda dove si era arrivati.

## Quello che si compila da sé

Scelto l'asset e il **profilo autorizzativo** (per esempio "Accesso completo alla Pagina" su una Pagina Facebook), il programma riempie da sé tre cose che nell'Excel si scrivevano a mano ogni volta:

- **la tipologia di dati trattati** — cosa vede concretamente quella persona;
- **la descrizione delle attività** — cosa può fare;
- **il livello di rischio privacy** — alto, medio o basso.

Il menu dei profili cambia in base all'asset: su una Pagina Facebook propone i profili di una Pagina Facebook, non quelli di Google Ads. Sono 121 profili di 14 piattaforme, già scritti e da non riscrivere.

## La revisione semestrale

Si apre una **campagna di verifica** (per esempio `2026-H2`) e si seguono i passi che il programma propone:

1. **Aggiornare le persone** — chi è entrato, chi è uscito, chi ha cambiato ruolo. È il passo che fa emergere il problema più grave: la persona uscita che ha ancora accesso.
2. **Importare gli elenchi dalle piattaforme.** Per ognuna il programma mostra dove andare. Google Analytics e Google Ads hanno un pulsante di download e si carica il file. Meta e LinkedIn non lo hanno: si copia l'elenco dalla pagina e si incolla, il programma lo interpreta.
3. **Partire dai controlli bloccanti.** Il programma ha già trovato gli errori: persone cessate ancora attive, utenti che stanno sulla piattaforma senza essere autorizzati. Si comincia da lì, non dall'inizio dell'elenco.
4. **Decidere riga per riga**: confermare, ridurre il profilo, revocare.
5. **Chiudere la campagna** quando non restano controlli bloccanti, e generare il verbale.

Una cosa importante sull'ordine: **la revoca si esegue prima sulla piattaforma e poi si registra qui.** Il programma non toglie accessi al posto vostro — di proposito, perché un clic sbagliato che revoca l'accesso a mezza agenzia è un danno vero. Qui si registra la data, che è l'evidenza di averlo fatto.

## Perché non si cancellano le righe

Un accesso revocato resta nel registro con stato "Revocato" e la data. Serve a dimostrare che la revoca è stata fatta: se si cancella la riga, l'accesso non è mai esistito e non c'è niente da mostrare. Il programma non permette di cancellare gli accessi revocati.

## Esportare per il DPO e per il backup

Dal menu Esportazioni si sceglie **cosa** (tutto, un singolo cliente, un singolo asset, una campagna) e **in che formato**:

- **PDF** — da mandare al DPO o da allegare a un contratto. Leggibile, datato, stampabile.
- **Excel** — per chi vuole filtrare e fare i suoi conti.
- **JSON** — il backup completo. È l'unico formato che il programma sa **rileggere**: se la macchina si rompe, si installa Mapicy sulla macchina nuova, si carica il JSON e si riparte da dove si era.

Il consiglio: un JSON alla fine di ogni campagna, su un disco o un'area cloud aziendale diversa dalla macchina. Il programma ricorda di farlo alla chiusura della campagna.

## Cose da non fare

- **Non scrivere password, token o chiavi API** in nessun campo, note comprese. Questo archivio viene esportato e mandato al DPO.
- **Non cambiare il codice di un asset** già usato nel registro. Il programma lo impedisce, ma vale sapere perché: è la chiave che tiene insieme tutto.
- **Non considerare chiusa una campagna** con controlli bloccanti aperti.
- **Non fidarsi di un controllo a zero senza estrazioni.** Quattro controlli hanno bisogno degli elenchi scaricati dalle piattaforme: senza quelli il programma scrive "non verificabile" invece di "tutto bene", e la differenza conta.

## Se qualcosa non torna

L'archivio è un unico file sul disco. Il menu Aiuto mostra dove si trova e tiene le ultime copie di sicurezza: si può tornare a una versione precedente senza perdere tutto.
