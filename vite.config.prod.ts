import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ autoCodeSplitting: true }),
    netlify(),
    react(),
    yaml(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})

export const test = {
  globals: true,
  environment: 'jsdom',
}
