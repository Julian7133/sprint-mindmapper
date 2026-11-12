// This document runs in an opaque-origin sandbox. Only its response CSP permits
// inline scripts, as required by self-contained markmap HTML. The app keeps its
// stricter CSP and never gives this frame credentials or same-origin access.
window.addEventListener('message', (event) => {
  if (event.source !== parent || event.origin !== location.origin) return;
  if (event.data?.type !== 'auramindmap:render' || typeof event.data.html !== 'string') return;
  const doc = new DOMParser().parseFromString(event.data.html, 'text/html');
  document.head.replaceChildren(...doc.head.childNodes);
  document.body.replaceChildren(...doc.body.childNodes);
  for (const inert of document.querySelectorAll('script')) {
    const script = document.createElement('script');
    // Self-contained exports only contain inline scripts. Never load a supplied URL.
    if (!inert.src) script.textContent = inert.textContent;
    inert.replaceWith(script);
  }
});
