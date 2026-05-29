export function waitForIframeReady(iframeWindow) {
  return new Promise((resolve) => {
    if (iframeWindow.__seesaawikiApi) {
      resolve();
      return;
    }
    const onMessage = (event) => {
      if (
        event.source === iframeWindow &&
        event.origin === window.location.origin &&
        event.data &&
        event.data.type === 'seesaawiki:ready'
      ) {
        window.removeEventListener('message', onMessage);
        resolve();
      }
    };
    window.addEventListener('message', onMessage);
  });
}
