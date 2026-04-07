import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.jsx'),
      name: 'ChatWidget',
      formats: ['iife'],
    },
    outDir: 'assets',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'chat-widget.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'chat-widget.css'
          return assetInfo.name
        },
      },
    },
  },
})
