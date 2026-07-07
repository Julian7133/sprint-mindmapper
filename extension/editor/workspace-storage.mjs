const DB_NAME = 'sprint-mindmap-editor';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('workspace')) {
        db.createObjectStore('workspace');
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts');
      }
    };
  });
}

async function idbGet(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbSet(storeName, key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(storeName).put(value, key);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(storeName).delete(key);
  });
}

export async function loadSavedFolderWorkspace() {
  return idbGet('workspace', 'folder');
}

export async function saveFolderWorkspace(record) {
  await idbSet('workspace', 'folder', record);
}

export async function clearSavedFolderWorkspace() {
  await idbDelete('workspace', 'folder');
}

export async function readDraftKey(key) {
  return idbGet('drafts', key);
}

export async function writeDraftKey(key, text) {
  await idbSet('drafts', key, text);
}

export async function deleteDraftKey(key) {
  await idbDelete('drafts', key);
}
