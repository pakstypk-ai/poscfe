'use strict';
// ================= MENU =================
let mCat = 0;
async function viewMenu() {
  S.menu = await api('getMenu', true);
  const cats = S.menu.categories;
  const items = S.menu.items.filter((i) => !mCat || i.category_id === mCat);
  const cname = (id) => (cats.find((c) => c.id === id) || {}).name || '';
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Menu</h2><button data-act="impText">Import from text / PDF copy</button><button data-act="impCsv">Import CSV</button><button class="pri" data-act="editItem" data-id="0">+ Add item</button></div>
  <div class="split"><div class="side card"><div class="c ${!mCat ? 'on' : ''}" data-act="mcat" data-id="0">All items</div>${cats.map((c) => `<div class="c ${mCat === c.id ? 'on' : ''}" data-act="mcat" data-id="${c.id}"><span>${esc(c.name)}</span><span><a data-act="editCat" data-id="${c.id}" style="cursor:pointer">✎</a></span></div>`).join('')}<button style="margin-top:8px;width:100%" data-act="editCat" data-id="0">+ Category</button></div>
  <div class="card" style="flex:1"><table><tr><th>Item</th><th>Category</th><th class="r">Price</th><th>Variants</th><th>Stock</th><th></th></tr>
  ${items.map((i) => `<tr style="${i.active ? '' : 'opacity:.4'}"><td>${esc(i.name)}</td><td>${esc(cname(i.category_id))}</td><td class="r">${money(i.price)}</td><td>${i.variants.map((v) => esc(v.name) + ':' + v.price).join(', ')}</td><td>${i.stock_track ? i.stock : '-'}</td><td><button data-act="editItem" data-id="${i.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="6" class="mut">No items yet. Add or import your menu.</td></tr>'}</table></div></div></div>`;
}
A.mcat = (d) => { mCat = Number(d.id); viewMenu(); };
A.editCat = (d) => {
  const c = S.menu.categories.find((x) => x.id === Number(d.id)) || { id: 0, name: '', sort: 0 };
  openModal(`<h3>${c.id ? 'Edit' : 'New'} category</h3><label>Name</label><input id="cname" value="${esc(c.name)}"><label>Sort order</label><input id="csort" type="number" value="${c.sort}">
  <div class="foot">${c.id ? `<button class="bad" data-act="delCat" data-id="${c.id}">Delete (with items)</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveCat" data-id="${c.id}">Save</button></div>`);
};
A.saveCat = async (d) => { await api('saveCategory', { id: Number(d.id) || undefined, name: val('cname').trim(), sort: Number(val('csort')) || 0 }); closeModal(); viewMenu(); };
A.delCat = async (d) => { if (!confirm('Delete this category and all its items?')) return; await api('deleteCategory', Number(d.id)); mCat = 0; closeModal(); viewMenu(); };
A.editItem = (d) => {
  const i = S.menu.items.find((x) => x.id === Number(d.id)) || { id: 0, name: '', category_id: mCat || (S.menu.categories[0] || {}).id, price: 0, variants: [], stock_track: 0, stock: 0, active: 1, kitchen: 1 };
  if (!S.menu.categories.length) return toast('Create a category first', true);
  openModal(`<h3>${i.id ? 'Edit' : 'New'} item</h3><label>Name</label><input id="iname" value="${esc(i.name)}"><div class="row2"><div><label>Category</label><select id="icat">${S.menu.categories.map((c) => `<option value="${c.id}" ${c.id === i.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div><label>Price</label><input id="iprice" type="number" value="${i.price}"></div></div>
  <label>Variants (optional) - e.g. Small:350, Large:500</label><input id="ivar" value="${esc(i.variants.map((v) => v.name + ':' + v.price).join(', '))}">
  <div class="row2"><div><label><input type="checkbox" id="itrack" style="width:auto" ${i.stock_track ? 'checked' : ''}> Track stock</label><input id="istock" type="number" value="${i.stock}"></div><div><label><input type="checkbox" id="ikit" style="width:auto" ${i.kitchen ? 'checked' : ''}> Print on kitchen KOT</label><label><input type="checkbox" id="iact" style="width:auto" ${i.active ? 'checked' : ''}> Active (visible on POS)</label></div></div>
  <div class="foot">${i.id ? `<button class="bad" data-act="delItem" data-id="${i.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveItem" data-id="${i.id}">Save</button></div>`);
};
const parseVariants = (t) => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).map((x) => { const k = x.lastIndexOf(':'); return k > 0 ? { name: x.slice(0, k).trim(), price: Number(x.slice(k + 1)) } : null; }).filter((v) => v && v.price >= 0);
A.saveItem = async (d) => {
  await api('saveItem', { id: Number(d.id) || undefined, name: val('iname').trim(), category_id: Number(val('icat')), price: Number(val('iprice')) || 0, variants: parseVariants(val('ivar')),
    stock_track: chk('itrack'), stock: Number(val('istock')) || 0, kitchen: chk('ikit') ? 1 : 0, active: chk('iact') ? 1 : 0 });
  closeModal(); viewMenu();
};
A.delItem = async (d) => { if (!confirm('Delete this item?')) return; await api('deleteItem', Number(d.id)); closeModal(); viewMenu(); };

// --- import ---
function parseMenuText(text) {
  const rows = []; let cat = 'General';
  text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((line) => {
    const m = line.match(/^(.*?)[\s.\-–:]*(?:rs\.?|pkr)?\s*([\d][\d,]*(?:\.\d+)?)\s*(?:\/-|rs\.?)?$/i);
    if (m && m[1].trim().length > 1 && !/^\d+$/.test(m[1].trim())) rows.push({ category: cat, name: m[1].trim().replace(/[.\-–:]+$/, '').trim(), price: Number(m[2].replace(/,/g, '')), variants: [] });
    else if (line.length <= 40 && !/\d/.test(line)) cat = line.replace(/[:\-–]+$/, '').trim();
  });
  return rows;
}
function parseCsv(text) {
  const out = []; const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (l) => { const r = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(c); c = ''; } else c += ch; } r.push(c); return r.map((x) => x.trim()); };
  lines.forEach((l, k) => {
    const [category, name, price, variants] = split(l);
    if (k === 0 && /category/i.test(category) && /name|item/i.test(name)) return;
    if (!name || isNaN(Number(price))) return;
    out.push({ category: category || 'General', name, price: Number(price), variants: variants ? variants.split('|').map((v) => { const p = v.split(':'); return { name: p[0].trim(), price: Number(p[1]) }; }).filter((v) => v.name && v.price >= 0) : [] });
  });
  return out;
}
let pending = [];
function previewImport(rows) {
  pending = rows;
  openModal(`<h3>Preview: ${rows.length} items found</h3><div style="max-height:50vh;overflow:auto"><table><tr><th>Category</th><th>Item</th><th class="r">Price</th></tr>${rows.map((r) => `<tr><td>${esc(r.category)}</td><td>${esc(r.name)}${r.variants.length ? ' <small class="mut">(' + r.variants.map((v) => v.name + ':' + v.price).join(', ') + ')</small>' : ''}</td><td class="r">${r.price}</td></tr>`).join('')}</table></div>
  <div class="mut" style="margin-top:6px">Existing items with the same name/category will be updated. You can edit anything later in the Menu tab.</div><div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="doImport" ${rows.length ? '' : 'disabled'}>Import ${rows.length} items</button></div>`);
}
A.impText = () => openModal(`<h3>Import menu from text</h3><div class="mut" style="margin-bottom:6px">Open your menu PDF, select all (Ctrl+A), copy (Ctrl+C) and paste below. Category names on their own line; items as "Name 650".</div><textarea id="mtext" rows="14" placeholder="BURGERS\nZinger Burger 650\nBeef Burger 750\nCOFFEE\nLatte 400"></textarea><div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="impTextGo">Preview</button></div>`);
A.impTextGo = () => previewImport(parseMenuText(val('mtext')));
A.impCsv = () => openModal(`<h3>Import CSV</h3><div class="mut" style="margin-bottom:6px">Columns: <b>category, name, price, variants</b> (variants optional like Small:350|Large:500). In Excel use Save As → CSV.</div><input type="file" id="csvf" accept=".csv,.txt"><div class="foot"><button data-act="close">Cancel</button></div>`);
document.addEventListener('change', (e) => {
  if (e.target.id === 'csvf' && e.target.files[0]) { const r = new FileReader(); r.onload = () => previewImport(parseCsv(String(r.result).replace(/^\uFEFF/, ''))); r.readAsText(e.target.files[0]); }
  if (e.target.id === 'logof' && e.target.files[0]) { const r = new FileReader(); r.onload = () => { window._logo = r.result; const p = document.getElementById('logoPrev'); if (p) p.src = r.result; }; r.readAsDataURL(e.target.files[0]); }
});
A.doImport = async () => { const r = await api('importMenu', pending); closeModal(); toast(`Imported: ${r.added} new, ${r.updated} updated`); viewMenu(); };

// ================= REPORTS =================
let rFrom = null, rTo = null;
async function viewReports() {
  rFrom = rFrom || todayStr(); rTo = rTo || rFrom;
  const r = await api('report', rFrom, rTo); const ex = await api('listExpenses', { from: rFrom, to: rTo }); const low = await api('lowStock');
  window._rep = r;
  const kv = (o) => Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${money(v)}</td></tr>`).join('') || '<tr><td class="mut">-</td><td></td></tr>';
  const maxH = Math.max(1, ...Object.values(r.byHour));
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Reports</h2><input type="date" id="rf" value="${rFrom}" style="width:150px"><input type="date" id="rt" value="${rTo}" style="width:150px"><button data-act="repGo">Show</button><button data-act="repToday">Today</button><button class="pri" data-act="printZ">Print day report</button></div>
  <div class="grid g4"><div class="card stat"><div class="l">Total sales</div><div class="v">${money(r.total)}</div></div><div class="card stat"><div class="l">Orders</div><div class="v">${r.orders}</div></div><div class="card stat"><div class="l">Expenses</div><div class="v">${money(r.expenses)}</div></div><div class="card stat"><div class="l">Net (sales - expenses)</div><div class="v">${money(r.net)}</div></div></div>
  <div class="grid g4" style="margin-top:12px"><div class="card stat"><div class="l">Discounts</div><div class="v">${money(r.discount)}</div></div><div class="card stat"><div class="l">Tax collected</div><div class="v">${money(r.tax)}</div></div><div class="card stat"><div class="l">Voided orders</div><div class="v">${r.voids.count} <small class="mut">(${money(r.voids.total)})</small></div></div><div class="card stat"><div class="l">Cash in drawer (cash sales - expenses)</div><div class="v">${money(r.cashInDrawer)}</div></div></div>
  <div class="grid g3" style="margin-top:12px"><div class="card"><b>By payment</b><table>${kv(r.byPayment)}</table></div><div class="card"><b>By order type</b><table>${kv(r.byType)}</table></div><div class="card"><b>By staff</b><table>${kv(r.byUser)}</table></div></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><b>Top items</b><table><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr>${r.topItems.map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${money(i.amount)}</td></tr>`).join('') || '<tr><td class="mut">-</td></tr>'}</table></div>
  <div class="card"><b>Sales by hour</b>${Object.entries(r.byHour).sort((a, b) => a[0] - b[0]).map(([h, v]) => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span style="width:44px">${h}:00</span><div class="bar" style="width:${Math.round(v / maxH * 100)}%"></div><span class="mut">${money(v)}</span></div>`).join('') || '<div class="mut">-</div>'}
  ${low.length ? `<div style="margin-top:14px"><b style="color:var(--bad)">Low stock</b>${low.map((l) => `<div>${esc(l.name)}: ${l.stock}</div>`).join('')}</div>` : ''}</div></div>
  <div class="card" style="margin-top:12px"><div class="h"><b style="flex:1">Expenses</b><input id="etitle" placeholder="Title (e.g. Milk)" style="width:220px"><input id="eamt" type="number" placeholder="Amount" style="width:120px"><button class="pri" data-act="addExp">Add</button></div>
  <table>${ex.map((e) => `<tr><td>${e.day}</td><td>${esc(e.title)}</td><td class="r">${money(e.amount)}</td><td class="r"><button class="ghost" data-act="delExp" data-id="${e.id}">X</button></td></tr>`).join('') || '<tr><td class="mut">No expenses</td></tr>'}</table></div></div>`;
}
A.repGo = () => { rFrom = val('rf'); rTo = val('rt') || rFrom; viewReports(); };
A.repToday = () => { rFrom = rTo = todayStr(); viewReports(); };
A.addExp = async () => { await api('addExpense', { title: val('etitle'), amount: val('eamt'), user: S.user.name }); viewReports(); };
A.delExp = async (d) => { await api('deleteExpense', Number(d.id)); viewReports(); };
A.printZ = () => {
  const r = window._rep, s = S.settings, row = (a, b) => `<tr><td>${esc(a)}</td><td class="r">${typeof b === 'number' ? Math.round(b) : esc(b)}</td></tr>`;
  const html = `<html><head><meta charset="utf-8">${pcss()}</head><body><h1>${esc(s.name)}</h1><div class="c t">DAY REPORT</div><div class="c">${r.from}${r.to !== r.from ? ' to ' + r.to : ''}<br>Printed by ${esc(S.user.name)}</div><div class="b"></div>
  <table>${row('Orders', r.orders)}${row('Subtotal', r.subtotal)}${row('Discounts', -r.discount)}${row('Service', r.service)}${row('Tax', r.tax)}${row('Delivery', r.delivery)}<tr class="t"><td>TOTAL SALES</td><td class="r">${Math.round(r.total)}</td></tr></table><div class="b"></div>
  <b>Payments</b><table>${Object.entries(r.byPayment).map(([k, v]) => row(k, v)).join('')}</table><div class="b"></div><table>${row('Expenses', -r.expenses)}${row('Cash sales', r.byPayment.cash || 0)}<tr class="t"><td>CASH IN DRAWER</td><td class="r">${Math.round(r.cashInDrawer)}</td></tr>${row('Voided orders', r.voids.count + ' / ' + Math.round(r.voids.total))}</table></body></html>`;
  window.pos.print(html, S.settings.silent_print === '1');
};

// ================= STAFF =================
async function viewStaff() {
  const us = await api('listUsers');
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Staff</h2><button class="pri" data-act="editUser" data-id="0">+ Add staff</button></div><div class="card"><table><tr><th>Name</th><th>Role</th><th>PIN</th><th>Status</th><th></th></tr>
  ${us.map((u) => `<tr><td>${esc(u.name)}</td><td>${u.role}</td><td>••••</td><td>${u.active ? 'Active' : 'Disabled'}</td><td><button data-act="editUser" data-id="${u.id}">Edit</button></td></tr>`).join('')}</table></div>
  <div class="card" style="margin-top:12px"><b>Audit log (voids)</b><div id="aud" class="mut" style="margin-top:6px">Loading…</div></div></div>`;
  const au = await api('auditLog'); const el = $('#aud'); if (el) el.innerHTML = au.slice(0, 30).map((a) => `<div>${new Date(a.created_at).toLocaleString()} - ${esc(a.user_name)}: ${esc(a.action)} ${esc(a.detail)}</div>`).join('') || 'Nothing yet';
  S._users = us;
}
A.editUser = (d) => {
  const u = (S._users || []).find((x) => x.id === Number(d.id)) || { id: 0, name: '', pin: '', role: 'cashier', active: 1 };
  openModal(`<h3>${u.id ? 'Edit' : 'New'} staff</h3><label>Name</label><input id="uname" value="${esc(u.name)}"><label>PIN (4-6 digits)</label><input id="upin" value="${esc(u.pin)}" inputmode="numeric" maxlength="6">
  <label>Role</label><select id="urole"><option value="cashier" ${u.role === 'cashier' ? 'selected' : ''}>Cashier (POS + Orders)</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin (everything)</option></select>
  <label><input type="checkbox" id="uact" style="width:auto" ${u.active ? 'checked' : ''}> Active</label><div class="foot">${u.id ? `<button class="bad" data-act="delUser" data-id="${u.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveUser" data-id="${u.id}">Save</button></div>`);
};
A.saveUser = async (d) => { await api('saveUser', { id: Number(d.id) || undefined, name: val('uname').trim(), pin: val('upin'), role: val('urole'), active: chk('uact') }); closeModal(); viewStaff(); };
A.delUser = async (d) => { if (!confirm('Delete this user?')) return; await api('deleteUser', Number(d.id)); closeModal(); viewStaff(); };

// ================= SETTINGS =================
function viewSettings() {
  const s = S.settings; window._logo = s.logo;
  const f = (id, label, v, type = 'text') => `<div><label>${label}</label><input id="${id}" type="${type}" value="${esc(v)}"></div>`;
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Settings</h2><button class="pri" data-act="saveSettings">Save settings</button></div>
  <div class="grid g2"><div class="card"><b>Restaurant profile (printed on receipt)</b>${f('s_name', 'Restaurant name', s.name)}${f('s_tagline', 'Tagline', s.tagline)}${f('s_address', 'Address', s.address)}${f('s_phone', 'Phone', s.phone)}${f('s_ntn', 'NTN / STRN (optional)', s.ntn)}
  <label>Logo</label>${s.logo ? `<img id="logoPrev" src="${s.logo}" style="height:50px;display:block;margin-bottom:6px;background:#fff;border-radius:6px">` : '<img id="logoPrev" style="height:50px;display:block;margin-bottom:6px;background:#fff;border-radius:6px">'}<input type="file" id="logof" accept="image/*">${f('s_footer', 'Receipt footer message', s.receipt_footer)}</div>
  <div class="card"><b>Tax, charges & printing</b><div class="row2">${f('s_currency', 'Currency symbol', s.currency)}${f('s_taxlabel', 'Tax name (GST / PRA / SRB)', s.tax_label)}</div><div class="row2">${f('s_tax', 'Tax %', s.tax_percent, 'number')}${f('s_service', 'Dine-in service charge %', s.service_percent, 'number')}</div>${f('s_delivery', 'Delivery fee', s.delivery_fee, 'number')}
  <label>Receipt paper width</label><select id="s_paper"><option value="80" ${s.paper_width === '80' ? 'selected' : ''}>80 mm</option><option value="58" ${s.paper_width === '58' ? 'selected' : ''}>58 mm</option></select>
  <label><input type="checkbox" id="s_silent" style="width:auto" ${s.silent_print === '1' ? 'checked' : ''}> Print directly to default printer (no dialog)</label><label><input type="checkbox" id="s_kot" style="width:auto" ${s.print_kot === '1' ? 'checked' : ''}> Auto print kitchen KOT when order is placed</label>
  <div class="mut" style="margin-top:6px;font-size:12px">Tip: set your thermal printer as Windows default printer.</div></div></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><b>Tables</b><label>Comma separated names (leave empty to type table manually)</label><input id="s_tables" value="${esc(S.tables.map((t) => t.name).join(', '))}" placeholder="1, 2, 3, 4, VIP1"></div>
  <div class="card"><b>FBR / PRA integration</b><label><input type="checkbox" id="s_fbr" style="width:auto" ${s.fbr_enabled === '1' ? 'checked' : ''}> Enable (module coming - stores details only)</label><div class="row2">${f('s_fbrid', 'POS ID', s.fbr_pos_id)}${f('s_fbrtok', 'API token', s.fbr_token, 'password')}</div></div></div>
  <div class="card" style="margin-top:12px"><b>Backup</b><div class="mut" style="margin:6px 0">Take a backup regularly (USB / Drive). Restore will replace all data and restart the app.</div><button data-act="backup">Backup data</button> <button class="bad" data-act="restore">Restore from backup</button></div></div>`;
}
A.saveSettings = async () => {
  S.settings = await api('saveSettings', { name: val('s_name') || 'My Cafe', tagline: val('s_tagline'), address: val('s_address'), phone: val('s_phone'), ntn: val('s_ntn'), logo: window._logo || '', receipt_footer: val('s_footer'),
    currency: val('s_currency') || 'Rs.', tax_label: val('s_taxlabel') || 'Tax', tax_percent: val('s_tax') || '0', service_percent: val('s_service') || '0', delivery_fee: val('s_delivery') || '0',
    paper_width: val('s_paper'), silent_print: chk('s_silent') ? '1' : '0', print_kot: chk('s_kot') ? '1' : '0', fbr_enabled: chk('s_fbr') ? '1' : '0', fbr_pos_id: val('s_fbrid'), fbr_token: val('s_fbrtok'), setup_done: '1' });
  S.tables = await api('saveTables', val('s_tables').split(',')); toast('Settings saved'); render();
};
A.backup = async () => { const p = await window.pos.backup(); if (p) toast('Backup saved: ' + p); };
A.restore = async () => { if (confirm('This replaces ALL current data with the backup. Continue?')) await window.pos.restore(); };
