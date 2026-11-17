import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const miniappRoot = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  // Display source lives in /Display/app/terminal but shares this app's React runtime.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: [searchForWorkspaceRoot(miniappRoot), resolve(miniappRoot, '../../Display/app')] } },
  build: { commonjsOptions: { include: [/node_modules/, /src\/vendor\//] } },
});
