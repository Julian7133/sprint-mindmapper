document.body.classList.add('side-panel-mode');

const openFullBtn = document.getElementById('btn-open-full-editor');
openFullBtn?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'open-editor' });
});

await import('./app.js');
