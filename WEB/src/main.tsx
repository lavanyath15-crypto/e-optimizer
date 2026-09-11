import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {requireSession} from '@backend/auth.js';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {PlantInputProvider} from './hooks/usePlantInput';
import './index.css';

// Gate the dashboard: without a session this redirects to the login page and
// never mounts the app.
requireSession('/login.html').then((allowed: boolean) => {
  if (!allowed) return;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <PlantInputProvider>
          <App />
        </PlantInputProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
