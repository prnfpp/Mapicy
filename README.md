# Mapicy

Mappatura degli accessi e dei trattamenti per un'agenzia di comunicazione. Sostituisce il file Excel che ogni quattro-sei mesi l'amministrazione compila a mano per sapere chi accede a quali proprietà dei clienti.

Applicativo locale: gira sulla macchina di una persona, non ha un server, non manda dati da nessuna parte. Le esportazioni per il DPO e i backup si generano con un clic.

## Che problema risolve

Ogni semestre qualcuno deve rispondere a una domanda semplice e faticosa: **chi, su quale asset di quale cliente, con quale profilo, e serve ancora?** Farlo su un foglio di calcolo significa ricordarsi a memoria i profili di quattordici piattaforme, ricopiare a mano gli elenchi utenti, e fidarsi di chi compila. Gli errori che contano — la persona uscita dall'agenzia che ha ancora accesso, l'utente che compare sulla piattaforma senza essere autorizzato — sono esattamente quelli che un foglio compilato a memoria non trova.

Mapicy fa tre cose che l'Excel non può fare:

1. **Compila da sé quello che è derivabile.** Scelto l'asset e il profilo autorizzativo, la tipologia di dati trattati, la descrizione delle attività e il livello di rischio privacy arrivano dal catalogo: 121 profili su 14 piattaforme, già scritti. Nessuno deve riscriverli.
2. **Confronta il registro con la realtà.** Si incolla o si importa l'elenco utenti esportato dalla piattaforma e il confronto è automatico: coincide, manca, è di troppo, ha un profilo diverso.
3. **Accompagna passo per passo.** Ogni campo dice a cosa serve; ogni piattaforma ha la sua guida con il percorso esatto da seguire per trovare il dato richiesto.

## Requisiti

Node.js 20 o successivo, per lo sviluppo. L'applicativo impacchettato non richiede nulla di installato.

## Comandi

```
npm install             installa le dipendenze
npm test                esegue i test del core e del catalogo
npm run typecheck       controlla i tipi
npm run build           compila interfaccia e processo principale
npm run impacchetta     crea l'eseguibile per il sistema in uso
npm run verifica:ui     guida un browser attraverso tutto il percorso
```

Per lo sviluppo dell'applicativo: `npm run dev -w @mapicy/desktop` avvia l'interfaccia su `http://localhost:5199`, dove funziona con un archivio in memoria. Per la finestra vera, `npm run dev:app -w @mapicy/desktop` con `MAPICY_DEV_URL` impostato su quell'indirizzo.

### Le due verifiche automatiche

`npm run verifica:ui` serve la build a un browser e la guida dall'inizio alla fine — configurazione, import di un elenco, censimento automatico, verifica di un accesso, controlli — e fallisce se la console riporta un errore. Richiede `npx playwright install chromium`.

`npm run verifica:electron -w @mapicy/desktop` fa la stessa cosa con l'applicativo vero, e in più controlla le cose che solo il processo principale può fare: l'archivio scritto su disco e riletto, le copie di sicurezza, la generazione del PDF, e che alla chiusura la coda di salvataggio venga svuotata senza lasciare file temporanei. Serve uno schermo; dove non c'è, `xvfb-run -a`.

## Struttura

```
packages/catalogo    profili delle piattaforme, fornitori, guide "dove trovare il dato"
packages/core        tipi, controlli automatici, riconciliazione, campagne
packages/export      esportazioni JSON, Excel, PDF
apps/desktop         applicativo Electron con interfaccia React
```

Dettagli e ragioni delle scelte in [documentazione/ARCHITETTURA.md](documentazione/ARCHITETTURA.md). Istruzioni per chi lo usa in [documentazione/GUIDA-UTENTE.md](documentazione/GUIDA-UTENTE.md). Stato dei lavori in [documentazione/ROADMAP.md](documentazione/ROADMAP.md).

## Avvertenza

Mapicy è uno strumento di lavoro, non una consulenza. I ruoli privacy dei fornitori, le garanzie sui trasferimenti extra-UE e i riferimenti contrattuali presenti nel catalogo sono stati raccolti dalla documentazione pubblica dei fornitori, cambiano nel tempo e vanno confermati con il consulente privacy o il DPO prima di finire in documentazione ufficiale. L'archivio contiene dati personali di collaboratori: va tenuto su una macchina protetta e i backup in un'area ad accesso limitato.

## Licenza

MIT.
