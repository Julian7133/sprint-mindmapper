import { load } from '@tauri-apps/plugin-store';

/**
 * Thin store wrapper over `@tauri-apps/plugin-store`. All state lives in two
 * JSON stores inside the OS app-config directory, shared by every window of
 * the app (which is what makes the multi-window model work):
 *   - meta.json     -> the folder record + session (openTabs / activeFile)
 *   - drafts.json   -> per-(folderId, relPath) unsaved drafts
 */

const META_KEY = 'folder';

let metaStorePromise = null;
let draftStorePromise = null;

function metaStore() {
  metaStorePromise ??= load('meta.json', { autoSave: false });
  return metaStorePromise;
}

function draftStore() {
  draftStorePromise ??= load('drafts.json', { autoSave: false });
  return draftStorePromise;
}

/** @returns {Promise<Record<string, unknown> | null>} */
export async function readSavedFolderRecord() {
  const store = await metaStore();
  return (await store.get(META_KEY)) ?? null;
}

/** @param {Record<string, unknown>} record */
export async function writeSavedFolderRecord(record) {
  const store = await metaStore();
  await store.set(META_KEY, record);
  await store.save();
}

export async function clearSavedFolderRecord() {
  const store = await metaStore();
  await store.delete(META_KEY);
  await store.save();
}

/** @returns {Promise<string>} */
export async function readDraft(key) {
  const store = await draftStore();
  const value = await store.get(key);
  return typeof value === 'string' ? value : '';
}

/** @param {string} text */
export async function writeDraft(key, text) {
  const store = await draftStore();
  await store.set(key, text);
  await store.save();
}

export async function deleteDraft(key) {
  const store = await draftStore();
  await store.delete(key);
  await store.save();
}
