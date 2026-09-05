import React from 'react'
import ReactDOM from 'react-dom/client'
import * as XLSX from 'xlsx'
import AppRouter from './AppRouter'
import './assets/styles/globals.css'

window.XLSX = XLSX

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)