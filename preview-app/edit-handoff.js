// Only file data crosses the extension boundary; OAuth tokens stay in drive.js/app.js.
export function sendEditHandoff(extensionId, file, runtime = globalThis.chrome?.runtime, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!runtime?.sendMessage) return resolve({ status: 'unavailable' });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'unavailable' }), timeoutMs);
    try {
      runtime.sendMessage(extensionId, {
        type: 'auramindmap:open-drive-file',
        fileId: file.fileId, fileName: file.fileName, markdown: file.markdown,
      }, (response) => {
        // Read lastError even after a timeout so Chrome doesn't log it as unchecked.
        const error = runtime.lastError;
        if (error || !response) return finish({ status: 'unavailable' });
        finish(response.ok ? { status: 'opened' } : { status: 'rejected', error: response.error });
      });
    } catch {
      finish({ status: 'unavailable' });
    }
  });
}
