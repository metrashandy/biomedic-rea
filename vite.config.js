import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <--- Ini tambahan barunya

export default defineConfig({
  plugins:[
    react(),
    tailwindcss(), // <--- Ini juga dipanggil di sini
  ],
})