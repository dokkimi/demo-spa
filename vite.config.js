import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Use the new JSX runtime
      jsxRuntime: 'automatic',
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true, // Allow all hosts (needed for Dokkimi dev mode)
  },
  // Use relative base path so assets work when served from subpath
  // This makes all asset paths relative instead of absolute
  base: './',
  build: {
    assetsDir: 'assets',
    // Ensure React and ReactDOM are bundled
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        // Use relative paths for assets
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
