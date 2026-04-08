import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/theme';
import App from './App';
import { GlobalLoadingIndicator } from './components/GlobalLoadingIndicator';
import './index.css';
import { ToastProvider } from './lib/toast';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <GlobalLoadingIndicator />
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>,
);
