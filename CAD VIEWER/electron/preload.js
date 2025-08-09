const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onOpenFile: (cb) => ipcRenderer.on('open-file', (_e, payload) => cb(payload)),
  onMenuToggleMeasure: (cb) => ipcRenderer.on('menu-toggle-measure', () => cb()),
  onMenuFit: (cb) => ipcRenderer.on('menu-fit', () => cb()),
  log: (level, message) => ipcRenderer.send('renderer-log', { level, message })
});


