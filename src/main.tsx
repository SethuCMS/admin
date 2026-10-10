/**
 * Browser entry point: loads fonts and global styles, then mounts <App />.
 */

import '@fontsource-variable/schibsted-grotesk';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Fail loudly if index.html lost its mount point, rather than rendering
// nothing.
const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
