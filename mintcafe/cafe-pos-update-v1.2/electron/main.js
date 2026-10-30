const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const createDb = require('./db');

let win, db, dbFile;
let session = null; // logged-in user id lives here (main process), never trusted from the renderer
const fails = {};

// Which permission(s) each API call needs. null = any logged-in user. Anything not listed is blocked.
const NEEDS = {
  getMenu: null, listTables: null, lowStock: null, changeMyPin: null,
  getOrder: ['pos', 'orders', 'kitchen'], listOrders: ['pos', 'orders', 'kitchen'],
  saveOrder: ['pos'], deleteHeld: ['pos'], transferTable: ['orders', 'pos'], loyaltyFor: ['pos'],
  kitchenOrders: ['kitchen', 'orders', 'pos'], setKitchenStatus: ['kitchen', 'orders'],
  voidOrder: ['void'], reopenOrder: ['void'],
  saveCategory: ['menu'], deleteCategory: ['menu'], saveItem: ['menu'], deleteItem: ['menu'], importMenu: ['menu'],
  saveTable: ['tables'], deleteTable: ['tables'], setTableStatus: ['tables', 'table_status'],
  addExpense: ['expenses'], deleteExpense: ['expenses'], listExpenses: ['expenses', 'reports'],
  report: ['reports'], dashboard: ['dashboard'],
  findCustomer: ['pos', 'customers', 'khata'], listCustomers: ['customers', 'khata'], saveCustomer: ['customers', 'khata'], deleteCustomer: ['customers'],
  customerLedger: ['customers', 'khata'], addCustomerPayment: ['khata'],
  listSuppliers: ['suppliers', 'payments'], saveSupplier: ['suppliers'], deleteSupplier: ['suppliers'], supplierLedger: ['suppliers'], addSupplierEntry: ['suppliers'],
  listMaterials: ['inventory', 'suppliers'], saveMaterial: ['inventory'], deleteMaterial: ['inventory'], adjustMaterial: ['inventory'],
  listPayouts: ['payments'], addPayout: ['payments'], deletePayout: ['payments'], pendingPayments: ['payments'],
  listRiders: ['delivery'], saveRider: ['delivery'], deleteRider: ['delivery'], assignRider: ['delivery'], riderReport: ['delivery'], riderDetail: ['delivery'],
  listDeliveries: ['delivery'], setDeliveryStatus: ['delivery'],
  listUsers: ['staff', 'delivery'], saveUser: ['staff'], deleteUser: ['staff'], changeLogin: ['staff'], setUserActive: ['staff'], auditLog: ['staff'], permMeta: ['staff'],
  saveSettings: ['settings'], resetSalesData: ['reset']
};
// A rider login may only use the delivery calls plus the harmless basics the app loads on start.
const RIDER_OK = new Set(['listDeliveries', 'setDeliveryStatus', 'changeMyPin', 'getMenu', 'listTables', 'lowStock']);
const EXPORT_PERM = { reports: ['reports'], customers: ['customers', 'khata'], orders: ['orders', 'pos'], suppliers: ['suppliers'], inventory: ['inventory'], delivery: ['delivery'], payments: ['payments'] };
const PUBLIC = new Set(['getSettings']);

const can = (u, p) => u && (u.role === 'admin' || u.permissions.includes(p));
function current() { return session ? db.sessionUser(session) : null; } // re-read every call: deactivation/permission changes apply instantly
function need(perms) {
  const u = current();
  if (!u) throw new Error('Please login first');
  if (perms && !perms.some((p) => can(u, p))) throw new Error('You do not have permission for this');
  return u;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 1024, minHeight: 640,
    autoHideMenuBar: true, backgroundColor: '#f4f6f9',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.maximize();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  dbFile = path.join(app.getPath('userData'), 'pos.db');
  db = createDb(Database, dbFile);

  ipcMain.handle('login', (e, username, pin) => {
    const key = String(username || '').trim().toLowerCase();
    const f = fails[key] || { n: 0, until: 0 };
    if (f.until > Date.now()) return { error: `Too many wrong attempts. Try again in ${Math.ceil((f.until - Date.now()) / 1000)}s` };
    const u = db.login(username, pin);
    if (!u) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 30000; f.n = 0; } fails[key] = f;
      return { error: 'Wrong Login ID or PIN' };
    }
    delete fails[key]; session = u.id;
    return { user: u };
  });
  ipcMain.handle('logout', () => { session = null; return true; });
  ipcMain.handle('session', () => current());

  ipcMain.handle('api', (e, name, args) => {
    let a = [...(args || [])];
    if (PUBLIC.has(name)) {
      const all = db[name](...a);
      if (current()) return all;
      const { name: n, tagline, logo, setup_done } = all; // before login: only branding, never tokens/IDs
      return { name: n, tagline, logo, setup_done };
    }
    if (!Object.prototype.hasOwnProperty.call(NEEDS, name) || typeof db[name] !== 'function') throw new Error('Unknown API: ' + name);
    const u = need(NEEDS[name]);
    if (u.role === 'rider' && !RIDER_OK.has(name)) throw new Error('Riders can only use their delivery screen');
    switch (name) {
      case 'listUsers': if (!can(u, 'staff')) return db.listUsers().filter((x) => x.role === 'rider').map((x) => ({ id: x.id, name: x.name, username: x.username, role: x.role })); break;
      case 'listDeliveries': a[0] = { ...(a[0] || {}), riderUserId: u.role === 'rider' ? u.id : undefined }; break;
      case 'setDeliveryStatus': a[2] = { riderUserId: u.role === 'rider' ? u.id : undefined }; break;
      case 'addCustomerPayment': case 'addSupplierEntry': case 'addPayout': a = [a[0], u.name]; break;
      case 'adjustMaterial': a = [a[0], a[1], a[2], u.name]; break;
      case 'reopenOrder': a[1] = u.name; break;
      case 'resetSalesData': a = [u.name]; break;
      case 'saveOrder':
        a[0] = { ...a[0], user: { id: u.id, name: u.name } };
        if ((Number(a[0].discount_value) || 0) > 0 && !can(u, 'discount')) throw new Error('You do not have permission to give discounts');
        break;
      case 'voidOrder': a[1] = u.name; break;
      case 'addExpense': a[0] = { ...a[0], user: u.name }; break;
      case 'saveUser': a = [a[0], u.name]; break;
      case 'changeLogin': a = [a[0], a[1], u.name]; break;
      case 'setUserActive': a = [a[0], a[1], u.id, u.name]; break;
      case 'deleteUser': a = [a[0], u.id, u.name]; break;
      case 'changeMyPin': a = [u.id, a[0], a[1]]; break;
      default: break;
    }
    return db[name](...a);
  });
  ipcMain.handle('print', async (e, html, silent) => {
    need(null);
    const w = new BrowserWindow({ show: false });
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return new Promise((resolve) => {
      w.webContents.print({ silent: !!silent, printBackground: true }, (ok, err) => { w.close(); resolve({ ok, err }); });
    });
  });

  // export: csv / json (text) or pdf (A4 rendered from html). Permission depends on what is exported.
  ipcMain.handle('export', async (e, scope, kind, name, content) => {
    need(EXPORT_PERM[scope] || ['reports']);
    const ext = kind === 'pdf' ? 'pdf' : kind === 'json' ? 'json' : 'csv';
    const r = await dialog.showSaveDialog(win, { defaultPath: String(name || 'export').replace(/[^\w.-]+/g, '_') + '.' + ext, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled) return false;
    if (kind === 'pdf') {
      const w = new BrowserWindow({ show: false });
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(content));
      const buf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
      w.close(); fs.writeFileSync(r.filePath, buf);
    } else fs.writeFileSync(r.filePath, (ext === 'csv' ? '\ufeff' : '') + content, 'utf8');
    return r.filePath;
  });

  ipcMain.handle('backup', async () => {
    need(['backup']);
    const r = await dialog.showSaveDialog(win, {
      defaultPath: 'cafe-pos-backup-' + new Date().toISOString().slice(0, 10) + '.db',
      filters: [{ name: 'POS Backup', extensions: ['db'] }]
    });
    if (r.canceled) return false;
    db.backupTo(r.filePath);
    return r.filePath;
  });

  ipcMain.handle('restore', async () => {
    need(['backup']);
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'POS Backup', extensions: ['db'] }], properties: ['openFile'] });
    if (r.canceled) return false;
    db.close();
    for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(dbFile + ext); } catch {} }
    fs.copyFileSync(r.filePaths[0], dbFile);
    app.relaunch(); app.exit(0);
    return true;
  });

  createWindow();
});

app.on('window-all-closed', () => app.quit());
