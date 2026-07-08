const EDITOR_URL = chrome.runtime.getURL('editor/index.html');
const SESSION_WINDOW_KEY = 'editorWindowId';

async function getStoredWindowId() {
  const data = await chrome.storage.session.get(SESSION_WINDOW_KEY);
  return data[SESSION_WINDOW_KEY] ?? null;
}

async function setStoredWindowId(windowId) {
  if (windowId == null) {
    await chrome.storage.session.remove(SESSION_WINDOW_KEY);
    return;
  }
  await chrome.storage.session.set({ [SESSION_WINDOW_KEY]: windowId });
}

async function windowExists(windowId) {
  if (windowId == null) {
    return false;
  }
  try {
    await chrome.windows.get(windowId);
    return true;
  } catch {
    await setStoredWindowId(null);
    return false;
  }
}

async function openEditorWindow() {
  const existingId = await getStoredWindowId();
  if (await windowExists(existingId)) {
    await chrome.windows.update(existingId, { focused: true });
    return;
  }

  const win = await chrome.windows.create({
    url: EDITOR_URL,
    type: 'popup',
    width: 1280,
    height: 800,
  });
  await setStoredWindowId(win.id);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.action.onClicked.addListener(() => {
  void openEditorWindow();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-editor') {
    void openEditorWindow();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'open-editor') {
    void openEditorWindow().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const storedId = await getStoredWindowId();
  if (storedId === windowId) {
    await setStoredWindowId(null);
  }
});
