#!/usr/bin/env node
/** Create a Chrome Web Store upload zip (excludes dev/test artifacts). */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outZip = path.join(root, 'auramindmap-extension.zip');

execSync('node build.js', { cwd: root, stdio: 'inherit' });

if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

const include = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'icons',
  'editor',
];

const exclude = [
  'node_modules',
  'tests',
  'store-listing',
  '*.map',
  '*.sh',
  'package.json',
  'package-lock.json',
  'playwright.config.js',
  'build.js',
  'build-assets.mjs',
  'scripts',
  'auramindmap-extension.zip',
];

const excludeArgs = exclude.flatMap((x) => ['-x', x]);
execSync(
  ['zip', '-r', outZip, ...include, ...excludeArgs].join(' '),
  { cwd: root, stdio: 'inherit' },
);

console.log(`Created ${outZip}`);
