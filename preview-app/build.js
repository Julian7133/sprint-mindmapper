import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionDir = join(__dirname, '../extension');
const extensionEmbedded = join(extensionDir, 'editor/embedded-assets.mjs');
const previewEmbedded = join(__dirname, 'embedded-assets.mjs');

function ensureExtensionBuild() {
  if (!existsSync(extensionEmbedded)) {
    const result = spawnSync('node', ['build.js'], {
      cwd: extensionDir,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
  copyFileSync(extensionEmbedded, previewEmbedded);
}

async function runBuild() {
  ensureExtensionBuild();

  await esbuild.build({
    entryPoints: [join(__dirname, 'render-markmap-inbrowser.mjs')],
    outfile: join(__dirname, 'markmap-bundle.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    logLevel: 'info',
  });

  console.log('Wrote preview-app/markmap-bundle.js');
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
