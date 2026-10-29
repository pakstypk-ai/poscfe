'use strict';
// SQLite data layer. Works with better-sqlite3 (app) and node:sqlite DatabaseSync (tests).
const DEFAULTS = {
  name: 'My Cafe', tagline: '', address: '', phone: '', ntn: '', logo: '', receipt_footer: 'Thank you! Visit again',
  currency: 'Rs.', tax_label: 'GST', tax_percent: '0', service_percent: '0', delivery_fee: '0', paper_width: '80',
  silent_print: '0', print_kot: '0', fbr_enabled: '0', fbr_pos_id: '', fbr_token: '', setup_done: '0'
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

  if (!one('SELECT id FROM users LIMIT 1')) run("INSERT INTO users (name, pin, role) VALUES ('Admin', '1234', 'admin')");

  const api = {};
  const parseItem = (r) => ({ ...r, variants: JSON.parse(r.variants || '[]') });
  const parseOrder = (r) => r && ({ ...r, items: JSON.parse(r.items || '[]') });
  const audit = (user, action, detail) => run('INSERT INTO audit (created_at, user_name, action, detail) VALUES (?,?,?,?)', new Date().toISOString(), user || '', action, detail || '');

  // ---- auth / users
  api.login = (pin) => { const u = one('SELECT id, name, role FROM users WHERE pin = ? AND active = 1', String(pin || '')); return u; };
  api.listUsers = () => all('SELECT * FROM users ORDER BY id');
  api.saveUser = (u) => {
    if (!u.name) throw new Error('Name required');
    if (!/^\d{4,6}$/.test(String(u.pin || ''))) throw new Error('PIN must be 4-6 digits');
    const dup = one('SELECT id FROM users WHERE pin = ? AND id != ?', String(u.pin), u.id || 0);
    if (dup) throw new Error('This PIN is already used by another staff');
    if (u.id) {
      if (u.role !== 'admin' || !u.active) {
        const others = one("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id != ?", u.id).c;
        if (!others) throw new Error('At least one active admin is required');
      }
      run('UPDATE users SET name=?, pin=?, role=?, active=? WHERE id=?', u.name, String(u.pin), u.role, u.active ? 1 : 0, u.id);
    } else run('INSERT INTO users (name, pin, role, active) VALUES (?,?,?,?)', u.name, String(u.pin), u.role, u.active ? 1 : 0);
    return api.listUsers();
  };
  api.deleteUser = (id) => {
    const u = one('SELECT * FROM users WHERE id=?', id);
    if (u && u.role === 'admin' && !one("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id != ?", id).c) throw new Error('Cannot delete the last admin');
    run('DELETE FROM users WHERE id=?', id); return api.listUsers();
  };
  api.auditLog = () => all('SELECT * FROM audit ORDER BY id DESC LIMIT 200');

  // ---- settings
  api.getSettings = () => { const s = { ...DEFAULTS }; all('SELECT key, value FROM settings').forEach((r) => { s[r.key] = r.value; }); return s; };
  api.saveSettings = (obj) => { tx(() => { Object.entries(obj).forEach(([k, v]) => run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(v ?? ''))); }); return api.getSettings(); };

  // ---- tables
  api.listTables = () => all('SELECT id, name FROM tables_ ORDER BY sort, id');
  api.saveTables = (names) => {
    const clean = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
    tx(() => { run('DELETE FROM tables_'); clean.forEach((n, i) => run('INSERT INTO tables_ (name, sort) VALUES (?,?)', n, i)); });
    return api.listTables();
  };

  // ---- menu
  api.getMenu = (includeInactive) => ({
    categories: all('SELECT * FROM categories ORDER BY sort, name'),
    items: all(`SELECT * FROM items ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY name`).map(parseItem)
  });
  api.saveCategory = (c) => {
    if (!c.name) throw new Error('Category name required');
    if (c.id) run('UPDATE categories SET name=?, sort=? WHERE id=?', c.name, num(c.sort), c.id); else run('INSERT INTO categories (name, sort) VALUES (?,?)', c.name, num(c.sort));
    return api.getMenu(true);
  };
  api.deleteCategory = (id) => { run('DELETE FROM categories WHERE id=?', id); return api.getMenu(true); };
  api.saveItem = (i) => {
    if (!i.name) throw new Error('Item name required');
    if (!i.category_id) throw new Error('Category required');
    const v = JSON.stringify(i.variants || []);
    if (i.id) run('UPDATE items SET category_id=?, name=?, price=?, variants=?, stock_track=?, stock=?, kitchen=?, active=? WHERE id=?', i.category_id, i.name, num(i.price), v, i.stock_track ? 1 : 0, num(i.stock), i.kitchen ? 1 : 0, i.active ? 1 : 0, i.id);
    else run('INSERT INTO items (category_id, name, price, variants, stock_track, stock, kitchen, active) VALUES (?,?,?,?,?,?,?,?)', i.category_id, i.name, num(i.price), v, i.stock_track ? 1 : 0, num(i.stock), i.kitchen === 0 ? 0 : 1, i.active === 0 ? 0 : 1);
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
  api.saveOrder = (p) => tx(() => {
    const items = (p.items || []).map((l) => ({ item_id: l.item_id, name: l.name, variant: l.variant || '', price: num(l.price), qty: num(l.qty), note: l.note || '', kitchen: l.kitchen === 0 ? 0 : 1 }));
    if (!items.length) throw new Error('Cart is empty');
    const status = p.status === 'held' ? 'held' : 'paid';
    const existing = p.id ? one('SELECT * FROM orders WHERE id=?', p.id) : null;
    if (existing && existing.status === 'paid') throw new Error('Order already paid');
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    let discount = p.discount_type === 'percent' ? subtotal * num(p.discount_value) / 100 : num(p.discount_value);
    discount = Math.min(Math.max(discount, 0), subtotal);
    const st = api.getSettings(), base = subtotal - discount;
    const type = p.type || 'dine-in';
    const service = type === 'dine-in' ? base * num(st.service_percent) / 100 : 0;
    const tax = (base + service) * num(st.tax_percent) / 100;
    const delivery = type === 'delivery' ? num(st.delivery_fee) : 0;
    const total = Math.round(base + service + tax + delivery);
    let received = 0, payment = '';
    if (status === 'paid') {
      payment = p.payment || 'cash';
      received = payment === 'cash' ? num(p.received) : total;
      if (payment === 'cash' && received < total) throw new Error('Cash received is less than total');
      items.forEach((l) => {
        const it = one('SELECT name, stock_track, stock FROM items WHERE id=?', l.item_id);
        if (it && it.stock_track && it.stock < l.qty) throw new Error(`Not enough stock for ${it.name} (left: ${it.stock})`);
      });
      adjustStock(items, -1);
    }
    const now = new Date(), u = p.user || {};
    const vals = [type, p.table_no || '', p.customer || '', p.phone || '', p.address || '', p.note || '', JSON.stringify(items), subtotal, discount, service, tax, delivery, total, payment, received, status];
    let id;
    if (existing) {
      run('UPDATE orders SET type=?, table_no=?, customer=?, phone=?, address=?, note=?, items=?, subtotal=?, discount=?, service=?, tax=?, delivery=?, total=?, payment=?, received=?, status=?, stock_deducted=? WHERE id=?', ...vals, status === 'paid' ? 1 : 0, existing.id);
      id = existing.id;
    } else {
      const r = run('INSERT INTO orders (type, table_no, customer, phone, address, note, items, subtotal, discount, service, tax, delivery, total, payment, received, status, user_id, user_name, day, created_at, stock_deducted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...vals, u.id || null, u.name || '', dayOf(now), now.toISOString(), status === 'paid' ? 1 : 0);
      id = Number(r.lastInsertRowid);
    }
    return parseOrder(one('SELECT * FROM orders WHERE id=?', id));
  });
  api.getOrder = (id) => parseOrder(one('SELECT * FROM orders WHERE id=?', id));
  api.listOrders = (f = {}) => {
    const w = [], p = [];
    if (f.status) { w.push('status=?'); p.push(f.status); }
    if (f.day) { w.push('day=?'); p.push(f.day); }
    return all(`SELECT * FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, ...p).map(parseOrder);
  };
  api.deleteHeld = (id) => { run("DELETE FROM orders WHERE id=? AND status='held'", id); return true; };
  api.voidOrder = (id, who, reason) => tx(() => {
    const o = api.getOrder(id);
    if (!o || o.status !== 'paid') throw new Error('Only paid orders can be voided');
    if (o.stock_deducted) adjustStock(o.items, 1);
    run("UPDATE orders SET status='void' WHERE id=?", id);
    audit(who, 'VOID', `Order #${id} (${Math.round(o.total)}) ${reason || ''}`.trim());
    return true;
  });

  // ---- expenses
  api.addExpense = (e) => {
    if (!e.title || !(num(e.amount) > 0)) throw new Error('Title and amount required');
    run('INSERT INTO expenses (day, title, amount, user_name) VALUES (?,?,?,?)', dayOf(new Date()), e.title, num(e.amount), e.user || '');
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
    const group = (keyFn) => paid.reduce((m, o) => { const k = keyFn(o) || '-'; m[k] = (m[k] || 0) + num(o.total); return m; }, {});
    const byHour = {}; paid.forEach((o) => { const h = new Date(o.created_at).getHours(); byHour[h] = (byHour[h] || 0) + num(o.total); });
    const top = {}; paid.forEach((o) => o.items.forEach((i) => { const k = i.name + (i.variant ? ` (${i.variant})` : ''); top[k] = top[k] || { name: k, qty: 0, amount: 0 }; top[k].qty += i.qty; top[k].amount += i.price * i.qty; }));
    const expenses = api.listExpenses({ from, to }).reduce((a, e) => a + e.amount, 0);
    const byPayment = group((o) => o.payment), total = sum('total');
    const cashSales = paid.filter((o) => o.payment === 'cash').reduce((a, o) => a + o.total, 0);
    return { from, to, orders: paid.length, subtotal: sum('subtotal'), discount: sum('discount'), service: sum('service'), tax: sum('tax'), delivery: sum('delivery'), total, expenses, net: total - expenses,
      byPayment, byType: group((o) => o.type), byUser: group((o) => o.user_name), byHour,
      topItems: Object.values(top).sort((a, b) => b.amount - a.amount).slice(0, 10),
      voids: { count: voided.length, total: voided.reduce((a, o) => a + o.total, 0) }, cashInDrawer: cashSales - expenses };
  };

  api.close = () => d.close();
  api.backupTo = (dest) => { d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); require('fs').copyFileSync(file, dest); };
  return api;
};
