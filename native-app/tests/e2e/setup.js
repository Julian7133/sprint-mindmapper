import { installTauriMock } from './tauri-mock.js';

/**
 * Fixture markdown for the native e2e harness. Each map has a distinct H1 and
 * branch label so tests can assert which map is actually on screen.
 */
export const FIXTURE_FILES = {
  'alpha.md': '# Alpha\n\n## AlphaBranchOne\n\n## AlphaBranchTwo\n',
  'beta.md': '# Beta\n\n## BetaBranchOne\n\n## BetaBranchTwo\n',
  'planning/gamma.md': '# Gamma\n\n## GammaSub\n',
};

export const ROOT_DIR = '/fixtures';

const FOLDER_RECORD = {
  rootDir: ROOT_DIR,
  folderId: 'fixture-folder',
  folderLabel: 'fixtures',
  activeFile: 'alpha.md',
  openTabs: ['alpha.md'],
};

/**
 * Install the Tauri IPC shim (before any app script runs) and navigate to the
 * app. Returns once the editor reports ready.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.files]  override fixture files
 * @param {object|null} [opts.record]           override saved-folder record (null = no folder)
 * @param {string|null} [opts.dialogResult]     value returned by the folder picker
 */
export async function bootNative(page, opts = {}) {
  const files = opts.files ?? FIXTURE_FILES;
  const record = opts.record === undefined ? FOLDER_RECORD : opts.record;
  const config = {
    files,
    rootDir: ROOT_DIR,
    dialogResult: opts.dialogResult ?? null,
    stores: {
      'meta.json': record ? { folder: record } : {},
      'drafts.json': {},
    },
  };
  await page.addInitScript(installTauriMock, config);
  await page.goto('/');
}
