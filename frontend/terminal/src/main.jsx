import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './agreed-flow.css';
import './visual-fixes.css';
import './terminal-portrait.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
