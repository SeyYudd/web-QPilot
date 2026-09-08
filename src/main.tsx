import React from 'react'
import ReactDOM from 'react-dom/client'
import * as XLSX from 'xlsx'
import { ThemeProvider } from 'next-themes'
import AppRouter from './AppRouter'
import './assets/styles/globals.css'

window.XLSX = XLSX

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="data-theme"
      themes={["orange-light", "blue-light", "coral-light", "orange-dark", "blue-dark", "coral-dark"]}
      defaultTheme="orange-light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AppRouter />
    </ThemeProvider>
  </React.StrictMode>,
)