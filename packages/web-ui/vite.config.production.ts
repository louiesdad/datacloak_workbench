import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress TypeScript-related warnings
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        if (warning.message.includes('Use of eval')) return
        warn(warning)
      }
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015'
  },
  esbuild: {
    // Skip type checking
    tsconfigRaw: {
      compilerOptions: {
        jsx: 'react'
      }
    }
  }
})