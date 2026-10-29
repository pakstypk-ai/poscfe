const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pos', {
  call: (name, ...args) => ipcRenderer.invoke('api', name, args),
  print: (html, silent) => ipcRenderer.invoke('print', html, silent),
  backup: () => ipcRenderer.invoke('backup'),
  restore: () => ipcRenderer.invoke('restore')
});
