import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      'vendor/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
    ],
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
  },
  {
    files: [
      'server.mjs',
      'test-roundtrip.mjs',
      'playwright.config.js',
      'tests/unit/**/*.mjs',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ['app.js', 'service-worker.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['service-worker.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
  },
  {
    files: [
      'markmap-convert.mjs',
      'markers.mjs',
      'import-formats.mjs',
      'marker-picker.mjs',
      'priority-hotkeys.mjs',
      'type-to-edit.mjs',
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
];
