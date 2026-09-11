import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-accordion',
            '@radix-ui/react-progress',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            'framer-motion',
            'lucide-react',
            'recharts',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'sonner',
            'cmdk',
            'vaul',
            'next-themes',
          ],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ai': [
            '@mediapipe/tasks-vision',
            '@xenova/transformers',
            'onnxruntime-web',
          ],
        },
      },
    },
  },
}));
