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
npm install          installa le dipendenze
npm run dev          avvia l'app in sviluppo
npm test             esegue i test del core
npm run typecheck    controlla i tipi
npm run impacchetta  crea l'eseguibile per il sistema in uso
```

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
