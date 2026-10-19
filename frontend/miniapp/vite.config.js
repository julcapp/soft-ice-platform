import { defineConfig } from 'vite';
export default defineConfig({
  build: { commonjsOptions: { include: [/node_modules/, /src\/vendor\//] } },
});
