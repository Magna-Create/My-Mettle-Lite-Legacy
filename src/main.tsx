import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';
import './refinement.css';
import './mobile-hardening.css';
import './phase2.css';
import './phase2-fixes.css';
import './phase2-parity-core.css';
import './phase2-parity-management.css';
import './phase2-parity-data.css';
import './lite.css';
import './lite-layout-fixes.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
