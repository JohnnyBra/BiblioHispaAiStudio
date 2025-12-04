import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno desde el archivo .env
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Inyecta la variable VITE_API_KEY en process.env.API_KEY
      // Esto es crucial para que la librería @google/genai funcione en el navegador
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
    }
  }
})