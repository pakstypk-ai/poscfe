const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pos', {
  call: (name, ...args) => ipcRenderer.invoke('api', name, args),
  login: (username, pin) => ipcRenderer.invoke('login', username, pin),
  logout: () => ipcRenderer.invoke('logout'),
  session: () => ipcRenderer.invoke('session'),
  print: (html, silent) => ipcRenderer.invoke('print', html, silent),
  export: (scope, kind, name, content) => ipcRenderer.invoke('export', scope, kind, name, content),
  backup: () => ipcRenderer.invoke('backup'),
  restore: () => ipcRenderer.invoke('restore')
});
