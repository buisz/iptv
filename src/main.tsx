import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { markFlexGapSupport } from './lib/legacyCss'
import './index.css'

markFlexGapSupport() // oude-TV-fallback: markeer ontbrekende flex-gap-support

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
