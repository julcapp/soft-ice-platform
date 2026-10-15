import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AdminAuthGate } from './AdminAuthGate';
import { ServiceConsoleRoot } from './ServiceWorkspace';
import { NavigationSaveProvider } from './NavigationSave';
import './styles.css';
import './service-workspace.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><AdminAuthGate><NavigationSaveProvider><ServiceConsoleRoot><App /></ServiceConsoleRoot></NavigationSaveProvider></AdminAuthGate></React.StrictMode>);
