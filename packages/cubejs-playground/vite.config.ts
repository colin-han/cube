import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to inject useMessageFormatter into react-aria (removed in 3.48+)
function reactAriaShim() {
  const virtualId = 'virtual:react-aria-shim';
  const resolvedVirtualId = '\0' + virtualId;
  return {
    name: 'react-aria-shim',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
    },
    load(id) {
      if (id === resolvedVirtualId) {
        return `
          export { useLocalizedStringFormatter as _useLSF } from 'react-aria';
          export function useMessageFormatter(messages) {
            const formatter = _useLSF(messages);
            return (key) => formatter.format(key);
          }
        `;
      }
    },
    transform(code, id) {
      // Patch @cube-dev/ui-kit Dialog to use shim instead of react-aria
      if (id.includes('@cube-dev/ui-kit') && id.includes('Dialog/Dialog.js')) {
        return code.replace(
          "import { useDialog, useMessageFormatter } from 'react-aria'",
          "import { useDialog } from 'react-aria'\nimport { useMessageFormatter } from 'virtual:react-aria-shim'"
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: 'build',
    target: 'es2020',
  },
  server: {
    port: 3080,
    proxy: {
      '^/playground/*': 'http://localhost:4000',
      '^/cubejs-api/*': 'http://localhost:4000',
    },
  },
  plugins: [
    react(),
    reactAriaShim(),
  ],
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        additionalData: '@root-entry-name: default;',
      },
    },
  },
  define: {
    'process.env.SC_DISABLE_SPEEDY': JSON.stringify('false'),
    ...(mode === 'development' ? { global: {} } : {}),
  },
}));
