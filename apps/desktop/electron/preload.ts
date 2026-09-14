import { contextBridge, ipcRenderer } from 'electron'
import { CANALI, CHIUSURA, type ApiMapicy } from './ponte.js'

/**
 * L'unico punto di contatto fra l'interfaccia e il resto del mondo.
 *
 * L'interfaccia non ha accesso a Node (`nodeIntegration: false`,
 * `contextIsolation: true`): tutto passa da qui, su canali dichiarati uno per
 * uno. Non è cerimonia — in questo applicativo si incollano elenchi copiati
 * dalle piattaforme, e questa separazione è quello che impedisce a un testo
 * incollato di raggiungere il disco.
 */
const api: ApiMapicy = {
  allaChiusura: (salva) => {
    ipcRenderer.on(CHIUSURA.richiesta, () => {
      // Qualunque esito: il processo principale va sbloccato, altrimenti la
      // finestra non si chiude più. Un salvataggio fallito è già segnalato
      // nell'interfaccia.
      void salva().finally(() => ipcRenderer.send(CHIUSURA.pronta))
    })
  },
  apriPredefinito: () => ipcRenderer.invoke(CANALI.apriPredefinito),
  salva: (documento) => ipcRenderer.invoke(CANALI.salva, documento),
  scegliArchivio: () => ipcRenderer.invoke(CANALI.scegliArchivio),
  ripristinaDaBackup: () => ipcRenderer.invoke(CANALI.ripristinaDaBackup),
  esporta: (richiesta) => ipcRenderer.invoke(CANALI.esporta, richiesta),
  leggiFileTesto: () => ipcRenderer.invoke(CANALI.leggiFileTesto),
  infoArchivio: () => ipcRenderer.invoke(CANALI.infoArchivio),
  mostraArchivioNelSistema: () => ipcRenderer.invoke(CANALI.mostraArchivioNelSistema),
  copieDiSicurezza: () => ipcRenderer.invoke(CANALI.copieDiSicurezza),
  ripristinaCopia: (nome) => ipcRenderer.invoke(CANALI.ripristinaCopia, nome),
  impostazioni: () => ipcRenderer.invoke(CANALI.impostazioni),
  salvaImpostazioni: (impostazioni) => ipcRenderer.invoke(CANALI.salvaImpostazioni, impostazioni),
  identita: () => ipcRenderer.invoke(CANALI.identita),
  accediConGoogle: () => ipcRenderer.invoke(CANALI.accediConGoogle),
  esci: () => ipcRenderer.invoke(CANALI.esci),
}

contextBridge.exposeInMainWorld('mapicy', api)
