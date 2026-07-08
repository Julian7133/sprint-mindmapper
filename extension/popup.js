const openBtn = document.getElementById('open-editor');
const sidePanelBtn = document.getElementById('open-side-panel');
const recentList = document.getElementById('recent-files');

openBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'open-editor' });
});

sidePanelBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'open-side-panel' });
  window.close();
});

async function loadRecentFiles() {
  const { recentFiles = [] } = await chrome.storage.local.get('recentFiles');
  recentList.replaceChildren();

  if (!recentFiles.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'No recent files';
    recentList.append(item);
    return;
  }

  for (const file of recentFiles) {
    const item = document.createElement('li');
    item.textContent = file;
    item.title = file;
    recentList.append(item);
  }
}

void loadRecentFiles();
