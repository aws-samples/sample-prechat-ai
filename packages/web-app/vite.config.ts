import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    // Performance optimization: Basic code splitting for vendor libraries
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-cloudscape': ['@cloudscape-design/components', '@cloudscape-design/chat-components'],
          'vendor-utils': ['axios', 'react-router-dom', 'react-markdown']
        }
      }
    },
    // Performance optimization: Enable compression and minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true
      }
    },
    // Performance optimization: Set chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  // Performance optimization: Enable dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@cloudscape-design/components',
      '@cloudscape-design/chat-components'
    ]
  }
})