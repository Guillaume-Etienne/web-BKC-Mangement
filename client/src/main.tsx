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
// The mouse-up that ends the click moves the caret to the click point and drops
// the selection, so the first mouse-up after focusing a number field is cancelled.
// Only a focus caused by a mouse press arms this: a Tab focus must not cancel
// the next real click inside the field.
let mousePressOnNumber = false
let numberFocusPending: HTMLInputElement | null = null
document.addEventListener('mousedown', e => {
  mousePressOnNumber = e.target instanceof HTMLInputElement && e.target.type === 'number'
})
document.addEventListener('focusin', e => {
  const t = e.target
  if (mousePressOnNumber && t instanceof HTMLInputElement && t.type === 'number') {
    numberFocusPending = t
    setTimeout(() => t.select(), 0)
  }
})
document.addEventListener('mouseup', e => {
  if (numberFocusPending && e.target === numberFocusPending) {
    e.preventDefault()
  }
  numberFocusPending = null
  mousePressOnNumber = false
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
