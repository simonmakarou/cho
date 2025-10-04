import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change `base` to '/ВАШЕ_ИМЯ_РЕПОзитория/' если деплоите на GitHub Pages как project pages.
export default defineConfig({
  plugins: [react()],
  base: ''
})
