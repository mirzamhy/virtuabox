import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { shareServer } from './server/share.mjs';

export default defineConfig({
  plugins: [react(), shareServer()],
  // host: true lets phones on the same Wi-Fi reach the share page.
  server: { port: 5197, strictPort: true, host: true },
  preview: { host: true },
});
