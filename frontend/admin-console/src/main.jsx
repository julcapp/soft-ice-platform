import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AdminAuthGate } from './AdminAuthGate';
import './styles.css';
import './viewport.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminAuthGate>
      <App />
    </AdminAuthGate>
  </React.StrictMode>,
);
