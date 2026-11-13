import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SessionProvider } from './cloud/Session';

createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <App />
  </SessionProvider>
);

// Offline shell + installability. Production only, so development never serves stale files.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* not available (private mode, http): the app works without it */
    });
  });
}
