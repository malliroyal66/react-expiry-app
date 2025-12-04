import React from 'react';
import { createRoot } from 'react-dom/client';
import ExpiryDataFetcher from './ExpiryDataFetcher';

// Find the root element defined in index.html
const container = document.getElementById('root');
const root = createRoot(container);

// Render the main component
root.render(
  <React.StrictMode>
    <ExpiryDataFetcher />
  </React.StrictMode>
);