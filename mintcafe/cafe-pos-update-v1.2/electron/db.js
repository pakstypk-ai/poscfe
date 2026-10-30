'use strict';
// SQLite data layer. Works with better-sqlite3 (app) and node:sqlite DatabaseSync (tests).
const DEFAULTS = {
  name: 'My Cafe', tagline: '', address: '', phone: '', ntn: '', logo: '', receipt_footer: 'Thank you! Visit again',
  currency: 'Rs.', tax_label: 'GST', tax_percent: '0', service_percent: '0', delivery_fee: '0', paper_width: '80',
  silent_print: '0', print_kot: '0', fbr_enabled: '0', fbr_pos_id: '', fbr_token: '', setup_done: '0',
  loyalty_min_orders: '0', loyalty_percent: '0', loyalty2_min_orders: '0', loyalty2_percent: '0', voice_alerts: '0',
  rc_font: 'Consolas', rc_font_size: '12', rc_logo_w: '60', rc_terms: '', rc_show_logo: '1', rc_show_ntn: '1', rc_show_tax: '1', rc_show_discount: '1', rc_show_cash: '1', rc_show_service: '1', rc_show_notes: '0', rc_show_customer: '1', rc_credit: '0',
  online_enabled: '0', online_site: '', online_key: ''
};

const crypto = require('crypto');
const PERMS = [
  { key: 'dashboard', label: 'Dashboard', group: 'Screens' },
  { key: 'pos', label: 'POS / Take orders', group: 'Screens' },
  { key: 'orders', label: 'Orders', group: 'Screens' },
  { key: 'kitchen', label: 'Kitchen display', group: 'Screens' },
  { key: 'delivery', label: 'Delivery & riders', group: 'Screens' },
  { key: 'tables', label: 'Tables (add / edit)', group: 'Screens' },
  { key: 'menu', label: 'Menu management', group: 'Screens' },
  { key: 'customers', label: 'Customers (CRM)', group: 'Screens' },
  { key: 'khata', label: 'Customer credit (Khata)', group: 'Screens' },
  { key: 'inventory', label: 'Inventory (raw materials)', group: 'Screens' },
  { key: 'suppliers', label: 'Suppliers & ledger', group: 'Screens' },
  { key: 'payments', label: 'Payments register', group: 'Screens' },
  { key: 'expenses', label: 'Expenses', group: 'Screens' },
  { key: 'reports', label: 'Reports (sales & profit)', group: 'Screens' },
  { key: 'staff', label: 'Staff & permissions', group: 'Screens' },
  { key: 'settings', label: 'Settings & receipt design', group: 'Screens' },
  { key: 'table_status', label: 'Change table status only (available / cleaning)', group: 'Actions' },
  { key: 'discount', label: 'Give discounts', group: 'Actions' },
  { key: 'void', label: 'Cancel / edit completed orders', group: 'Actions' },
  { key: 'backup', label: 'Backup / Restore data', group: 'Actions' },
  { key: 'reset', label: 'Reset (delete) sales data', group: 'Actions' }
];
const ALL_KEYS = PERMS.map((p) => p.key);
const ROLES = ['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'rider', 'cleaner'];
const PRESETS = {
  admin: ALL_KEYS,
  manager: ['dashboard', 'pos', 'orders', 'kitchen', 'delivery', 'tables', 'menu', 'customers', 'khata', 'inventory', 'suppliers', 'payments', 'expenses', 'discount', 'void'],
  cashier: ['dashboard', 'pos', 'orders', 'kitchen', 'customers', 'khata', 'discount'],
  waiter: ['pos'],
  kitchen: ['kitchen'],
  rider: ['delivery'],
  cleaner: ['table_status']
};
const hash = (pin) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(String(pin), s, 32).toString('hex'); };
const verify = (pin, stored) => {
  if (!stored) return false;
  if (!String(stored).includes(':')) return String(stored) === String(pin);
  const [salt, h] = String(stored).split(':'); const x = crypto.scryptSync(String(pin), salt, 32); const hb = Buffer.from(h, 'hex');
  return hb.length === x.length && crypto.timingSafeEqual(hb, x);
};

module.exports = function createDb(Database, file) {
  const d = new Database(file);
  d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  d.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pin TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'cashier', active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, variants TEXT NOT NULL DEFAULT '[]', stock_track INTEGER NOT NULL DEFAULT 0, stock REAL NOT NULL DEFAULT 0, kitchen INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS tables_ (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL DEFAULT 'dine-in', table_no TEXT DEFAULT '', customer TEXT DEFAULT '', phone TEXT DEFAULT '', address TEXT DEFAULT '', note TEXT DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]', subtotal REAL DEFAULT 0, discount REAL DEFAULT 0, service REAL DEFAULT 0, tax REAL DEFAULT 0, delivery REAL DEFAULT 0, total REAL DEFAULT 0,
    payment TEXT DEFAULT '', received REAL DEFAULT 0, status TEXT NOT NULL DEFAULT 'paid', user_id INTEGER, user_name TEXT DEFAULT '', day TEXT NOT NULL, created_at TEXT NOT NULL, stock_deducted INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL, user_name TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, user_name TEXT, action TEXT, detail TEXT);
  CREATE INDEX IF NOT EXISTS idx_orders_day ON orders(day);
  `);

  const all = (sql, ...p) => d.prepare(sql).all(...p).map((r) => ({ ...r }));
  const one = (sql, ...p) => { const r = d.prepare(sql).get(...p); return r ? { ...r } : null; };
  const run = (sql, ...p) => d.prepare(sql).run(...p);
  const tx = (fn) => { d.exec('BEGIN'); try { const r = fn(); d.exec('COMMIT'); return r; } catch (e) { try { d.exec('ROLLBACK'); } catch {} throw e; } };
  const pad = (n) => String(n).padStart(2, '0');
  const dayOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const num = (v) => Number(v) || 0;

  const addCol = (t, c, def) => { if (!all(`PRAGMA table_info(${t})`).some((x) => x.name === c)) d.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
  addCol('users', 'username', "TEXT NOT NULL DEFAULT ''"); addCol('users', 'phone', "TEXT NOT NULL DEFAULT ''");
  addCol('users', 'position', "TEXT NOT NULL DEFAULT ''"); addCol('users', 'permissions', "TEXT NOT NULL DEFAULT ''");
  addCol('orders', 'kstatus', "TEXT NOT NULL DEFAULT 'pending'");
  addCol('orders', 'customer_id', 'INTEGER'); addCol('orders', 'pay_status', "TEXT NOT NULL DEFAULT 'paid'");
  addCol('orders', 'paid_amount', 'REAL NOT NULL DEFAULT 0'); addCol('orders', 'paid_now', 'REAL NOT NULL DEFAULT 0'); addCol('orders', 'loyalty', 'REAL NOT NULL DEFAULT 0');
  addCol('orders', 'rider_id', 'INTEGER'); addCol('orders', 'dstatus', "TEXT NOT NULL DEFAULT ''"); addCol('orders', 'out_at', "TEXT NOT NULL DEFAULT ''"); addCol('orders', 'delivered_at', "TEXT NOT NULL DEFAULT ''");
  d.exec("UPDATE orders SET paid_amount = total, paid_now = total WHERE status='paid' AND pay_status='paid' AND paid_amount = 0 AND total > 0");
  addCol('categories', 'description', "TEXT NOT NULL DEFAULT ''"); addCol('categories', 'color', "TEXT NOT NULL DEFAULT '#ea580c'");
  addCol('items', 'cost', 'REAL NOT NULL DEFAULT 0'); addCol('items', 'image', "TEXT NOT NULL DEFAULT ''"); addCol('items', 'description', "TEXT NOT NULL DEFAULT ''"); addCol('items', 'is_deal', 'INTEGER NOT NULL DEFAULT 0');
  addCol('expenses', 'category', "TEXT NOT NULL DEFAULT 'other'");
  d.exec(`
  CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', credit_limit REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS customer_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL DEFAULT 'cash', note TEXT NOT NULL DEFAULT '', day TEXT NOT NULL, created_at TEXT NOT NULL, user_name TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS supplier_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, material_id INTEGER, qty REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', day TEXT NOT NULL, created_at TEXT NOT NULL, user_name TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS materials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS riders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', vehicle TEXT NOT NULL DEFAULT '', fee REAL NOT NULL DEFAULT 0, user_id INTEGER, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, payee TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', amount REAL NOT NULL, method TEXT NOT NULL DEFAULT 'cash', day TEXT NOT NULL, created_at TEXT NOT NULL, user_name TEXT NOT NULL DEFAULT '');
  CREATE INDEX IF NOT EXISTS idx_orders_cust ON orders(customer_id);
  `);
  addCol('tables_', 'capacity', 'INTEGER NOT NULL DEFAULT 4'); addCol('tables_', 'section', "TEXT NOT NULL DEFAULT ''"); addCol('tables_', 'status', "TEXT NOT NULL DEFAULT 'available'");
  all('SELECT * FROM users').forEach((u) => {
    const sets = [], vals = [];
    if (!u.username) { const base = String(u.name || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'user'; let un = base, n = 1; while (one('SELECT id FROM users WHERE lower(username)=? AND id!=?', un, u.id)) un = base + (++n); sets.push('username=?'); vals.push(un); }
    if (!u.permissions) { sets.push('permissions=?'); vals.push(JSON.stringify(PRESETS[u.role] || PRESETS.cashier)); }
    if (!String(u.pin).includes(':')) { sets.push('pin=?'); vals.push(hash(u.pin)); }
    if (sets.length) run(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, ...vals, u.id);
  });
  if (!one('SELECT id FROM users LIMIT 1')) run("INSERT INTO users (name, username, pin, role, permissions) VALUES ('Admin', 'admin', ?, 'admin', ?)", hash('1234'), JSON.stringify(ALL_KEYS));

  const api = {};
  const parseItem = (r) => ({ ...r, variants: JSON.parse(r.variants || '[]') });
  const parseOrder = (r) => r && ({ ...r, items: JSON.parse(r.items || '[]') });
  const audit = (user, action, detail) => run('INSERT INTO audit (created_at, user_name, action, detail) VALUES (?,?,?,?)', new Date().toISOString(), user || '', action, detail || '');

  // ---- auth / users
  const cleanPerms = (arr) => [...new Set((Array.isArray(arr) ? arr : []).filter((k) => ALL_KEYS.includes(k)))];
  const userOut = (r) => r && ({ id: r.id, name: r.name, username: r.username, phone: r.phone || '', position: r.position || '', role: r.role, active: r.active,
    permissions: r.role === 'admin' ? ALL_KEYS.slice() : cleanPerms(JSON.parse(r.permissions || '[]')) });
  const validUser = (un) => /^[a-z0-9._-]{3,30}$/i.test(un);
  const taken = (un, exceptId) => !!one('SELECT id FROM users WHERE lower(username)=lower(?) AND id != ?', un, exceptId || 0);
  const guardLastAdmin = (id) => { if (!one("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id != ?", id).c) throw new Error('At least one active admin is required'); };
  const checkPin = (pin) => { const p = String(pin || ''); if (p.length < 4 || p.length > 30) throw new Error('PIN / password must be 4 to 30 characters'); return p; };

  api.login = (username, pin) => {
    const r = one('SELECT * FROM users WHERE lower(username)=lower(?) AND active=1', String(username || '').trim());
    return r && verify(pin, r.pin) ? userOut(r) : null;
  };
  api.sessionUser = (id) => userOut(one('SELECT * FROM users WHERE id=? AND active=1', id));
  api.permMeta = () => ({ perms: PERMS, presets: PRESETS, roles: ROLES });
  api.listUsers = () => all('SELECT * FROM users ORDER BY id').map(userOut);
  api.saveUser = (u, who) => {
    const name = String(u.name || '').trim(); if (!name) throw new Error('Name required');
    if (!ROLES.includes(u.role)) throw new Error('Invalid role');
    const perms = u.role === 'admin' ? ALL_KEYS : cleanPerms(u.permissions);
    const active = u.active === 0 || u.active === false ? 0 : 1;
    const phone = String(u.phone || '').trim(), position = String(u.position || '').trim();
    if (u.id) {
      const ex = one('SELECT * FROM users WHERE id=?', u.id); if (!ex) throw new Error('Staff not found');
      if (ex.role === 'admin' && (u.role !== 'admin' || !active)) guardLastAdmin(u.id);
      run('UPDATE users SET name=?, phone=?, position=?, role=?, active=?, permissions=? WHERE id=?', name, phone, position, u.role, active, JSON.stringify(perms), u.id);
      audit(who, 'STAFF EDIT', `${ex.username}: role ${u.role}, ${perms.length} permissions`);
    } else {
      const un = String(u.username || '').trim();
      if (!validUser(un)) throw new Error('Login ID: 3-30 letters/numbers (no spaces)');
      if (taken(un)) throw new Error('This Login ID is already used');
      run('INSERT INTO users (name, username, pin, role, active, phone, position, permissions) VALUES (?,?,?,?,?,?,?,?)', name, un, hash(checkPin(u.pin)), u.role, active, phone, position, JSON.stringify(perms));
      audit(who, 'STAFF ADD', `${un} (${u.role})`);
    }
    return api.listUsers();
  };
  api.changeLogin = (id, data, who) => {
    const ex = one('SELECT * FROM users WHERE id=?', id); if (!ex) throw new Error('Staff not found');
    const un = String((data && data.username) || ex.username).trim();
    if (!validUser(un)) throw new Error('Login ID: 3-30 letters/numbers (no spaces)');
    if (taken(un, id)) throw new Error('This Login ID is already used');
    const newPin = data && data.pin ? checkPin(data.pin) : null;
    if (newPin) run('UPDATE users SET username=?, pin=? WHERE id=?', un, hash(newPin), id); else run('UPDATE users SET username=? WHERE id=?', un, id);
    audit(who, 'CHANGE LOGIN', `${ex.username} -> ${un}${newPin ? ' (PIN changed)' : ''}`);
    return api.listUsers();
  };
  api.setUserActive = (id, active, selfId, who) => {
    const ex = one('SELECT * FROM users WHERE id=?', id); if (!ex) throw new Error('Staff not found');
    if (!active) { if (id === selfId) throw new Error('You cannot deactivate your own account'); if (ex.role === 'admin') guardLastAdmin(id); }
    run('UPDATE users SET active=? WHERE id=?', active ? 1 : 0, id);
    audit(who, active ? 'STAFF ACTIVATE' : 'STAFF DEACTIVATE', ex.username);
    return api.listUsers();
  };
  api.deleteUser = (id, selfId, who) => {
    const ex = one('SELECT * FROM users WHERE id=?', id); if (!ex) throw new Error('Staff not found');
    if (id === selfId) throw new Error('You cannot delete your own account');
    if (ex.role === 'admin') guardLastAdmin(id);
    run('DELETE FROM users WHERE id=?', id); audit(who, 'STAFF DELETE', ex.username);
    return api.listUsers();
  };
  api.changeMyPin = (selfId, oldPin, newPin) => {
    const r = one('SELECT * FROM users WHERE id=?', selfId);
    if (!r || !verify(oldPin, r.pin)) throw new Error('Current PIN is wrong');
    run('UPDATE users SET pin=? WHERE id=?', hash(checkPin(newPin)), selfId); audit(r.name, 'PIN CHANGED', r.username);
    return true;
  };
  api.auditLog = () => all('SELECT * FROM audit ORDER BY id DESC LIMIT 200');

  // ---- settings
  api.getSettings = () => { const s = { ...DEFAULTS }; all('SELECT key, value FROM settings').forEach((r) => { s[r.key] = r.value; }); return s; };
  api.saveSettings = (obj) => { tx(() => { Object.entries(obj).forEach(([k, v]) => run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(v ?? ''))); }); return api.getSettings(); };

  // ---- tables
  const TSTATUS = ['available', 'reserved', 'cleaning'];
  api.listTables = () => all("SELECT t.id, t.name, t.capacity, t.section, t.status, EXISTS(SELECT 1 FROM orders o WHERE o.status='held' AND o.type='dine-in' AND o.table_no=t.name) AS occupied FROM tables_ t ORDER BY t.sort, t.id");
  api.saveTable = (t) => {
    const name = String(t.name || '').trim(); if (!name) throw new Error('Table name required');
    const status = TSTATUS.includes(t.status) ? t.status : 'available', cap = Math.max(1, Math.round(num(t.capacity) || 4)), sec = String(t.section || '').trim();
    if (one('SELECT id FROM tables_ WHERE lower(name)=lower(?) AND id != ?', name, t.id || 0)) throw new Error('A table with this name already exists');
    if (t.id) run('UPDATE tables_ SET name=?, capacity=?, section=?, status=? WHERE id=?', name, cap, sec, status, t.id);
    else run('INSERT INTO tables_ (name, sort, capacity, section, status) VALUES (?,?,?,?,?)', name, one('SELECT COUNT(*) c FROM tables_').c, cap, sec, status);
    return api.listTables();
  };
  api.setTableStatus = (id, st) => {
    if (!TSTATUS.includes(st)) throw new Error('Invalid status');
    const t = one('SELECT * FROM tables_ WHERE id=?', id); if (!t) throw new Error('Table not found');
    if (one("SELECT id FROM orders WHERE status='held' AND type='dine-in' AND table_no=?", t.name)) throw new Error('This table has an open order');
    run('UPDATE tables_ SET status=? WHERE id=?', st, id); return api.listTables();
  };
  api.deleteTable = (id) => { run('DELETE FROM tables_ WHERE id=?', id); return api.listTables(); };

  // ---- menu
  api.getMenu = (includeInactive) => ({
    categories: all('SELECT * FROM categories ORDER BY sort, name'),
    items: all(`SELECT * FROM items ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY name`).map(parseItem)
  });
  api.saveCategory = (c) => {
    if (!c.name) throw new Error('Category name required');
    const desc = String(c.description || ''), col = /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#ea580c';
    if (c.id) run('UPDATE categories SET name=?, sort=?, description=?, color=? WHERE id=?', c.name, num(c.sort), desc, col, c.id);
    else run('INSERT INTO categories (name, sort, description, color) VALUES (?,?,?,?)', c.name, num(c.sort), desc, col);
    return api.getMenu(true);
  };
  api.deleteCategory = (id) => { run('DELETE FROM categories WHERE id=?', id); return api.getMenu(true); };
  api.saveItem = (i) => {
    if (!i.name) throw new Error('Item name required');
    if (!i.category_id) throw new Error('Category required');
    const v = JSON.stringify(i.variants || []), img = String(i.image || '').slice(0, 400000);
    if (i.id) run('UPDATE items SET category_id=?, name=?, price=?, variants=?, stock_track=?, stock=?, kitchen=?, active=?, cost=?, image=?, description=?, is_deal=? WHERE id=?', i.category_id, i.name, num(i.price), v, i.stock_track ? 1 : 0, num(i.stock), i.kitchen ? 1 : 0, i.active ? 1 : 0, num(i.cost), img, String(i.description || ''), i.is_deal ? 1 : 0, i.id);
    else run('INSERT INTO items (category_id, name, price, variants, stock_track, stock, kitchen, active, cost, image, description, is_deal) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', i.category_id, i.name, num(i.price), v, i.stock_track ? 1 : 0, num(i.stock), i.kitchen === 0 ? 0 : 1, i.active === 0 ? 0 : 1, num(i.cost), img, String(i.description || ''), i.is_deal ? 1 : 0);
    return api.getMenu(true);
  };
  api.deleteItem = (id) => { run('DELETE FROM items WHERE id=?', id); return api.getMenu(true); };
  api.importMenu = (rows) => tx(() => {
    let added = 0, updated = 0;
    (rows || []).forEach((r) => {
      const cname = String(r.category || 'General').trim() || 'General';
      let c = one('SELECT id FROM categories WHERE lower(name)=lower(?)', cname);
      if (!c) { run('INSERT INTO categories (name, sort) VALUES (?,?)', cname, one('SELECT COUNT(*) c FROM categories').c); c = one('SELECT id FROM categories WHERE lower(name)=lower(?)', cname); }
      const name = String(r.name || '').trim(); if (!name) return;
      const ex = one('SELECT id FROM items WHERE category_id=? AND lower(name)=lower(?)', c.id, name);
      const v = JSON.stringify(r.variants || []);
      if (ex) { run('UPDATE items SET price=?, variants=? WHERE id=?', num(r.price), v, ex.id); updated++; }
      else { run('INSERT INTO items (category_id, name, price, variants) VALUES (?,?,?,?)', c.id, name, num(r.price), v); added++; }
    });
    return { added, updated };
  });
  api.lowStock = () => all('SELECT name, stock FROM items WHERE stock_track=1 AND active=1 AND stock <= 5 ORDER BY stock');

  // ---- orders
  const adjustStock = (items, sign) => items.forEach((l) => {
    const it = one('SELECT stock_track FROM items WHERE id=?', l.item_id);
    if (it && it.stock_track) run('UPDATE items SET stock = stock + ? WHERE id=?', sign * num(l.qty), l.item_id);
  });
  const monthStart = () => dayOf(new Date()).slice(0, 8) + '01';
  const loyaltyFor = (cid) => {
    const st = api.getSettings();
    const m = one("SELECT COUNT(*) c FROM orders WHERE customer_id=? AND status='paid' AND day >= ?", cid, monthStart()).c;
    const levels = [[num(st.loyalty_min_orders), num(st.loyalty_percent)], [num(st.loyalty2_min_orders), num(st.loyalty2_percent)]].filter(([n, p]) => n > 0 && p > 0 && m >= n);
    return { monthOrders: m, pct: levels.length ? Math.max(...levels.map((l) => l[1])) : 0 };
  };
  api.saveOrder = (p) => tx(() => {
    const items = (p.items || []).map((l) => { const it = one('SELECT cost FROM items WHERE id=?', l.item_id); return { item_id: l.item_id, name: l.name, variant: l.variant || '', price: num(l.price), qty: num(l.qty), note: l.note || '', kitchen: l.kitchen === 0 ? 0 : 1, cost: it ? num(it.cost) : 0 }; });
    if (!items.length) throw new Error('Cart is empty');
    const status = p.status === 'held' ? 'held' : 'paid';
    const existing = p.id ? one('SELECT * FROM orders WHERE id=?', p.id) : null;
    if (existing && existing.status === 'paid') throw new Error('Order already paid');
    const type = p.type || 'dine-in';
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    let discount = p.discount_type === 'percent' ? subtotal * num(p.discount_value) / 100 : num(p.discount_value);
    discount = Math.min(Math.max(discount, 0), subtotal);
    let cust = p.customer_id ? one('SELECT * FROM customers WHERE id=?', p.customer_id) : null;
    const phone = String(p.phone || '').replace(/\D/g, '');
    if (!cust && phone.length >= 7) {
      cust = one('SELECT * FROM customers WHERE phone=?', phone);
      if (!cust && String(p.customer || '').trim()) { run('INSERT INTO customers (name, phone, address, created_at) VALUES (?,?,?,?)', String(p.customer).trim(), phone, p.address || '', new Date().toISOString()); cust = one('SELECT * FROM customers WHERE phone=?', phone); }
    }
    let loyalty = 0;
    if (p.loyalty && cust) { const el = loyaltyFor(cust.id); if (el.pct > 0) { loyalty = (subtotal - discount) * el.pct / 100; discount += loyalty; } }
    const st = api.getSettings(), base = subtotal - discount;
    const service = type === 'dine-in' ? base * num(st.service_percent) / 100 : 0;
    const tax = (base + service) * num(st.tax_percent) / 100;
    const delivery = type === 'delivery' ? num(st.delivery_fee) : 0;
    const total = Math.round(base + service + tax + delivery);
    let received = 0, payment = '', payStatus = 'unpaid', paidNow = 0;
    if (status === 'paid') {
      payStatus = ['paid', 'unpaid', 'partial'].includes(p.pay_status) ? p.pay_status : 'paid';
      if (payStatus === 'paid') paidNow = total;
      else if (payStatus === 'partial') { paidNow = num(p.paid_amount); if (!(paidNow > 0 && paidNow < total)) throw new Error('Partial amount must be more than 0 and less than the total'); }
      if (paidNow > 0) {
        payment = p.payment || 'cash';
        received = payment === 'cash' ? num(p.received) : paidNow;
        if (payment === 'cash' && received < paidNow) throw new Error('Cash received is less than the amount being paid');
      }
      const due = total - paidNow;
      if (due > 0) {
        if (!cust) throw new Error('Enter customer name + phone (or pick a saved customer) for unpaid / partial orders');
        if (num(cust.credit_limit) > 0 && num(cust.balance) + due > num(cust.credit_limit)) throw new Error(`Credit limit exceeded (limit ${cust.credit_limit}, already owes ${cust.balance})`);
      }
      items.forEach((l) => {
        const it = one('SELECT name, stock_track, stock FROM items WHERE id=?', l.item_id);
        if (it && it.stock_track && it.stock < l.qty) throw new Error(`Not enough stock for ${it.name} (left: ${it.stock})`);
      });
      adjustStock(items, -1);
      if (due > 0) run('UPDATE customers SET balance = balance + ? WHERE id=?', due, cust.id);
    }
    const now = new Date(), u = p.user || {};
    const vals = [type, p.table_no || '', (cust && cust.name) || p.customer || '', (cust && cust.phone) || p.phone || '', p.address || '', p.note || '', JSON.stringify(items), subtotal, discount, service, tax, delivery, total, payment, received, status, cust ? cust.id : null, payStatus, paidNow, paidNow, loyalty];
    let id;
    if (existing) {
      run('UPDATE orders SET type=?, table_no=?, customer=?, phone=?, address=?, note=?, items=?, subtotal=?, discount=?, service=?, tax=?, delivery=?, total=?, payment=?, received=?, status=?, customer_id=?, pay_status=?, paid_amount=?, paid_now=?, loyalty=?, stock_deducted=? WHERE id=?', ...vals, status === 'paid' ? 1 : 0, existing.id);
      id = existing.id;
    } else {
      const r = run('INSERT INTO orders (type, table_no, customer, phone, address, note, items, subtotal, discount, service, tax, delivery, total, payment, received, status, customer_id, pay_status, paid_amount, paid_now, loyalty, user_id, user_name, day, created_at, stock_deducted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...vals, u.id || null, u.name || '', dayOf(now), now.toISOString(), status === 'paid' ? 1 : 0);
      id = Number(r.lastInsertRowid);
    }
    return api.getOrder(id);
  });
  api.getOrder = (id) => { const o = parseOrder(one('SELECT o.*, r.name AS rider_name FROM orders o LEFT JOIN riders r ON r.id=o.rider_id WHERE o.id=?', id)); return o; };
  api.listOrders = (f = {}) => {
    const w = [], p = [];
    if (f.status) { w.push('status=?'); p.push(f.status); }
    if (f.day) { w.push('day=?'); p.push(f.day); }
    if (f.from) { w.push('day>=?'); p.push(f.from); }
    if (f.to) { w.push('day<=?'); p.push(f.to); }
    if (f.type) { w.push('type=?'); p.push(f.type); }
    if (f.pay_status) { w.push("pay_status=? AND status='paid'"); p.push(f.pay_status); }
    if (f.q) { const q = '%' + String(f.q).trim() + '%'; w.push('(CAST(id AS TEXT) LIKE ? OR customer LIKE ? OR phone LIKE ? OR table_no LIKE ?)'); p.push(q, q, q, q); }
    return all(`SELECT * FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 1000`, ...p).map(parseOrder);
  };
  api.deleteHeld = (id) => { run("DELETE FROM orders WHERE id=? AND status='held'", id); return true; };
  api.voidOrder = (id, who, reason) => tx(() => {
    const o = api.getOrder(id);
    if (!o || o.status !== 'paid') throw new Error('Only paid orders can be voided');
    if (o.stock_deducted) adjustStock(o.items, 1);
    const dueNow = Math.max(0, o.total - o.paid_amount);
    if (o.customer_id && dueNow > 0) run('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id=?', dueNow, o.customer_id);
    run("UPDATE orders SET status='void' WHERE id=?", id);
    audit(who, 'VOID', `Order #${id} (${Math.round(o.total)}) ${reason || ''}`.trim());
    return true;
  });
  api.reopenOrder = (id, who) => tx(() => {
    const o = api.getOrder(id);
    if (!o || o.status !== 'paid') throw new Error('Only completed orders can be reopened');
    if (o.stock_deducted) adjustStock(o.items, 1);
    const dueNow = Math.max(0, o.total - o.paid_amount);
    if (o.customer_id && dueNow > 0) run('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id=?', dueNow, o.customer_id);
    run("UPDATE orders SET status='held', pay_status='unpaid', paid_amount=0, paid_now=0, payment='', received=0, stock_deducted=0 WHERE id=?", id);
    audit(who, 'REOPEN ORDER', `Order #${id} reopened for editing (was ${Math.round(o.total)})`);
    return true;
  });
  api.transferTable = (id, table) => {
    const o = api.getOrder(id); if (!o || o.status !== 'held' || o.type !== 'dine-in') throw new Error('Only open dine-in orders can be moved');
    if (!one('SELECT id FROM tables_ WHERE name=?', table)) throw new Error('Table not found');
    if (one("SELECT id FROM orders WHERE status='held' AND type='dine-in' AND table_no=? AND id != ?", table, id)) throw new Error('That table already has an open order');
    run('UPDATE orders SET table_no=? WHERE id=?', table, id); return true;
  };
  api.loyaltyFor = loyaltyFor;

  // ---- customers / khata
  api.listCustomers = () => all(`SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.status='paid') AS total_orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.customer_id=c.id AND o.status='paid') AS spent,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.status='paid' AND o.day >= ?) AS month_orders,
      (SELECT MAX(created_at) FROM orders o WHERE o.customer_id=c.id AND o.status='paid') AS last_order
    FROM customers c ORDER BY c.name`, monthStart());
  api.findCustomer = (phone) => {
    const ph = String(phone || '').replace(/\D/g, ''); if (ph.length < 7) return null;
    const c = one('SELECT * FROM customers WHERE phone=?', ph); if (!c) return null;
    return { ...c, loyalty: loyaltyFor(c.id) };
  };
  api.saveCustomer = (c) => {
    const name = String(c.name || '').trim(); if (!name) throw new Error('Customer name required');
    const phone = String(c.phone || '').replace(/\D/g, '');
    if (phone && one('SELECT id FROM customers WHERE phone=? AND id != ?', phone, c.id || 0)) throw new Error('A customer with this phone already exists');
    const vals = [name, phone, String(c.email || '').trim(), String(c.address || '').trim(), String(c.notes || '').trim(), Math.max(0, num(c.credit_limit))];
    if (c.id) run('UPDATE customers SET name=?, phone=?, email=?, address=?, notes=?, credit_limit=? WHERE id=?', ...vals, c.id);
    else run('INSERT INTO customers (name, phone, email, address, notes, credit_limit, created_at) VALUES (?,?,?,?,?,?,?)', ...vals, new Date().toISOString());
    return api.listCustomers();
  };
  api.deleteCustomer = (id) => {
    const c = one('SELECT * FROM customers WHERE id=?', id); if (!c) return api.listCustomers();
    if (c.balance > 0) throw new Error('This customer still owes ' + Math.round(c.balance) + '. Collect the balance first.');
    run('UPDATE orders SET customer_id=NULL WHERE customer_id=?', id); run('DELETE FROM customer_payments WHERE customer_id=?', id); run('DELETE FROM customers WHERE id=?', id);
    return api.listCustomers();
  };
  api.customerLedger = (id) => ({
    customer: one('SELECT * FROM customers WHERE id=?', id),
    orders: all("SELECT id, day, created_at, total, paid_amount, pay_status FROM orders WHERE customer_id=? AND status='paid' ORDER BY id DESC LIMIT 200", id),
    payments: all('SELECT * FROM customer_payments WHERE customer_id=? ORDER BY id DESC LIMIT 200', id)
  });
  api.addCustomerPayment = (data, who) => tx(() => {
    const c = one('SELECT * FROM customers WHERE id=?', data.customer_id); if (!c) throw new Error('Customer not found');
    const amt = num(data.amount); if (!(amt > 0)) throw new Error('Enter an amount');
    if (amt > c.balance + 0.001) throw new Error('Amount is more than the balance (' + Math.round(c.balance) + ')');
    const method = ['cash', 'card', 'online'].includes(data.method) ? data.method : 'cash', now = new Date();
    run('INSERT INTO customer_payments (customer_id, amount, method, note, day, created_at, user_name) VALUES (?,?,?,?,?,?,?)', c.id, amt, method, String(data.note || ''), dayOf(now), now.toISOString(), who || '');
    run('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id=?', amt, c.id);
    let left = amt;
    all("SELECT id, total, paid_amount FROM orders WHERE customer_id=? AND status='paid' AND pay_status != 'paid' ORDER BY id", c.id).forEach((o) => {
      if (left <= 0) return; const take = Math.min(o.total - o.paid_amount, left); left -= take;
      const np = o.paid_amount + take; run('UPDATE orders SET paid_amount=?, pay_status=? WHERE id=?', np, np >= o.total - 0.001 ? 'paid' : 'partial', o.id);
    });
    audit(who, 'KHATA PAYMENT', `${c.name}: ${Math.round(amt)} (${method})`);
    return api.customerLedger(c.id);
  });

  // ---- suppliers + raw materials
  api.listSuppliers = () => all(`SELECT s.*, COALESCE((SELECT SUM(amount) FROM supplier_ledger l WHERE l.supplier_id=s.id AND l.type='purchase'),0) AS purchases,
    COALESCE((SELECT SUM(amount) FROM supplier_ledger l WHERE l.supplier_id=s.id AND l.type='payment'),0) AS payments FROM suppliers s ORDER BY s.name`).map((r) => ({ ...r, balance: r.purchases - r.payments }));
  api.saveSupplier = (x) => {
    const name = String(x.name || '').trim(); if (!name) throw new Error('Supplier name required');
    const v = [name, String(x.phone || '').trim(), String(x.address || '').trim(), String(x.notes || '').trim()];
    if (x.id) run('UPDATE suppliers SET name=?, phone=?, address=?, notes=? WHERE id=?', ...v, x.id); else run('INSERT INTO suppliers (name, phone, address, notes) VALUES (?,?,?,?)', ...v);
    return api.listSuppliers();
  };
  api.deleteSupplier = (id) => {
    const s = api.listSuppliers().find((x) => x.id === id);
    if (s && Math.abs(s.balance) > 0.5) throw new Error('This supplier has a pending balance of ' + Math.round(s.balance));
    run('DELETE FROM supplier_ledger WHERE supplier_id=?', id); run('DELETE FROM suppliers WHERE id=?', id); return api.listSuppliers();
  };
  api.supplierLedger = (id) => ({ supplier: api.listSuppliers().find((x) => x.id === id), entries: all('SELECT l.*, m.name AS material FROM supplier_ledger l LEFT JOIN materials m ON m.id=l.material_id WHERE l.supplier_id=? ORDER BY l.id DESC LIMIT 300', id) });
  api.addSupplierEntry = (e, who) => tx(() => {
    const sup = api.listSuppliers().find((x) => x.id === e.supplier_id); if (!sup) throw new Error('Supplier not found');
    const amt = num(e.amount); if (!(amt > 0)) throw new Error('Enter an amount');
    const now = new Date(), ins = (type, a, mid, qty, note) => run('INSERT INTO supplier_ledger (supplier_id, type, amount, material_id, qty, note, day, created_at, user_name) VALUES (?,?,?,?,?,?,?,?,?)', sup.id, type, a, mid || null, qty || 0, note || '', dayOf(now), now.toISOString(), who || '');
    if (e.type === 'purchase') {
      const qty = num(e.qty), mid = e.material_id || null;
      ins('purchase', amt, mid, qty, e.note);
      if (mid && qty > 0) run('UPDATE materials SET stock = stock + ?, cost = ? WHERE id=?', qty, amt / qty, mid);
      const paid = Math.min(num(e.paid), amt); if (paid > 0) ins('payment', paid, null, 0, 'Paid with purchase');
      audit(who, 'SUPPLIER PURCHASE', `${sup.name}: ${Math.round(amt)}`);
    } else {
      if (amt > sup.balance + 0.001) throw new Error('Payment is more than the balance (' + Math.round(sup.balance) + ')');
      ins('payment', amt, null, 0, e.note); audit(who, 'SUPPLIER PAYMENT', `${sup.name}: ${Math.round(amt)}`);
    }
    return api.supplierLedger(sup.id);
  });
  api.listMaterials = () => all('SELECT * FROM materials ORDER BY name');
  api.saveMaterial = (m) => {
    const name = String(m.name || '').trim(); if (!name) throw new Error('Material name required');
    const v = [name, String(m.unit || 'kg').trim() || 'kg', num(m.min_stock), num(m.cost)];
    if (m.id) run('UPDATE materials SET name=?, unit=?, min_stock=?, cost=? WHERE id=?', ...v, m.id); else run('INSERT INTO materials (name, unit, min_stock, cost, stock) VALUES (?,?,?,?,?)', ...v, num(m.stock));
    return api.listMaterials();
  };
  api.deleteMaterial = (id) => { run('DELETE FROM materials WHERE id=?', id); return api.listMaterials(); };
  api.adjustMaterial = (id, delta, note, who) => {
    const m = one('SELECT * FROM materials WHERE id=?', id); if (!m) throw new Error('Material not found');
    if (m.stock + num(delta) < 0) throw new Error('Stock cannot go below zero');
    run('UPDATE materials SET stock = stock + ? WHERE id=?', num(delta), id); audit(who, 'STOCK ADJUST', `${m.name}: ${num(delta) > 0 ? '+' : ''}${num(delta)} ${m.unit} ${note || ''}`.trim());
    return api.listMaterials();
  };
  api.lowMaterials = () => all('SELECT name, unit, stock, min_stock FROM materials WHERE min_stock > 0 AND stock <= min_stock ORDER BY name');

  // ---- payments register
  api.listPayouts = (f = {}) => all('SELECT * FROM payouts WHERE day >= ? AND day <= ? ORDER BY id DESC', f.from || '0000', f.to || '9999');
  api.addPayout = (x, who) => {
    const payee = String(x.payee || '').trim(), amt = num(x.amount); if (!payee || !(amt > 0)) throw new Error('Name and amount required');
    const method = ['cash', 'card', 'online'].includes(x.method) ? x.method : 'cash', now = new Date();
    run('INSERT INTO payouts (payee, purpose, amount, method, day, created_at, user_name) VALUES (?,?,?,?,?,?,?)', payee, String(x.purpose || ''), amt, method, dayOf(now), now.toISOString(), who || '');
    return true;
  };
  api.deletePayout = (id) => { run('DELETE FROM payouts WHERE id=?', id); return true; };
  api.pendingPayments = () => ({ suppliers: api.listSuppliers().filter((s) => s.balance > 0.5).map((s) => ({ name: s.name, balance: s.balance })), customers: one('SELECT COALESCE(SUM(balance),0) v FROM customers').v });

  // ---- riders + delivery
  api.listRiders = () => all(`SELECT r.*, u.name AS user_name, u.username,
      (SELECT COUNT(*) FROM orders o WHERE o.rider_id=r.id AND o.status IN ('paid','held') AND o.dstatus IN ('assigned','out')) AS active_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.rider_id=r.id AND o.dstatus='delivered' AND o.day=?) AS delivered_today
    FROM riders r LEFT JOIN users u ON u.id=r.user_id ORDER BY r.name`, dayOf(new Date())).map((r) => ({ ...r, status: !r.active ? 'inactive' : r.active_orders > 0 ? 'on-delivery' : 'available' }));
  api.saveRider = (r) => {
    const name = String(r.name || '').trim(); if (!name) throw new Error('Rider name required');
    const v = [name, String(r.phone || '').trim(), String(r.vehicle || '').trim(), Math.max(0, num(r.fee)), r.user_id || null, r.active === 0 || r.active === false ? 0 : 1];
    if (r.id) run('UPDATE riders SET name=?, phone=?, vehicle=?, fee=?, user_id=?, active=? WHERE id=?', ...v, r.id); else run('INSERT INTO riders (name, phone, vehicle, fee, user_id, active) VALUES (?,?,?,?,?,?)', ...v);
    return api.listRiders();
  };
  api.deleteRider = (id) => { run("UPDATE orders SET rider_id=NULL, dstatus='' WHERE rider_id=? AND dstatus IN ('assigned','out')", id); run('DELETE FROM riders WHERE id=?', id); return api.listRiders(); };
  api.listDeliveries = (f = {}) => {
    const w = ["o.type='delivery'", "o.status IN ('paid','held')"], p = [];
    if (f.day) { w.push('o.day=?'); p.push(f.day); }
    if (f.riderUserId) { w.push('o.rider_id IN (SELECT id FROM riders WHERE user_id=?)'); p.push(f.riderUserId); }
    return all(`SELECT o.*, r.name AS rider_name FROM orders o LEFT JOIN riders r ON r.id=o.rider_id WHERE ${w.join(' AND ')} ORDER BY o.id DESC LIMIT 300`, ...p).map(parseOrder);
  };
  api.assignRider = (orderId, riderId) => {
    const o = api.getOrder(orderId); if (!o || o.type !== 'delivery') throw new Error('Not a delivery order');
    if (!one('SELECT * FROM riders WHERE id=? AND active=1', riderId)) throw new Error('Rider not available');
    run("UPDATE orders SET rider_id=?, dstatus='assigned' WHERE id=?", riderId, orderId); return true;
  };
  api.setDeliveryStatus = (orderId, st, ctx) => {
    if (!['assigned', 'out', 'delivered'].includes(st)) throw new Error('Invalid status');
    const o = one('SELECT * FROM orders WHERE id=?', orderId); if (!o || o.type !== 'delivery') throw new Error('Not a delivery order');
    if (!o.rider_id) throw new Error('Assign a rider first');
    if (ctx && ctx.riderUserId) { const r = one('SELECT user_id FROM riders WHERE id=?', o.rider_id); if (!r || r.user_id !== ctx.riderUserId) throw new Error('This delivery is not assigned to you'); }
    const now = new Date().toISOString();
    if (st === 'out') run("UPDATE orders SET dstatus='out', out_at=? WHERE id=?", now, orderId);
    else if (st === 'delivered') run("UPDATE orders SET dstatus='delivered', delivered_at=?, out_at=CASE WHEN out_at='' THEN ? ELSE out_at END, kstatus='completed' WHERE id=?", now, now, orderId);
    else run("UPDATE orders SET dstatus='assigned', out_at='', delivered_at='' WHERE id=?", orderId);
    return true;
  };
  api.riderDetail = (id, from, to) => {
    from = from || dayOf(new Date()); to = to || from;
    const r = one('SELECT * FROM riders WHERE id=?', id); if (!r) throw new Error('Rider not found');
    const fee = r.fee > 0 ? r.fee : num(api.getSettings().delivery_fee);
    const rows = all("SELECT * FROM orders WHERE rider_id=? AND dstatus='delivered' AND status='paid' AND day>=? AND day<=? ORDER BY id DESC", id, from, to);
    return { rider: r, from, to, fee, count: rows.length, earnings: rows.length * fee, rows };
  };
  api.riderReport = (from, to) => api.listRiders().map((r) => { const x = api.riderDetail(r.id, from, to); return { id: r.id, name: r.name, status: r.status, deliveries: x.count, earnings: x.earnings }; });

  // ---- kitchen + dashboard
  api.kitchenOrders = () => all("SELECT * FROM orders WHERE status IN ('paid','held') AND kstatus != 'completed' AND day >= ? ORDER BY id", dayOf(new Date(Date.now() - 86400000))).map(parseOrder);
  api.setKitchenStatus = (id, st) => {
    if (!['pending', 'preparing', 'ready', 'completed'].includes(st)) throw new Error('Invalid status');
    run('UPDATE orders SET kstatus=? WHERE id=?', st, id); return true;
  };
  api.dashboard = () => {
    const day = dayOf(new Date());
    const paid = all("SELECT * FROM orders WHERE status='paid' AND day=?", day).map(parseOrder);
    const top = {}; paid.forEach((o) => o.items.forEach((i) => { top[i.name] = top[i.name] || { name: i.name, qty: 0, amount: 0 }; top[i.name].qty += i.qty; top[i.name].amount += i.price * i.qty; }));
    return { day, orders: paid.length, sales: paid.reduce((a, o) => a + o.total, 0), expenses: api.listExpenses({ from: day, to: day }).reduce((a, e) => a + e.amount, 0),
      held: one("SELECT COUNT(*) c FROM orders WHERE status='held'").c,
      kitchenActive: one("SELECT COUNT(*) c FROM orders WHERE status IN ('paid','held') AND kstatus IN ('pending','preparing') AND day >= ?", dayOf(new Date(Date.now() - 86400000))).c,
      lowStock: api.lowStock(), lowMaterials: api.lowMaterials(), topItems: Object.values(top).sort((a, b) => b.amount - a.amount).slice(0, 5),
      khataDue: one('SELECT COALESCE(SUM(balance),0) v FROM customers').v, supplierDue: api.listSuppliers().reduce((a, x) => a + Math.max(0, x.balance), 0),
      pendingDeliveries: one("SELECT COUNT(*) c FROM orders WHERE type='delivery' AND status IN ('paid','held') AND dstatus != 'delivered'").c };
  };

  // ---- expenses
  api.addExpense = (e) => {
    if (!e.title || !(num(e.amount) > 0)) throw new Error('Title and amount required');
    const cat = ['marketing', 'rent', 'salaries', 'utilities', 'supplies', 'other'].includes(e.category) ? e.category : 'other';
    run('INSERT INTO expenses (day, title, amount, user_name, category) VALUES (?,?,?,?,?)', dayOf(new Date()), e.title, num(e.amount), e.user || '', cat);
    return all('SELECT * FROM expenses ORDER BY id DESC LIMIT 50');
  };
  api.deleteExpense = (id) => { run('DELETE FROM expenses WHERE id=?', id); return true; };
  api.listExpenses = (f = {}) => all('SELECT * FROM expenses WHERE day >= ? AND day <= ? ORDER BY id DESC', f.from || '0000', f.to || '9999');

  // ---- reports
  api.report = (from, to) => {
    from = from || dayOf(new Date()); to = to || from;
    const paid = all("SELECT * FROM orders WHERE status='paid' AND day>=? AND day<=?", from, to).map(parseOrder);
    const voided = all("SELECT total FROM orders WHERE status='void' AND day>=? AND day<=?", from, to);
    const sum = (k) => paid.reduce((a, o) => a + num(o[k]), 0);
    const group = (keyFn, f = 'total') => paid.reduce((m, o) => { const k = keyFn(o) || '-'; m[k] = (m[k] || 0) + num(o[f]); return m; }, {});
    const byHour = {}; paid.forEach((o) => { const h = new Date(o.created_at).getHours(); byHour[h] = (byHour[h] || 0) + num(o.total); });
    const prod = {}, lines = []; let cogs = 0;
    paid.forEach((o) => o.items.forEach((i) => {
      const k = i.name + (i.variant ? ` (${i.variant})` : ''), rev = i.price * i.qty, cost = num(i.cost) * i.qty; cogs += cost;
      const e = prod[k] = prod[k] || { name: k, qty: 0, revenue: 0, cost: 0, profit: 0 }; e.qty += i.qty; e.revenue += rev; e.cost += cost; e.profit += rev - cost;
      lines.push({ order: o.id, day: o.day, product: k, qty: i.qty, price: i.price, revenue: rev, cost, profit: rev - cost, cashier: o.user_name });
    }));
    const exps = api.listExpenses({ from, to }), expenses = exps.reduce((a, e) => a + e.amount, 0);
    const expByCat = exps.reduce((m, e) => { m[e.category || 'other'] = (m[e.category || 'other'] || 0) + e.amount; return m; }, {});
    const trendMap = {}; paid.forEach((o) => { const t = trendMap[o.day] = trendMap[o.day] || { day: o.day, total: 0, orders: 0 }; t.total += o.total; t.orders++; });
    const revenue = paid.reduce((a, o) => a + num(o.subtotal) - num(o.discount) + num(o.service) + num(o.delivery), 0);
    const grossProfit = revenue - cogs, total = sum('total');
    const cashSales = paid.filter((o) => o.payment === 'cash').reduce((a, o) => a + o.paid_now, 0);
    const pays = all('SELECT * FROM customer_payments WHERE day>=? AND day<=?', from, to);
    const khataCollected = pays.reduce((a, p) => a + p.amount, 0), khataCash = pays.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
    const products = Object.values(prod).sort((a, b) => b.profit - a.profit).map((p) => ({ ...p, margin: p.revenue ? p.profit / p.revenue * 100 : 0 }));
    return { from, to, orders: paid.length, transactions: paid.length, expenseCount: exps.length, subtotal: sum('subtotal'), discount: sum('discount'), service: sum('service'), tax: sum('tax'), delivery: sum('delivery'), total,
      revenue, cogs, grossProfit, margin: revenue ? grossProfit / revenue * 100 : 0, expenses, expByCat, netProfit: grossProfit - expenses, net: grossProfit - expenses,
      byPayment: group((o) => o.payment, 'paid_now'), byType: group((o) => o.type), byUser: group((o) => o.user_name), byCustomer: group((o) => o.customer || 'Walk-in'), byHour,
      topItems: Object.values(prod).sort((a, b) => b.revenue - a.revenue).slice(0, 10), products, lines,
      trend: Object.values(trendMap).sort((a, b) => a.day < b.day ? -1 : 1),
      voids: { count: voided.length, total: voided.reduce((a, o) => a + o.total, 0) },
      dueFromCustomers: paid.reduce((a, o) => a + Math.max(0, o.total - o.paid_amount), 0), khataOutstanding: one('SELECT COALESCE(SUM(balance),0) v FROM customers').v, khataCollected,
      cashInDrawer: cashSales + khataCash - expenses };
  };

  // ---- data reset (keeps menu, categories, tables, staff, suppliers, materials)
  api.resetSalesData = (who) => tx(() => {
    try { d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); require('fs').copyFileSync(file, file + '.before-reset-' + Date.now()); } catch (e) { /* best effort */ }
    run('DELETE FROM orders'); run('DELETE FROM expenses'); run('DELETE FROM customer_payments'); run('DELETE FROM payouts'); run('UPDATE customers SET balance = 0');
    run("DELETE FROM sqlite_sequence WHERE name IN ('orders','expenses','customer_payments','payouts')");
    audit(who, 'RESET SALES DATA', 'All orders, expenses and payments deleted'); return true;
  });

  api.close = () => d.close();
  api.backupTo = (dest) => { d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); require('fs').copyFileSync(file, dest); };
  return api;
};
