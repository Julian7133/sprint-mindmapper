import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseMarkdown, serializeMarkdown } from './markmap-convert.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = resolve(__dirname, process.argv[2] ?? '../sprint-tasks.md');
const src = readFileSync(srcPath, 'utf8');

const a = parseMarkdown(src);
const md = serializeMarkdown(a.frontmatter, a.root);
const b = parseMarkdown(md);

function norm(n) {
  return {
    t: n.topic,
    p: n.priority ?? null,
    c: (n.children || []).map(norm),
  };
}

const ok =
  JSON.stringify(norm(a.root)) === JSON.stringify(norm(b.root));
console.log(ok ? 'PASS round-trip' : 'FAIL round-trip');
if (!ok) {
  console.error('Before:', JSON.stringify(norm(a.root), null, 2));
  console.error('After:', JSON.stringify(norm(b.root), null, 2));
  process.exit(1);
}
