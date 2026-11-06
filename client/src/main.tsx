import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installGlobalErrorReporting } from './utils/reportClientError'
import { reloadForNewVersion } from './utils/chunkReload'

// Before the first render: what breaks in a promise or an event handler never
// reaches an error boundary, and on a shared link there is nobody to notice.
installGlobalErrorReporting()

// Vite's own signal that a preloaded chunk of an older deploy is gone. Reload
// before the import rejects, rather than after the page has crashed.
window.addEventListener('vite:preloadError', e => {
  if (reloadForNewVersion()) e.preventDefault()
})

// Number fields: select the whole value when focused, so typing replaces it
// instead of editing digit by digit ("12" → "5" without keeping the "1").
// The timeout lets the click's own selection settle before we select.
document.addEventListener('focusin', e => {
  const t = e.target
  if (t instanceof HTMLInputElement && t.type === 'number') {
    setTimeout(() => t.select(), 0)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
