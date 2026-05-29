export const editIframeStyles = `
  body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background-color: #1e1e1e;
    color: #d4d4d4;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 14px;
  }
  #container {
    display: flex;
    height: 100%;
  }
  #outline-container {
    width: 250px;
    min-width: 250px;
    height: 100%;
    overflow-y: auto;
    border-right: 1px solid #333;
    box-sizing: border-box;
    background-color: #252526;
    display: flex;
    flex-direction: column;
  }
  #outline-label {
    padding: 10px 10px 5px;
    font-weight: bold;
    border-bottom: 1px solid #333;
    background-color: #2d2d2d;
    font-size: 14px;
  }
  #outline-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 5px 10px 10px;
  }
  #monaco-editor-container {
    flex-grow: 1;
    height: 100%;
    min-width: 0;
  }
  .monaco-editor .current-line {
    border: 2px solid #1073cfff !important;
    background-color: #1073cf50 !important;
  }
  .outline-item {
    cursor: pointer;
    padding: 4px 8px 4px 10px;
    border: 1px solid transparent;
    border-radius: 3px;
    position: relative;
  }
  .outline-item:hover {
    border-color: #007acc;
  }
  .outline-item.active {
    border-color: #007acc;
    background-color: #094771;
  }
  .outline-children {
    padding-left: 10px;
    border-left: 1px solid #808080;
    margin-left: 20px;
  }
  #outline-content::-webkit-scrollbar {
    width: 8px;
  }
  #outline-content::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  #outline-content::-webkit-scrollbar-thumb {
    background-color: #424242;
    border-radius: 4px;
  }
  #outline-content::-webkit-scrollbar-thumb:hover {
    background-color: #4f4f4f;
  }
`;

export const diffIframeStyles = `
  body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background-color: #1e1e1e;
    color: #d4d4d4;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 14px;
  }
  #monaco-editor-container {
    width: 100%;
    height: 100%;
  }
`;
