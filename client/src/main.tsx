import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installGlobalErrorReporting } from './utils/reportClientError'

// Before the first render: what breaks in a promise or an event handler never
// reaches an error boundary, and on a shared link there is nobody to notice.
installGlobalErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
