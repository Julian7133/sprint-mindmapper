if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(chrome.runtime.getURL('editor/service-worker.js'), {
      scope: chrome.runtime.getURL('editor/'),
    })
    .catch(console.warn);
}
