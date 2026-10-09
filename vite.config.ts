import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const enableHmr = process.env.ENABLE_HMR === 'true';

  const disableHmrClient = {
    name: 'disable-hmr-client',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      if (enableHmr) return html;

      return html
        .replace(
          /<script\b[^>]*src=["']\/@vite\/client["'][^>]*><\/script>\s*/gi,
          ''
        )
        .replace(
          /<script\b[^>]*>[\s\S]*?\/@react-refresh[\s\S]*?<\/script>\s*/gi,
          ''
        );
    },
  };

  return {
    plugins: [disableHmrClient, react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // The embedded public Preview does not proxy Vite's HMR WebSocket.
      // Opt in locally with ENABLE_HMR=true when a live-reload socket is available.
      hmr: enableHmr,
      watch: enableHmr ? {} : null,
    },
  };
});
