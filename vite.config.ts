
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      // Optimizar el sistema de vigilancia de archivos
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/.output/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/tmp/**',
        '**/temp/**',
        '**/*.log',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      // Usar polling en lugar de watchers nativos si es necesario
      usePolling: false,
      // Reducir la cantidad de archivos vigilados simultáneamente
      interval: 1000,
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimizaciones adicionales
  optimizeDeps: {
    exclude: ['lovable-tagger'],
  },
  build: {
    // Reducir la cantidad de chunks para evitar demasiados archivos
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
}));
