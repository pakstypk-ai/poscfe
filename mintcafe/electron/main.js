const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const createDb = require('./db');

let win, db, dbFile;

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 1024, minHeight: 640,
    autoHideMenuBar: true, backgroundColor: '#0f1115',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.maximize();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  dbFile = path.join(app.getPath('userData'), 'pos.db');
  db = createDb(Database, dbFile);

  ipcMain.handle('api', (e, name, args) => {
    if (typeof db[name] !== 'function') throw new Error('Unknown API: ' + name);
    return db[name](...(args || []));
  });

  ipcMain.handle('print', async (e, html, silent) => {
    const w = new BrowserWindow({ show: false });
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return new Promise((resolve) => {
      w.webContents.print({ silent: !!silent, printBackground: true }, (ok, err) => { w.close(); resolve({ ok, err }); });
    });
  });

  ipcMain.handle('backup', async () => {
    const r = await dialog.showSaveDialog(win, {
      defaultPath: 'cafe-pos-backup-' + new Date().toISOString().slice(0, 10) + '.db',
      filters: [{ name: 'POS Backup', extensions: ['db'] }]
    });
    if (r.canceled) return false;
    db.backupTo ? db.backupTo(r.filePath) : fs.copyFileSync(dbFile, r.filePath);
    return r.filePath;
  });

  ipcMain.handle('restore', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'POS Backup', extensions: ['db'] }], properties: ['openFile'] });
    if (r.canceled) return false;
    db.close();
    fs.copyFileSync(r.filePaths[0], dbFile);
    app.relaunch(); app.exit(0);
    return true;
  });

  createWindow();
});

app.on('window-all-closed', () => app.quit());
