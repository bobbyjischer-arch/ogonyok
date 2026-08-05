import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupTelegramAsync, setupTelegramSync } from './lib/telegram';
import './index.css';

const container = document.getElementById('root');

// Theme and initData are resolved synchronously so the first paint is already
// in the right colours. Nothing here can await: an unanswered request from the
// Telegram client must never be able to keep React from mounting.
setupTelegramSync();

if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Viewport insets settle a moment later; the layout reflows when they land.
void setupTelegramAsync();
