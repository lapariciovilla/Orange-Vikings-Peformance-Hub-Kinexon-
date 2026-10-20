import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary
        fallbackTitle="Orange Vikings Performance Hub"
        fallbackDescription="The application encountered an initialization issue. Local performance records and roster remain safe."
      >
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  console.error("Root element with id 'root' was not found in the DOM.");
}
