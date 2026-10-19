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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
