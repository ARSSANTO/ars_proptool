import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { isEnvBrowser } from '@/lib/nui';
import '@/styles/index.css';

if (import.meta.env.DEV && isEnvBrowser()) {
  void import('@/devMocks').then((mocks) => mocks.seedDevEditor());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
