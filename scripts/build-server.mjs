// Bundles the WS relay (server/index.mjs) plus the shared game-logic
// modules it imports (src/lib/gameState.js, src/lib/abilities/logic-index.js,
// and each ability's *.logic.js) into a single standalone file the relay's
// host can run with plain `node`, no bundler/dev-server assistance.
//
// This exists because plain Node ESM can't resolve the `@/` alias (defined
// in jsconfig.json for the Next.js app) or extension-less relative imports
// that the shared logic modules use — esbuild resolves both at bundle time.
//
// Run manually: node scripts/build-server.mjs
// Wired into: npm run build:server (see package.json)
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await build({
  entryPoints: [path.join(root, 'server', 'index.mjs')],
  outfile:     path.join(root, 'dist', 'server.cjs'),
  bundle:      true,
  platform:    'node',
  // CJS, not ESM: `ws` (a CJS package) calls require() on Node built-ins
  // internally, which only works when the bundle itself is CJS — an ESM
  // output bundle's require() shim can't reach real built-ins at runtime.
  format:      'cjs',
  target:      'node18',
  alias:       { '@': path.join(root, 'src') },
  logLevel:    'info',
});
