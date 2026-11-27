import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, new URL('.', import.meta.url).pathname, 'API_')
  const proxy = { '/api': { target: environment.API_PROXY_TARGET || 'http://127.0.0.1:3000' } }
  return { plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy } }
})
