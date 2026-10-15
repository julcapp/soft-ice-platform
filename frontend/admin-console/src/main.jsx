import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { App } from './App';
import { AdminAuthGate } from './AdminAuthGate';
import { ServiceConsoleRoot } from './ServiceWorkspace';
import { NavigationSaveProvider } from './NavigationSave';
import './styles.css';
import './service-workspace.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><AdminErrorBoundary><AdminAuthGate><NavigationSaveProvider><ServiceConsoleRoot><App /></ServiceConsoleRoot></NavigationSaveProvider></AdminAuthGate></AdminErrorBoundary></React.StrictMode>);
