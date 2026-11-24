import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react';
import { installGlobalErrorMonitoring } from './lib/errorMonitoring.ts';
import App from './App.tsx';
import './index.css';

installGlobalErrorMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
      <Analytics />
    </HelmetProvider>
  </StrictMode>,
);
