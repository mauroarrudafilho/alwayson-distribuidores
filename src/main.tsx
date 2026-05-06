import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrapAuthErrorFromHash } from './lib/auth-error-bootstrap.ts'

bootstrapAuthErrorFromHash()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
