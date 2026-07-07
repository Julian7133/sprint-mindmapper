import { buildCode, escapeScript } from 'markmap-common';
import { Transformer } from 'markmap-lib';
import { embeddedAssets } from './embedded-assets.mjs';

const CDN_PATTERN = /cdn\.jsdelivr\.net|unpkg\.com/i;

/** @typedef {{ type: string; data?: Record<string, unknown> }} AssetItem */

/**
 * @param {string} urlOrPath
 * @returns {string}
 */
function assetKey(urlOrPath) {
  return urlOrPath.replace(/^https:\/\/cdn\.jsdelivr\.net\/npm\//, '');
}

/**
 * @param {string} urlOrPath - CDN URL or `pkg@version/path` spec
 * @returns {string}
 */
function readPackageAsset(urlOrPath) {
  const key = assetKey(urlOrPath);
  if (embeddedAssets[key]) return embeddedAssets[key];

  const relMatch = key.match(/^[^/]+\/[^/]+\/(.+)$/);
  if (relMatch && embeddedAssets[relMatch[1]]) {
    return embeddedAssets[relMatch[1]];
  }

  throw new Error(`Embedded asset not found: ${urlOrPath}`);
}

/**
 * @param {AssetItem} item
 * @returns {string}
 */
function inlineStyleItem(item) {
  if (item.type === 'style' && typeof item.data === 'string') {
    return `<style>${item.data}</style>`;
  }
  if (item.type === 'stylesheet' && item.data?.href) {
    const css = readPackageAsset(String(item.data.href));
    return `<style>${css}</style>`;
  }
  return '';
}

/**
 * @param {AssetItem} item
 * @param {unknown} [context]
 * @returns {string}
 */
function inlineScriptItem(item, context) {
  if (item.type === 'script') {
    const { textContent, src, ...rest } = item.data ?? {};
    if (textContent) {
      const attrs = Object.entries(rest)
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(' ');
      return `<script${attrs ? ` ${attrs}` : ''}>${textContent}</script>`;
    }
    if (src) {
      const js = readPackageAsset(String(src));
      return `<script>${js}</script>`;
    }
  }
  if (item.type === 'iife') {
    const { fn, getParams } = item.data ?? {};
    if (typeof fn !== 'function') return '';
    const params = typeof getParams === 'function' ? getParams(context) : [];
    return `<script>${escapeScript(buildCode(fn, params ?? []))}</script>`;
  }
  return '';
}

/**
 * @param {AssetItem[]} items
 * @returns {string[]}
 */
function inlineStyles(items) {
  return items.map(inlineStyleItem).filter(Boolean);
}

/**
 * @param {AssetItem[]} items
 * @param {unknown} [context]
 * @returns {string[]}
 */
function inlineScripts(items, context) {
  return items.map((item) => inlineScriptItem(item, context)).filter(Boolean);
}

/**
 * @returns {string[]}
 */
function baseScriptSources() {
  const d3 = embeddedAssets['d3/dist/d3.min.js'];
  const view = embeddedAssets['markmap-view/dist/browser/index.js'];
  if (!d3 || !view) {
    throw new Error('Base markmap assets missing — run `npm run build` first');
  }
  return [`<script>${d3}</script>`, `<script>${view}</script>`];
}

/**
 * @param {Record<string, unknown> | undefined} markmapOptions
 * @returns {Record<string, unknown>}
 */
function jsonOptionsFromFrontmatter(markmapOptions) {
  if (!markmapOptions || typeof markmapOptions !== 'object') return {};
  const { htmlParser: _htmlParser, ...options } = markmapOptions;
  return options;
}

/**
 * Render markdown to a self-contained interactive markmap HTML document.
 * Drop-in replacement for what `npx markmap-cli` produces.
 * @param {string} markdown - Full markdown including optional frontmatter
 * @returns {Promise<string>} Complete HTML document string
 */
export async function renderMarkmapHtml(markdown) {
  const transformer = new Transformer();
  const { root, features, frontmatter } = transformer.transform(markdown);
  const { styles, scripts } = transformer.getUsedAssets(features);
  const jsonOptions = jsonOptionsFromFrontmatter(frontmatter?.markmap);

  const styleBlock = inlineStyles(styles ?? []).join('\n');
  const initContext = {
    getMarkmap: () => ({}),
    getOptions: null,
    jsonOptions,
    root,
  };
  const scriptBlocks = [
    ...baseScriptSources(),
    ...inlineScripts(scripts ?? [], initContext),
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AuraMindmap</title>
  <style>
* {
  margin: 0;
  padding: 0;
}
html {
  font-family: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji',
    'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
}
#mindmap {
  display: block;
  width: 100vw;
  height: 100vh;
}
.markmap-dark {
  background: #27272a;
  color: white;
}
${styleBlock}
  </style>
</head>
<body style="margin:0">
  <svg id="mindmap" style="width:100%;height:100vh"></svg>
  ${scriptBlocks}
  <script>
    const { Markmap, loadCSS, loadJS } = window.markmap;
    Markmap.create('#mindmap', Markmap.deriveOptions(${JSON.stringify(jsonOptions)}), ${JSON.stringify(root)});
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('markmap-dark');
    }
  </script>
</body>
</html>`;

  if (CDN_PATTERN.test(html)) {
    throw new Error('Rendered HTML must not contain CDN URLs');
  }

  return html;
}
