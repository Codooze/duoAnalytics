// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  build: {
    format: 'file', // Disable directory urls (like /about/index.html to just /about.html)
  },
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});