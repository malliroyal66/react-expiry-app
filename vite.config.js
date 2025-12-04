// vite.config.js or vite.config.ts

import { defineConfig } from 'vite';

export default defineConfig({
  // ... other configuration ...
  server: {
    proxy: {
      // 1. Requests starting with '/groww-api' from your frontend...
      '/groww-api': {
        // 2. ...are routed to the external domain.
        target: 'https://growwapi-assets.groww.in', 
        
        // 3. Essential for cross-origin targets
        changeOrigin: true, 
        
        // 4. Rewrites the path: '/groww-api/instruments/instrument.csv' 
        //    becomes '/instruments/instrument.csv' for the Groww server.
        rewrite: (path) => path.replace(/^\/groww-api/, ''), 
      },
    },
  },
});