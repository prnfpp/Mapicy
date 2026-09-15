# Come provare Mapicy

Due strade. La prima serve a **vedere se l'applicativo fa quello che serve**, e richiede dieci minuti e nessuna installazione permanente. La seconda produce **l'installabile vero** da dare all'amministrazione, e va fatta una volta per ogni sistema operativo.

Funziona sia su macOS che su Windows: è la stessa base di codice, e l'unica differenza è il comando finale che costruisce il pacchetto.

---

## Strada 1 — provarlo subito, senza installare niente

### Cosa serve prima

**Node.js versione 20 o successiva.** Si scarica da [nodejs.org](https://nodejs.org) scegliendo la versione **LTS**, e si installa con doppio clic come qualunque altro programma. È l'unico prerequisito: Mapicy non ha bisogno di database, di server, né di compilatori.

Per sapere se è già installato, aprire il Terminale (su Mac) o PowerShell (su Windows) e scrivere:

```
node --version
```

Se risponde con un numero che comincia per `v20`, `v22` o più alto, si può procedere.

### I comandi

Nella stessa finestra del Terminale o di PowerShell, uno per volta:

```
git clone https://github.com/prnfpp/Mapicy.git
cd Mapicy
npm install
npm run avvia
```

Il primo comando scarica il progetto, il terzo scarica le librerie (qualche minuto la prima volta, poi resta in cache), il quarto compila e apre la finestra di Mapicy.

**Se `git` non c'è:** su GitHub, pulsante verde **Code → Download ZIP**, si estrae dove si vuole, si apre il Terminale in quella cartella e si parte da `npm install`. Su Mac, in alternativa, scrivere `git` nel Terminale fa comparire da solo il pannello che lo installa.

**Dove aprire il Terminale nella cartella giusta.** Su Mac: clic destro sulla cartella → *Servizi* → *Nuovo terminale nella cartella*. Su Windows: clic destro dentro la cartella tenendo premuto Maiusc → *Apri finestra di PowerShell qui*.

### Cosa succede

Si apre una finestra sulla configurazione iniziale in cinque passi. La configurazione si può interrompere e riprendere: quello che si inserisce è già salvato.

Per riaprirlo un'altra volta basta `npm run avvia` dalla stessa cartella. La compilazione dalla seconda volta è quasi immediata.

---

## Strada 2 — costruire l'installabile

Dopo aver fatto una volta i passaggi della strada 1, dalla stessa cartella:

```
npm run impacchetta
```

Il risultato compare in `apps/desktop/rilasci`:

| Dove lo lanci | Cosa ottieni |
|---|---|
| **macOS** | un file `.dmg` — si apre, si trascina Mapicy nelle Applicazioni |
| **Windows** | `Mapicy Setup 0.1.0.exe` — installatore normale, con scelta della cartella |

### Il vincolo da sapere prima: non si costruisce per l'altro sistema

**Un `.dmg` per Mac si può costruire soltanto su un Mac.** Non è una scelta di Mapicy: è Apple che richiede strumenti presenti solo su macOS. Allo stesso modo, l'installatore Windows va costruito su Windows.

Quindi, se in agenzia ci sono entrambi, servono due macchine — una volta sola, non a ogni modifica. In alternativa si configura una build automatica su GitHub Actions, che costruisce entrambi a ogni rilascio: è mezza giornata di lavoro e vale la pena solo quando l'applicativo comincia a essere aggiornato con regolarità.

### Il secondo vincolo: l'avviso di sicurezza al primo avvio

L'applicativo non è firmato con un certificato, perché firmarlo costa un abbonamento annuale (99 dollari l'anno per Apple, cifre simili per un certificato Windows). Non è un problema per una prova interna, ma **va saputo prima, perché l'avviso spaventa**:

**Su macOS** — se il `.dmg` è stato costruito sulla stessa macchina dove lo si installa, di solito non compare niente. Se invece il file è stato inviato a un collega, al primo avvio dirà che Mapicy *«non può essere aperto perché proviene da uno sviluppatore non identificato»*. Si risolve così: **clic destro sull'icona → Apri**, e poi *Apri* nella finestra che chiede conferma. Da fare una volta sola.

Se su un Mac con chip Apple dice che l'applicazione *«è danneggiata e non può essere aperta»*, non è danneggiata: è la quarantena che macOS mette sui file scaricati. Si toglie con questo comando nel Terminale:

```
xattr -dr com.apple.quarantine /Applications/Mapicy.app
```

**Su Windows** — comparirà la schermata blu *«Windows ha protetto il PC»*. Si clicca **Ulteriori informazioni** e poi **Esegui comunque**. Anche questa una volta sola.

Se un giorno Mapicy va distribuito a persone fuori dall'agenzia, allora i certificati diventano necessari. Per una prova interna no.

---

## Dove finiscono i dati

Un unico file, in una cartella di sistema:

| Sistema | Percorso |
|---|---|
| **macOS** | `~/Library/Application Support/Mapicy/mapicy-archivio.json` |
| **Windows** | `%APPDATA%\Mapicy\mapicy-archivio.json` |

Accanto c'è `copie-di-sicurezza/`, con le venti versioni precedenti: a ogni salvataggio che cambia qualcosa la versione di prima viene conservata, e dalla sezione *Archivio e impostazioni* si può tornare indietro. Nella stessa sezione c'è il pulsante **Mostra nel sistema**, che apre la cartella senza cercarla a mano.

Il percorso è lo stesso con entrambe le strade: chi prova con `npm run avvia` e poi installa il pacchetto ritrova il suo archivio.

**L'applicativo non manda niente da nessuna parte.** L'unica connessione in uscita è l'accesso con Google Workspace, che è opzionale e va configurato a mano; senza, Mapicy funziona con un profilo locale e non apre nessuna connessione.

---

## Cosa provare, in venti minuti

Il modo utile di provarlo non è cliccare in giro: è portarci **un cliente vero**, perché la domanda a cui rispondere è se trova problemi che non si conoscevano.

1. **Configurazione.** Nome dell'agenzia e referente privacy. Alle persone: incollare l'elenco da un foglio di calcolo — nome, rapporto, ruolo, indirizzo. L'**indirizzo con cui la persona accede** è il campo che conta: è la chiave con cui il confronto la riconosce.

2. **Un asset vero.** Scegliere un cliente e la sua Pagina Facebook, oppure il suo account Google Ads. Mentre si compila, guardare il riquadro a destra: dice in quale menu della piattaforma andare a prendere l'identificativo.

3. **L'elenco vero dalla piattaforma.** Qui si vede se funziona. Andare sulla piattaforma per davvero, nel punto che il riquadro indica, e copiare l'elenco di chi ha accesso. Su Google Analytics e Google Ads c'è un pulsante di download: si scarica il CSV e si carica. Su Meta e LinkedIn no: si seleziona l'elenco nella pagina e si incolla.

4. **Leggere l'esito del confronto.** È il momento che conta. Mapicy dice, riga per riga, se la persona coincide col registro, se ha un permesso diverso, o se **ha accesso senza essere censita**. Nella prima mappatura sarà quasi tutto «non censito», ed è normale: il registro è vuoto. Il pulsante *Censisci tutti* costruisce il registro da quell'elenco, con il profilo già riconosciuto.

5. **Guardare i controlli.** Dopo il censimento compaiono i controlli che l'import non poteva soddisfare: manca la data di concessione, non si sa se l'account ha la verifica in due passaggi, l'accesso non è mai stato verificato. Non sono difetti dell'applicativo: sono le informazioni che l'elenco della piattaforma non contiene e che qualcuno deve mettere.

6. **Esportare.** Dalla sezione *Esporta*, il PDF della scheda asset è quello da far vedere al DPO, e il backup JSON è quello da conservare.

### Le due cose su cui aspettarsi attrito

**I percorsi nei menu possono non corrispondere.** Sei guide su ventotto arrivano dal vostro template e sono attendibili; le altre ventidue le ho ricostruite dalla documentazione pubblica dei fornitori e l'applicativo le segnala come da confermare. Quando una non corrisponde, va corretta in `packages/catalogo/dati/guide.json`: è un file di testo, non codice.

**Il riconoscimento dei ruoli può non essere completo.** Mapicy conosce 121 profili e 91 modi in cui le piattaforme li scrivono in inglese, ma non li ha visti tutti. Un ruolo che non riconosce non blocca l'import: la riga entra col testo della piattaforma e viene segnalata. Quei casi sono la cosa più utile da annotare durante la prova.

---

## Se qualcosa non va

**`npm: command not found` oppure `npm non è riconosciuto`** — Node.js non è installato, o il Terminale era già aperto prima dell'installazione: chiuderlo e riaprirlo.

**`npm install` si ferma con errori di rete** — succede dietro proxy o VPN aziendali. Riprovare, oppure fuori dalla rete dell'ufficio.

**La finestra si apre bianca** — la compilazione dell'interfaccia non è andata a termine. `npm run build` da sola mostra l'errore vero, che `npm run avvia` nasconde.

**L'applicativo dice che l'archivio non è leggibile** — si ripristina una copia dalla sezione *Archivio e impostazioni*. Se non si apre nemmeno, si cancella `mapicy-archivio.json` dalla cartella indicata sopra: ripartirà dalla configurazione iniziale, e le copie restano dove sono.

### Controllare che funzioni senza provarlo a mano

Due comandi eseguono le verifiche automatiche:

```
npm test              i 138 test del core e del catalogo
npm run verifica:ui   guida un browser attraverso tutto il percorso
```

La seconda richiede una volta `npx playwright install chromium`. C'è anche `npm run verifica:electron -w @mapicy/desktop`, che fa lo stesso con l'applicativo vero e controlla archivio su disco, copie di sicurezza ed esportazioni.
