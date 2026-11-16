const { defineConfig } = require('vite');
const { resolve } = require('node:path');

const backendProxy = {
  target: 'http://13.48.153.251:8081',
  changeOrigin: true,
  configure(proxy) {
    proxy.on('proxyReq', request => {
      // Replit's Vite preview is same-origin to the browser; avoid forwarding
      // the preview Origin header to the production API's stricter CORS rules.
      request.removeHeader('origin');
    });
  }
};

module.exports = defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/health': backendProxy,
      '/analyze': backendProxy,
      '/jobs': backendProxy,
      '/crops': backendProxy,
      '/api': backendProxy,
      '/chat': backendProxy
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        planner: resolve(__dirname, 'planner.html'),
        results: resolve(__dirname, 'results.html')
      }
    }
  }
});
