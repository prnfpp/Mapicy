import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './stile.css'

const radice = document.getElementById('radice')
if (!radice) throw new Error("Manca l'elemento #radice nella pagina.")

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
