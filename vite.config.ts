import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Helper untuk membuat konfigurasi proxy dengan Origin/Referer yang dinamis sesuai target
function createProxyConfig(targetDomain: string) {
  return {
    target: targetDomain,
    changeOrigin: true,
    secure: false,
    configure: (proxy: unknown) => {
      const server = proxy as { on: (event: string, cb: (...args: unknown[]) => void) => void };
      server.on('proxyReq', (...args) => {
        const proxyReq = args[0] as { 
          removeHeader?: (name: string) => void;
          setHeader?: (name: string, value: string) => void;
        };
        const req = args[1] as { url?: string };

        if (typeof proxyReq.removeHeader === 'function') {
          // 1. Hapus cookie session pengganggu
          proxyReq.removeHeader('cookie');
          proxyReq.removeHeader('cookie2');
          
          // 2. Hapus Origin & Referer bawaan browser (localhost)
          proxyReq.removeHeader('origin');
          proxyReq.removeHeader('referer');
        }

        if (typeof proxyReq.setHeader === 'function') {
          // 3. Timpa Origin & Referer ke domain target yang tepat
          proxyReq.setHeader('Origin', targetDomain);
          proxyReq.setHeader('Referer', `${targetDomain}/`);
        }

        console.log(`[vite-proxy] sanitized Origin (${targetDomain}) & Cookie for ${req?.url || ''}`);
      });
    },
  };
}

/// <reference types="vitest/config" />
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy untuk Jira BRI
      '/api/jira-proxy': {
        ...createProxyConfig('https://jira.bri.co.id'),
        rewrite: (p) => p.replace(/^\/api\/jira-proxy/, ''),
      },
      // Proxy untuk Confluence BRI
      '/api/confluence-proxy': {
        ...createProxyConfig('https://confluence.bri.co.id'),
        rewrite: (p) => p.replace(/^\/api\/confluence-proxy/, ''),
      },
    },
  },
});