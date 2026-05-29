function loadMonacoEditor(ver = '0.52.0') {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('data-name', 'vs/editor/editor.main');
    link.href = `https://cdn.jsdelivr.net/npm/monaco-editor@${ver}/min/vs/editor/editor.main.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `https://cdn.jsdelivr.net/npm/monaco-editor@${ver}/min/vs/loader.js`;
    script.onload = () => {
      require.config({
        paths: {
          vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${ver}/min/vs`,
        },
      });
      require(['vs/editor/editor.main'], resolve);
    };
    document.head.appendChild(script);
  });
}
