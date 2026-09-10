import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {requireSession} from '@backend/auth.js';
import App from './App.tsx';
import './index.css';

// Gate the dashboard: without a session this redirects to the login page and
// never mounts the app.
requireSession('/login.html').then((allowed: boolean) => {
  if (!allowed) return;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
