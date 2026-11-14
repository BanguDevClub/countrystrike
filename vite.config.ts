import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site is published as a project page on GitHub Pages.
// https://banguDevClub.github.io/countrystrike/
// The base is not countrystrike.com
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
