import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { stage } from './stage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

async function runBuild() {
  stage();

  await esbuild.build({
    entryPoints: [join(DIST, 'workspace-native.mjs')],
    outdir: DIST,
    entryNames: '[name].bundle',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    splitting: true,
    sourcemap: false,
    logLevel: 'info',
  });

  await esbuild.build({
    entryPoints: [join(DIST, 'native-bridge.mjs')],
    outdir: DIST,
    entryNames: '[name].bundle',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    splitting: false,
    sourcemap: false,
    logLevel: 'info',
  });

  console.log('Built native frontend bundles in', DIST);
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
