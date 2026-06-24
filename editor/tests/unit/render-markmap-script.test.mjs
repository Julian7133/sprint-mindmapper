import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = new URL('../../..', import.meta.url).pathname;
const scriptPath = new URL('../../../render-markmap.sh', import.meta.url).pathname;

async function writeExecutable(path, contents) {
  await writeFile(path, contents, { mode: 0o755 });
}

describe('render-markmap.sh', () => {
  it('uses absolute output paths directly for screenshot file URLs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'render-markmap-'));
    const binDir = join(dir, 'bin');
    const input = join(dir, 'tasks.md');
    const basename = join(dir, 'rendered-map');
    const htmlOut = `${basename}.html`;
    const pngOut = `${basename}.png`;
    const npxArgsPath = join(dir, 'npx-args.txt');
    const chromeArgsPath = join(dir, 'chrome-args.txt');
    const npxPath = join(binDir, 'npx');
    const chromePath = join(binDir, 'chrome');

    await mkdir(binDir);
    await writeFile(input, '# Sprint Tasks\n');
    await writeExecutable(
      npxPath,
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "$RENDER_NPX_ARGS"
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    out="$1"
  fi
  shift || true
done
: "\${out:?missing -o}"
mkdir -p "$(dirname "$out")"
printf '<html></html>\\n' > "$out"
`
    );
    await writeExecutable(
      chromePath,
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "$RENDER_CHROME_ARGS"
`
    );

    const { stdout } = await execFileAsync(scriptPath, [input, basename], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        CHROME: chromePath,
        RENDER_NPX_ARGS: npxArgsPath,
        RENDER_CHROME_ARGS: chromeArgsPath,
      },
    });

    const npxArgs = (await readFile(npxArgsPath, 'utf8')).trim().split('\n');
    const chromeArgs = (await readFile(chromeArgsPath, 'utf8')).trim().split('\n');

    assert.deepEqual(npxArgs, [
      '-y',
      'markmap-cli@latest',
      input,
      '-o',
      htmlOut,
      '--no-open',
    ]);
    assert.ok(chromeArgs.includes(`--screenshot=${pngOut}`));
    assert.equal(chromeArgs.at(-1), `file://${htmlOut}`);
    assert.match(
      stdout,
      new RegExp(`Rendered: ${escapeRegExp(htmlOut)} and ${escapeRegExp(pngOut)}`)
    );
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
