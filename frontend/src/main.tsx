import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { UserProvider } from "./context/user";
import App from './App.tsx'
import '@google/model-viewer';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </StrictMode>,
)
