import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { writeEmbeddedAssetsModule } from './build-assets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

async function runBuild() {
  writeEmbeddedAssetsModule();

  const ctx = await esbuild.context({
    entryPoints: [join(__dirname, 'editor/markmap-render.mjs')],
    outfile: join(__dirname, 'editor/markmap-bundle.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    logLevel: 'info',
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching extension/editor/markmap-render.mjs…');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
