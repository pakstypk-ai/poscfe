'use strict';
// ================= MENU =================
let mCat = 0;
async function viewMenu() {
  S.menu = await api('getMenu', true);
  const cats = S.menu.categories;
  const items = S.menu.items.filter((i) => !mCat || i.category_id === mCat);
  const cat = (id) => cats.find((c) => c.id === id) || { name: '', color: '#999' };
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Menu</h2><button data-act="impText">Import from text / PDF copy</button><button data-act="impCsv">Import CSV</button><button class="pri" data-act="editItem" data-id="0">+ Add item / deal</button></div>
  <div class="split"><div class="side card"><div class="c ${!mCat ? 'on' : ''}" data-act="mcat" data-id="0">All items</div>${cats.map((c) => `<div class="c ${mCat === c.id ? 'on' : ''}" data-act="mcat" data-id="${c.id}"><span><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</span><span><a data-act="editCat" data-id="${c.id}" style="cursor:pointer">✎</a></span></div>`).join('')}<button style="margin-top:8px;width:100%" data-act="editCat" data-id="0">+ Category</button></div>
  <div class="card" style="flex:1"><table><tr><th></th><th>Item</th><th>Category</th><th class="r">Price</th><th class="r">Cost</th><th>Variants</th><th>Stock</th><th></th></tr>
  ${items.map((i) => `<tr style="${i.active ? '' : 'opacity:.4'}"><td style="width:46px">${i.image ? `<img src="${i.image}" style="width:40px;height:32px;object-fit:cover;border-radius:6px">` : ''}</td><td><b>${esc(i.name)}</b>${i.is_deal ? ' <span class="badge ok">deal</span>' : ''}${i.description ? `<div class="mut" style="font-size:12px">${esc(i.description)}</div>` : ''}</td><td><span class="dot" style="background:${cat(i.category_id).color}"></span>${esc(cat(i.category_id).name)}</td><td class="r">${money(i.price)}</td><td class="r">${i.cost ? money(i.cost) : '-'}</td><td>${i.variants.map((v) => esc(v.name) + ':' + v.price).join(', ')}</td><td>${i.stock_track ? i.stock : '-'}</td><td><button class="sm" data-act="editItem" data-id="${i.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="8" class="mut">No items yet. Add or import your menu.</td></tr>'}</table></div></div></div>`;
}
A.mcat = (d) => { mCat = Number(d.id); viewMenu(); };
A.editCat = (d) => {
  const c = S.menu.categories.find((x) => x.id === Number(d.id)) || { id: 0, name: '', sort: 0, description: '', color: '#ea580c' };
  openModal(`<h3>${c.id ? 'Edit' : 'New'} category</h3><label>Name (e.g. Burgers, Deals)</label><input id="cname" value="${esc(c.name)}"><label>Description (e.g. "Deal 10: Small pizza, pasta, wings, coke")</label><input id="cdesc" value="${esc(c.description)}">
  <div class="row2"><div><label>Colour</label><input id="ccol" type="color" value="${c.color}" style="height:40px;padding:2px"></div><div><label>Sort order</label><input id="csort" type="number" value="${c.sort}"></div></div>
  <div class="foot">${c.id ? `<button class="bad" data-act="delCat" data-id="${c.id}">Delete (with items)</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveCat" data-id="${c.id}">${c.id ? 'Save' : 'Create category'}</button></div>`);
};
A.saveCat = async (d) => { await api('saveCategory', { id: Number(d.id) || undefined, name: val('cname').trim(), description: val('cdesc'), color: val('ccol'), sort: Number(val('csort')) || 0 }); closeModal(); viewMenu(); };
A.delCat = async (d) => { if (!confirm('Delete this category and all its items?')) return; await api('deleteCategory', Number(d.id)); mCat = 0; closeModal(); viewMenu(); };
A.editItem = (d) => {
  const i = S.menu.items.find((x) => x.id === Number(d.id)) || { id: 0, name: '', category_id: mCat || (S.menu.categories[0] || {}).id, price: 0, cost: 0, description: '', is_deal: 0, image: '', variants: [], stock_track: 0, stock: 0, active: 1, kitchen: 1 };
  if (!S.menu.categories.length) return toast('Create a category first', true);
  window._img = i.image || '';
  openModal(`<h3>${i.id ? 'Edit' : 'New'} item / deal</h3><div class="row2"><div><label>Name</label><input id="iname" value="${esc(i.name)}"></div><div><label>Category</label><select id="icat">${S.menu.categories.map((c) => `<option value="${c.id}" ${c.id === i.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
  <label>Description (for a deal: list what is inside)</label><input id="idesc" value="${esc(i.description)}" placeholder="e.g. Small Pizza, Pasta, Wings, Coke 500ml">
  <div class="row2"><div><label>Selling price</label><input id="iprice" type="number" value="${i.price}"></div><div><label>Cost price (for profit reports)</label><input id="icost" type="number" value="${i.cost || 0}"></div></div>
  <label>Variants (optional) - e.g. Small:350, Large:500</label><input id="ivar" value="${esc(i.variants.map((v) => v.name + ':' + v.price).join(', '))}">
  <label>Picture</label><div style="display:flex;gap:10px;align-items:center"><img id="imgPrev" src="${window._img}" style="width:84px;height:62px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:#f3f4f6"><div style="flex:1"><input type="file" id="itemf" accept="image/*"><div style="margin-top:6px;display:flex;gap:6px"><button class="sm" data-act="genImg">Generate picture</button><button class="sm" data-act="clrImg">Remove</button></div></div></div>
  <div class="row2"><div><label><input type="checkbox" id="itrack" ${i.stock_track ? 'checked' : ''}> Track stock count</label><input id="istock" type="number" value="${i.stock}"></div><div><label><input type="checkbox" id="idealc" ${i.is_deal ? 'checked' : ''}> This is a deal / combo</label><label><input type="checkbox" id="ikit" ${i.kitchen ? 'checked' : ''}> Print on kitchen KOT</label><label><input type="checkbox" id="iact" ${i.active ? 'checked' : ''}> Active (visible on POS)</label></div></div>
  <div class="foot">${i.id ? `<button class="bad" data-act="delItem" data-id="${i.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveItem" data-id="${i.id}">${i.id ? 'Save' : 'Create item'}</button></div>`);
};
const parseVariants = (t) => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).map((x) => { const k = x.lastIndexOf(':'); return k > 0 ? { name: x.slice(0, k).trim(), price: Number(x.slice(k + 1)) } : null; }).filter((v) => v && v.price >= 0);
A.saveItem = async (d) => {
  await api('saveItem', { id: Number(d.id) || undefined, name: val('iname').trim(), category_id: Number(val('icat')), price: Number(val('iprice')) || 0, cost: Number(val('icost')) || 0, description: val('idesc'), image: window._img || '', is_deal: chk('idealc') ? 1 : 0, variants: parseVariants(val('ivar')),
    stock_track: chk('itrack'), stock: Number(val('istock')) || 0, kitchen: chk('ikit') ? 1 : 0, active: chk('iact') ? 1 : 0 });
  closeModal(); viewMenu();
};
A.delItem = async (d) => { if (!confirm('Delete this item?')) return; await api('deleteItem', Number(d.id)); closeModal(); viewMenu(); };
A.clrImg = () => { window._img = ''; $('#imgPrev').removeAttribute('src'); };
A.genImg = () => {
  const name = val('iname').trim() || 'Item', col = ((S.menu.categories.find((c) => c.id === Number(val('icat'))) || {}).color) || '#ea580c';
  const c = document.createElement('canvas'); c.width = 240; c.height = 176; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 240, 176); gr.addColorStop(0, col); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fillRect(0, 0, 240, 176);
  g.fillStyle = '#ffffffcc'; g.beginPath(); g.arc(120, 70, 44, 0, 7); g.fill(); g.fillStyle = col; g.font = 'bold 44px Segoe UI, Arial'; g.textAlign = 'center'; g.fillText(name.slice(0, 2).toUpperCase(), 120, 86);
  g.fillStyle = '#111'; g.font = 'bold 18px Segoe UI, Arial'; g.fillText(name.length > 22 ? name.slice(0, 21) + '…' : name, 120, 154);
  window._img = c.toDataURL('image/jpeg', 0.85); $('#imgPrev').src = window._img;
};
function fileToThumb(file, max = 240) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => { const im = new Image(); im.onerror = reject; im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.85)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}
document.addEventListener('change', async (e) => { if (e.target.id === 'itemf' && e.target.files[0]) { try { window._img = await fileToThumb(e.target.files[0]); $('#imgPrev').src = window._img; } catch (err) { toast('Could not read this picture', true); } } });

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
});
A.doImport = async () => { const r = await api('importMenu', pending); closeModal(); toast(`Imported: ${r.added} new, ${r.updated} updated`); viewMenu(); };

// ================= REPORTS =================
const RP = { preset: 'today', from: null, to: null };
const fmtDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function presetRange(p) {
  const t = new Date();
  if (p === 'yesterday') { const d = new Date(t - 864e5); return [fmtDay(d), fmtDay(d)]; }
  if (p === 'week') return [fmtDay(new Date(t - 6 * 864e5)), fmtDay(t)];
  if (p === 'month') return [fmtDay(new Date(t.getFullYear(), t.getMonth(), 1)), fmtDay(t)];
  return [fmtDay(t), fmtDay(t)];
}
const PRESETS_UI = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['month', 'This month'], ['custom', 'Custom']];
async function viewReports() {
  if (RP.preset !== 'custom' || !RP.from) [RP.from, RP.to] = RP.preset === 'custom' ? [todayStr(), todayStr()] : presetRange(RP.preset);
  const r = await api('report', RP.from, RP.to); window._rep = r;
  const kv = (o) => Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${money(v)}</td></tr>`).join('') || '<tr><td class="mut">-</td><td></td></tr>';
  const maxR = Math.max(1, ...r.topItems.map((i) => i.revenue)), maxT = Math.max(1, ...r.trend.map((t) => t.total));
  const card = (l, v, cls = '') => `<div class="card stat"><div class="l">${l}</div><div class="v ${cls}">${v}</div></div>`;
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Financial & sales reports</h2><button data-act="repExport" data-k="pdf">PDF (A4)</button><button data-act="repExport" data-k="csv">Excel / CSV</button><button data-act="repExport" data-k="json">JSON</button><button class="pri" data-act="printZ">Print day summary</button></div>
  <div class="chips" style="margin-bottom:12px">${PRESETS_UI.map(([k, l]) => `<button class="${RP.preset === k ? 'on' : ''}" data-act="repPreset" data-p="${k}">${l}</button>`).join('')}
  <input type="date" value="${RP.from}" data-chg="repFrom" style="width:150px"><input type="date" value="${RP.to}" data-chg="repTo" style="width:150px"></div>
  <div class="grid g4">${card('Total revenue', money(r.revenue))}${card('Total cost (COGS)', money(r.cogs))}${card('Total expenses', money(r.expenses))}${card('Gross profit', money(r.grossProfit), r.grossProfit < 0 ? 'neg' : 'pos')}</div>
  <div class="grid g4" style="margin-top:12px">${card('Net profit', money(r.netProfit), r.netProfit < 0 ? 'neg' : 'pos')}${card('Transactions', r.transactions)}${card('Expense items', r.expenseCount)}${card('Gross margin', r.margin.toFixed(1) + '%')}</div>
  <div class="grid g4" style="margin-top:12px">${card('Discounts given', money(r.discount))}${card('Tax collected', money(r.tax))}${card('Cancelled orders', r.voids.count + ' (' + money(r.voids.total) + ')')}${card('Cash in drawer', money(r.cashInDrawer))}</div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><b>Top 10 products by revenue</b>${r.topItems.map((i) => `<div style="margin-top:8px"><div style="display:flex;justify-content:space-between"><span>${esc(i.name)}</span><span class="mut">${money(i.revenue)} - profit ${money(i.profit)}</span></div><div class="bar" style="width:${Math.round(i.revenue / maxR * 100)}%"></div></div>`).join('') || '<div class="mut" style="margin-top:8px">No sales in this period</div>'}</div>
  <div class="card"><b>Sales trend (per day)</b><div class="trend">${r.trend.map((t) => `<div class="tb" title="${t.day}: ${money(t.total)} (${t.orders} orders)"><div style="height:${Math.max(3, Math.round(t.total / maxT * 130))}px"></div><span>${t.day.slice(5)}</span></div>`).join('') || '<div class="mut">No data</div>'}</div>
  <div style="margin-top:10px"><b>Expenses by category</b><table>${kv(r.expByCat)}</table></div></div></div>
  <div class="card" style="margin-top:12px"><b>Product-wise profit</b><table><tr><th>Product</th><th class="r">Qty</th><th class="r">Revenue</th><th class="r">Cost</th><th class="r">Profit</th><th class="r">Margin</th></tr>${r.products.map((p) => `<tr><td>${esc(p.name)}</td><td class="r">${p.qty}</td><td class="r">${money(p.revenue)}</td><td class="r">${money(p.cost)}</td><td class="r">${money(p.profit)}</td><td class="r">${p.margin.toFixed(0)}%</td></tr>`).join('') || '<tr><td class="mut" colspan="6">No sales</td></tr>'}</table><div class="mut" style="margin-top:6px;font-size:12px">Product figures are before discounts. Set each item's cost price in the Menu so profit is correct.</div></div>
  <div class="grid g3" style="margin-top:12px"><div class="card"><b>By payment received</b><table>${kv(r.byPayment)}</table></div><div class="card"><b>By cashier</b><table>${kv(r.byUser)}</table></div><div class="card"><b>By customer</b><table>${kv(r.byCustomer)}</table></div></div>
  <div class="grid g3" style="margin-top:12px"><div class="card"><b>By order type</b><table>${kv(r.byType)}</table></div><div class="card"><b>Credit (khata)</b><table><tr><td>Due on these orders</td><td class="r">${money(r.dueFromCustomers)}</td></tr><tr><td>Collected from customers</td><td class="r">${money(r.khataCollected)}</td></tr><tr><td>Total outstanding now</td><td class="r">${money(r.khataOutstanding)}</td></tr></table></div>
  <div class="card"><b>Sales by hour</b>${Object.entries(r.byHour).sort((a, b) => a[0] - b[0]).map(([h, v]) => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span style="width:44px">${h}:00</span><div class="bar" style="width:${Math.round(v / Math.max(1, ...Object.values(r.byHour)) * 100)}%"></div><span class="mut">${money(v)}</span></div>`).join('') || '<div class="mut">-</div>'}</div></div>
  <div class="card" style="margin-top:12px"><b>Order lines (${r.lines.length})</b><div style="max-height:320px;overflow:auto"><table><tr><th>Order</th><th>Product</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Revenue</th><th class="r">Cost</th><th class="r">Profit</th><th>Cashier</th></tr>${r.lines.slice(0, 300).map((l) => `<tr><td>#${l.order}</td><td>${esc(l.product)}</td><td class="r">${l.qty}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.revenue)}</td><td class="r">${money(l.cost)}</td><td class="r">${money(l.profit)}</td><td>${esc(l.cashier)}</td></tr>`).join('')}</table></div></div></div>`;
}
A.repPreset = (d) => { RP.preset = d.p; if (d.p !== 'custom') [RP.from, RP.to] = presetRange(d.p); viewReports(); };
A.repFrom = (v) => { RP.preset = 'custom'; RP.from = v; if (!RP.to || RP.to < v) RP.to = v; viewReports(); };
A.repTo = (v) => { RP.preset = 'custom'; RP.to = v; viewReports(); };
A.goReport = (d) => { RP.preset = d.p; RP.from = null; S.view = 'reports'; render(); };
A.repExport = async (d) => {
  const r = window._rep, name = `report-${r.from}_to_${r.to}`;
  const summary = [['Total revenue', Math.round(r.revenue)], ['Total cost (COGS)', Math.round(r.cogs)], ['Total expenses', Math.round(r.expenses)], ['Gross profit', Math.round(r.grossProfit)], ['Net profit', Math.round(r.netProfit)], ['Transactions', r.transactions], ['Expense items', r.expenseCount], ['Gross margin %', r.margin.toFixed(1)]];
  let content;
  if (d.k === 'json') content = JSON.stringify({ restaurant: S.settings.name, from: r.from, to: r.to, summary: Object.fromEntries(summary), products: r.products, orderLines: r.lines, expensesByCategory: r.expByCat, byPayment: r.byPayment, byCashier: r.byUser, byCustomer: r.byCustomer }, null, 2);
  else if (d.k === 'csv') content = [[S.settings.name, 'Financial report', r.from, r.to], ...summary, [], ['PRODUCT-WISE PROFIT'], ['Product', 'Qty', 'Revenue', 'Cost', 'Profit', 'Margin %'], ...r.products.map((p) => [p.name, p.qty, Math.round(p.revenue), Math.round(p.cost), Math.round(p.profit), p.margin.toFixed(0)]), [], ['ORDER LINES'], ['Order', 'Date', 'Product', 'Qty', 'Unit price', 'Revenue', 'Cost', 'Profit', 'Cashier'], ...r.lines.map((l) => [l.order, l.day, l.product, l.qty, l.price, l.revenue, l.cost, l.profit, l.cashier])].map((row) => row.map(csvCell).join(',')).join('\r\n');
  else content = pdfDoc('Financial report', `${r.from} to ${r.to}`, `<div>${summary.map(([k, v]) => `<span class="k">${esc(k)}<b>${esc(v)}</b></span>`).join('')}</div><h2>Product-wise profit</h2>${htmlTable(['Product', 'Qty', 'Revenue', 'Cost', 'Profit', 'Margin %'], r.products.map((p) => [p.name, p.qty, Math.round(p.revenue), Math.round(p.cost), Math.round(p.profit), p.margin.toFixed(0)]), [1, 2, 3, 4, 5])}<h2>Expenses by category</h2>${htmlTable(['Category', 'Amount'], Object.entries(r.expByCat).map(([k, v]) => [k, Math.round(v)]), [1])}<h2>Sales by cashier</h2>${htmlTable(['Cashier', 'Sales'], Object.entries(r.byUser).map(([k, v]) => [k, Math.round(v)]), [1])}<h2>Order lines</h2>${htmlTable(['Order', 'Product', 'Qty', 'Unit', 'Revenue', 'Cost', 'Profit', 'Cashier'], r.lines.slice(0, 400).map((l) => ['#' + l.order, l.product, l.qty, l.price, Math.round(l.revenue), Math.round(l.cost), Math.round(l.profit), l.cashier]), [2, 3, 4, 5, 6])}`);
  const p = await window.pos.export('reports', d.k, name, content); if (p) toast('Saved: ' + p);
};
A.printZ = () => {
  const r = window._rep, s = S.settings, row = (a, b) => `<tr><td>${esc(a)}</td><td class="r">${typeof b === 'number' ? Math.round(b) : esc(b)}</td></tr>`;
  const html = `<html><head><meta charset="utf-8">${pcss()}</head><body><h1>${esc(s.name)}</h1><div class="c t">SALES SUMMARY</div><div class="c">${r.from}${r.to !== r.from ? ' to ' + r.to : ''}<br>Printed by ${esc(S.user.name)}</div><div class="b"></div>
  <table>${row('Orders', r.orders)}${row('Subtotal', r.subtotal)}${row('Discounts', -r.discount)}${row('Service', r.service)}${row('Tax', r.tax)}${row('Delivery', r.delivery)}<tr class="t"><td>TOTAL SALES</td><td class="r">${Math.round(r.total)}</td></tr></table><div class="b"></div>
  <b>Payments received</b><table>${Object.entries(r.byPayment).map(([k, v]) => row(k, v)).join('')}</table><div class="b"></div><table>${row('Expenses', -r.expenses)}${row('Gross profit', r.grossProfit)}<tr class="t"><td>NET PROFIT</td><td class="r">${Math.round(r.netProfit)}</td></tr>${row('Cash in drawer', r.cashInDrawer)}${row('Cancelled orders', r.voids.count + ' / ' + Math.round(r.voids.total))}</table></body></html>`;
  window.pos.print(html, S.settings.silent_print === '1');
};

// ================= STAFF =================
let META = null, USERS = [];
const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);
async function viewStaff() {
  META = META || await api('permMeta');
  USERS = await api('listUsers');
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Staff management</h2><button class="pri" data-act="editUser" data-id="0">+ Add employee</button></div>
  <div class="staffgrid">${USERS.map((u) => `<div class="scard ${u.active ? '' : 'off'}"><div class="top"><div class="avatar">${esc((u.name || '?').charAt(0).toUpperCase())}</div>
    <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:16px">${esc(u.name)}</div><div class="mut">${esc(u.position || roleLabel(u.role))}</div></div>
    <span class="badge ${u.active ? 'ok' : 'off'}">${u.active ? 'Active' : 'Deactivated'}</span></div>
    <div class="meta"><span>Role</span><span><span class="role">${esc(u.role)}</span></span><span>Phone</span><span>${esc(u.phone) || '-'}</span><span>Login ID</span><span><b>${esc(u.username)}</b></span><span>Access</span><span>${u.role === 'admin' ? 'Everything' : u.permissions.length + ' of ' + META.perms.length + ' permissions'}</span></div>
    <div class="btns"><button class="sm" data-act="changeLogin" data-id="${u.id}">🔑 Change Login</button><button class="sm" data-act="editUser" data-id="${u.id}">✎ Edit</button>
    ${u.id === S.user.id ? '' : `<button class="sm" data-act="toggleUser" data-id="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button><button class="sm bad" data-act="delUser" data-id="${u.id}">Delete</button>`}</div></div>`).join('')}</div>
  <div class="card" style="margin-top:16px"><b>Activity log (staff changes & voids)</b><div id="aud" class="mut" style="margin-top:6px">Loading…</div></div></div>`;
  const au = await api('auditLog'); const el = $('#aud');
  if (el) el.innerHTML = au.slice(0, 40).map((a) => `<div>${new Date(a.created_at).toLocaleString()} - <b>${esc(a.user_name)}</b>: ${esc(a.action)} ${esc(a.detail)}</div>`).join('') || 'Nothing yet';
}
function permBoxes(sel, locked) {
  const groups = {}; META.perms.forEach((p) => { (groups[p.group] = groups[p.group] || []).push(p); });
  return Object.entries(groups).map(([g, list]) => `<div class="permbox"><div class="gt">${esc(g === 'Screens' ? 'Screens this person can open' : 'Special actions')}</div><div class="permgrid">${list.map((p) => `<label><input type="checkbox" class="perm" data-k="${p.key}" ${sel.includes(p.key) ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${esc(p.label)}</label>`).join('')}</div></div>`).join('');
}
A.editUser = (d) => {
  const isNew = !Number(d.id);
  const u = USERS.find((x) => x.id === Number(d.id)) || { id: 0, name: '', username: '', phone: '', position: '', role: 'cashier', active: 1, permissions: META.presets.cashier };
  openModal(`<h3>${isNew ? 'Add employee' : 'Edit employee'}</h3>
  <div class="row2"><div><label>Full name</label><input id="uname" value="${esc(u.name)}"></div><div><label>Phone</label><input id="uphone" value="${esc(u.phone)}"></div></div>
  <div class="row2"><div><label>Position / title</label><input id="upos" value="${esc(u.position)}" placeholder="e.g. Head waiter"></div>
  <div><label>Role</label><select id="urole" data-in="roleChg">${META.roles.map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${roleLabel(r)}</option>`).join('')}</select></div></div>
  ${isNew ? `<div class="row2"><div><label>Login ID</label><input id="uuser" autocomplete="off" placeholder="e.g. ali"></div><div><label>PIN / Password (4-30)</label><input id="upin" type="password" autocomplete="new-password"></div></div>` : `<div class="mut" style="margin-top:8px">Login ID: <b>${esc(u.username)}</b> (use "Change Login" to change ID or PIN)</div>`}
  <div style="margin-top:10px"><b>Access permissions</b> <span class="mut" style="font-size:12px">- changing the role fills a ready-made set; tick or untick to customise</span></div>
  <div id="permwrap">${permBoxes(u.permissions, u.role === 'admin')}</div>
  <label><input type="checkbox" id="uact" ${u.active ? 'checked' : ''} ${u.id === S.user.id ? 'disabled' : ''}> Active (can log in)</label>
  <div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="saveUser" data-id="${u.id}">Save</button></div>`);
};
A.roleChg = (v) => { $('#permwrap').innerHTML = permBoxes(META.presets[v] || [], v === 'admin'); };
A.saveUser = async (d) => {
  const perms = [...document.querySelectorAll('#permwrap .perm')].filter((c) => c.checked).map((c) => c.dataset.k);
  const u = { id: Number(d.id) || undefined, name: val('uname'), phone: val('uphone'), position: val('upos'), role: val('urole'), permissions: perms, active: chk('uact') };
  if (!u.id) { u.username = val('uuser'); u.pin = val('upin'); }
  await api('saveUser', u); closeModal(); toast('Employee saved'); viewStaff();
};
A.changeLogin = (d) => {
  const u = USERS.find((x) => x.id === Number(d.id));
  openModal(`<h3>Change login - ${esc(u.name)}</h3><label>Login ID</label><input id="clu" value="${esc(u.username)}" autocomplete="off">
  <label>New PIN / Password (leave empty to keep the old one)</label><input id="clp" type="password" autocomplete="new-password"><label>Repeat new PIN</label><input id="clp2" type="password" autocomplete="new-password">
  <div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="saveLogin" data-id="${u.id}">Save login</button></div>`);
};
A.saveLogin = async (d) => {
  if (val('clp') !== val('clp2')) return toast('PIN does not match', true);
  await api('changeLogin', Number(d.id), { username: val('clu'), pin: val('clp') }); closeModal(); toast('Login updated'); viewStaff();
};
A.toggleUser = async (d) => { const u = USERS.find((x) => x.id === Number(d.id)); await api('setUserActive', u.id, !u.active); toast(u.active ? 'Deactivated' : 'Activated'); viewStaff(); };
A.delUser = async (d) => { const u = USERS.find((x) => x.id === Number(d.id)); if (!confirm(`Delete ${u.name}? Their old orders stay in reports.`)) return; await api('deleteUser', u.id); viewStaff(); };

// ================= DASHBOARD =================
async function viewDashboard() {
  const x = await api('dashboard'), s = S.settings;
  const card = (l, v) => `<div class="card stat"><div class="l">${l}</div><div class="v">${v}</div></div>`;
  $('#main').innerHTML = `<div class="page"><div class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:14px">${s.logo ? `<img src="${s.logo}" style="height:54px;border-radius:8px">` : ''}<div style="flex:1"><div style="font-size:20px;font-weight:800">${esc(s.name)}</div><div class="mut">${esc([s.address, s.phone].filter(Boolean).join(' - '))}</div></div><div style="text-align:right"><div style="font-weight:700">Welcome, ${esc(S.user.name)} 👋</div><div class="mut">${x.day}</div></div></div>
  <div class="grid g4">${card("Today's sales", money(x.sales))}${card('Orders today', x.orders)}${card("Today's expenses", money(x.expenses))}${card('Open orders', x.held)}</div>
  <div class="grid g4" style="margin-top:12px">${card('In kitchen now', x.kitchenActive)}${card('Deliveries pending', x.pendingDeliveries)}${card('Customer credit due', money(x.khataDue))}${card('Supplier dues', money(x.supplierDue))}</div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><b>Top selling products today</b><table><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr>${x.topItems.map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${money(i.amount)}</td></tr>`).join('') || '<tr><td class="mut" colspan="3">No sales yet today</td></tr>'}</table></div>
  <div class="card"><b>Low stock alerts</b>${x.lowStock.map((l) => `<div style="padding:5px 0;color:var(--bad)">${esc(l.name)}: only ${l.stock} left</div>`).join('')}${x.lowMaterials.map((l) => `<div style="padding:5px 0;color:var(--bad)">${esc(l.name)}: ${l.stock} ${esc(l.unit)} left (min ${l.min_stock})</div>`).join('')}${!x.lowStock.length && !x.lowMaterials.length ? '<div class="mut" style="padding:6px 0">All stock is fine</div>' : ''}</div></div>
  ${can('reports') ? `<div class="card" style="margin-top:12px"><b>View report</b><div class="chips" style="margin-top:8px"><button data-act="goReport" data-p="today">Today</button><button data-act="goReport" data-p="yesterday">Yesterday</button><button data-act="goReport" data-p="week">Last 7 days</button><button data-act="goReport" data-p="month">This month</button><button data-act="goReport" data-p="custom">Custom range</button></div></div>` : ''}
  <div class="card" style="margin-top:12px"><b>Quick links</b><div class="chips" style="margin-top:8px">${NAV.filter((n) => ['pos', 'orders', 'kitchen', 'delivery', 'customers', 'inventory'].includes(n[0]) && can(n[3])).map((n) => `<button data-act="nav" data-v="${n[0]}">${n[2]} ${n[1]}</button>`).join('')}</div></div></div>`;
}

// ================= KITCHEN =================
async function viewKitchen() {
  const list = await api('kitchenOrders');
  const col = (st, title) => {
    const o = list.filter((x) => x.kstatus === st);
    const next = { pending: ['preparing', 'Start preparing'], preparing: ['ready', 'Mark as READY'], ready: ['completed', 'Served / Done'] }[st];
    return `<div class="kcol"><h3>${title} (${o.length})</h3><div class="stack">${o.map((x) => { const mins = Math.floor((Date.now() - new Date(x.created_at)) / 60000); return `<div class="kcard ${st}"><div style="display:flex;justify-content:space-between"><b>#${x.id} - ${esc(x.type)}${x.table_no ? ' - Table ' + esc(x.table_no) : ''}</b><span class="${mins >= 15 && st !== 'ready' ? 'late' : 'mut'}">⏱ ${mins} min</span></div>
      ${x.customer ? `<div class="mut">Client: ${esc(x.customer)}</div>` : ''}
      ${x.items.filter((i) => i.kitchen !== 0).map((i) => `<div class="it">${i.qty} x ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''}${i.note ? `<small>* ${esc(i.note)}</small>` : ''}</div>`).join('')}
      ${x.note ? `<div class="knote">Note: ${esc(x.note)}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:6px"><button class="${st === 'preparing' ? 'ok' : 'pri'}" data-act="kmove" data-id="${x.id}" data-s="${next[0]}">${next[1]}</button><button class="sm" data-act="reprintKot" data-id="${x.id}">Print token</button></div></div>`; }).join('') || '<div class="mut">Nothing here</div>'}</div></div>`;
  };
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Kitchen display</h2><span class="mut">Refreshes automatically</span><button data-act="kref">Refresh</button></div><div class="kboard">${col('pending', 'New')}${col('preparing', 'Preparing')}${col('ready', 'Ready')}</div></div>`;
  clearTimers(); S.timer = setInterval(() => { if (S.view === 'kitchen' && !$('#modal').innerHTML) viewKitchen(); }, 5000);
}
A.kmove = async (d) => { await api('setKitchenStatus', Number(d.id), d.s); viewKitchen(); };
A.kref = () => viewKitchen();

// ================= TABLES =================
async function viewTables() {
  S.tables = await api('listTables');
  const full = can('tables'), quick = can(['tables', 'table_status']);
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Tables</h2>${full ? '<button class="pri" data-act="editTable" data-id="0">+ Add table</button>' : ''}</div>
  <div class="mut" style="margin-bottom:10px">Only <b>available</b> tables appear when taking dine-in orders.</div>
  <div class="tgrid">${S.tables.map((t) => `<div class="tcard ${t.occupied ? 'occ' : t.status}"><div class="tn">${esc(t.name)}</div><div class="mut">${t.capacity} seats${t.section ? ' - ' + esc(t.section) : ''}</div>
    <div style="margin:8px 0"><span class="badge ${t.occupied ? 'bad' : t.status}">${t.occupied ? 'occupied' : t.status}</span></div>
    ${quick && !t.occupied ? `<div class="chips" style="justify-content:center">${['available', 'reserved', 'cleaning'].filter((x) => x !== t.status).map((x) => `<button class="sm" data-act="tstat" data-id="${t.id}" data-s="${x}">${x === 'available' ? '✔ Available' : x === 'cleaning' ? '🧹 Cleaning' : 'Reserve'}</button>`).join('')}</div>` : ''}
    ${full ? `<div style="margin-top:6px"><button class="sm" data-act="editTable" data-id="${t.id}">Edit</button></div>` : ''}</div>`).join('') || '<div class="card mut">No tables yet. Add your first table.</div>'}</div></div>`;
}
A.tstat = async (d) => { S.tables = await api('setTableStatus', Number(d.id), d.s); viewTables(); };
A.editTable = (d) => {
  const t = S.tables.find((x) => x.id === Number(d.id)) || { id: 0, name: '', capacity: 4, section: '', status: 'available' };
  openModal(`<h3>${t.id ? 'Edit' : 'Add'} table</h3><div class="row2"><div><label>Table name / number</label><input id="tname" value="${esc(t.name)}"></div><div><label>Seating capacity</label><input id="tcap" type="number" min="1" value="${t.capacity}"></div></div>
  <div class="row2"><div><label>Floor / section</label><input id="tsec" value="${esc(t.section)}" placeholder="e.g. Ground floor, Family hall"></div><div><label>Status</label><select id="tstat">${['available', 'reserved', 'cleaning'].map((x) => `<option ${t.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
  <div class="foot">${t.id ? `<button class="bad" data-act="delTable" data-id="${t.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveTable" data-id="${t.id}">Save</button></div>`);
};
A.saveTable = async (d) => { await api('saveTable', { id: Number(d.id) || undefined, name: val('tname'), capacity: val('tcap'), section: val('tsec'), status: val('tstat') }); closeModal(); viewTables(); };
A.delTable = async (d) => { if (!confirm('Delete this table?')) return; await api('deleteTable', Number(d.id)); closeModal(); viewTables(); };

// ================= EXPENSES =================
let eFrom = null, eTo = null;
const EXP_CATS = ['marketing', 'rent', 'salaries', 'utilities', 'supplies', 'other'];
async function viewExpenses() {
  eFrom = eFrom || todayStr(); eTo = eTo || eFrom;
  const ex = await api('listExpenses', { from: eFrom, to: eTo }), tot = ex.reduce((a, e) => a + e.amount, 0);
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Expenses</h2><input type="date" id="ef" value="${eFrom}" style="width:150px"><input type="date" id="et" value="${eTo}" style="width:150px"><button data-act="expGo">Show</button></div>
  <div class="mut" style="margin-bottom:8px">General expenses (marketing, rent, salaries...) are deducted from profit in the reports. Buying raw material is recorded under Suppliers.</div>
  <div class="card"><div class="h"><select id="ecat" style="width:150px">${EXP_CATS.map((c) => `<option>${c}</option>`).join('')}</select><input id="etitle" placeholder="Details (e.g. Facebook ads, shop rent)" style="flex:1"><input id="eamt" type="number" placeholder="Amount" style="width:140px"><button class="pri" data-act="addExp">Add expense</button></div>
  <table><tr><th>Date</th><th>Category</th><th>Details</th><th>By</th><th class="r">Amount</th><th></th></tr>${ex.map((e) => `<tr><td>${e.day}</td><td><span class="badge">${esc(e.category || 'other')}</span></td><td>${esc(e.title)}</td><td>${esc(e.user_name)}</td><td class="r">${money(e.amount)}</td><td class="r"><button class="ghost sm" data-act="delExp" data-id="${e.id}">X</button></td></tr>`).join('') || '<tr><td class="mut" colspan="6">No expenses in this period</td></tr>'}
  <tr><th colspan="4">Total</th><th class="r">${money(tot)}</th><th></th></tr></table></div></div>`;
}
A.expGo = () => { eFrom = val('ef'); eTo = val('et') || eFrom; viewExpenses(); };
A.addExp = async () => { await api('addExpense', { title: val('etitle'), amount: val('eamt'), category: val('ecat') }); viewExpenses(); };
A.delExp = async (d) => { await api('deleteExpense', Number(d.id)); viewExpenses(); };

// ================= SETTINGS =================
function viewSettings() {
  const s = S.settings;
  const f = (id, label, v, type = 'text') => `<div><label>${label}</label><input id="${id}" type="${type}" value="${esc(v)}"></div>`;
  const ck = (id, label, on) => `<label style="color:var(--tx)"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Settings</h2><button class="pri" data-act="saveSettings">Save settings</button></div>
  <div class="grid g2"><div class="card"><b>Company profile</b>${f('s_name', 'Restaurant name', s.name)}${f('s_tagline', 'Tagline', s.tagline)}${f('s_address', 'Address', s.address)}${f('s_phone', 'Contact number', s.phone)}${f('s_ntn', 'NTN / STRN (optional)', s.ntn)}<div class="mut" style="margin-top:8px;font-size:12px">Logo, fonts and bill layout are in <b>Receipt Design</b>.</div></div>
  <div class="card"><b>Tax, charges & printing</b><div class="row2">${f('s_currency', 'Currency symbol', s.currency)}${f('s_taxlabel', 'Tax name (GST / PRA / SRB / FBR)', s.tax_label)}</div><div class="row2">${f('s_tax', 'Tax %', s.tax_percent, 'number')}${f('s_service', 'Dine-in service charge %', s.service_percent, 'number')}</div>${f('s_delivery', 'Delivery charges (e.g. 300)', s.delivery_fee, 'number')}
  ${ck('s_silent', 'Print directly to default printer (no dialog)', s.silent_print === '1')}${ck('s_kot', 'Auto print kitchen token (KOT) when order is placed', s.print_kot === '1')}${ck('s_voice', 'Voice announcement when an order is ready', s.voice_alerts === '1')}</div></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><b>Loyalty discounts (regular customers)</b><div class="mut" style="margin:6px 0">If a saved customer places this many orders in the current month, they get the discount.</div><div class="row2">${f('s_l1m', 'Level 1: orders / month', s.loyalty_min_orders, 'number')}${f('s_l1p', 'Level 1: discount %', s.loyalty_percent, 'number')}</div><div class="row2">${f('s_l2m', 'Level 2: orders / month', s.loyalty2_min_orders, 'number')}${f('s_l2p', 'Level 2: discount %', s.loyalty2_percent, 'number')}</div><div class="mut" style="font-size:12px">Leave 0 to switch off.</div></div>
  <div class="card"><b>FBR / PRA integration</b>${ck('s_fbr', 'Enable (stores details only - live module coming)', s.fbr_enabled === '1')}<div class="row2">${f('s_fbrid', 'POS ID', s.fbr_pos_id)}${f('s_fbrtok', 'API token', s.fbr_token, 'password')}</div>
  <div style="margin-top:12px"><b>Online orders / website</b></div>${ck('s_online', 'Connect my website (details saved for the integration)', s.online_enabled === '1')}<div class="row2">${f('s_site', 'Website URL', s.online_site)}${f('s_okey', 'Integration key', s.online_key, 'password')}</div></div></div>
  ${can('backup') ? `<div class="card" style="margin-top:12px"><b>Backup</b><div class="mut" style="margin:6px 0">Take a backup regularly (USB / Drive). Restore replaces all data and restarts the app.</div><button data-act="backup">Backup data</button> <button class="bad" data-act="restore">Restore from backup</button></div>` : ''}
  ${can('reset') ? `<div class="card" style="margin-top:12px;border-color:#fecaca"><b style="color:var(--bad)">Data management</b><div class="mut" style="margin:6px 0">Delete all orders, expenses, payments and customer balances to start fresh. Your menu, categories, tables, staff, suppliers and settings are kept. A safety copy of the database is saved automatically first.</div><button class="bad" data-act="resetAsk">Delete sales data...</button></div>` : ''}</div>`;
}
A.saveSettings = async () => {
  S.settings = await api('saveSettings', { name: val('s_name') || 'My Cafe', tagline: val('s_tagline'), address: val('s_address'), phone: val('s_phone'), ntn: val('s_ntn'),
    currency: val('s_currency') || 'Rs.', tax_label: val('s_taxlabel') || 'Tax', tax_percent: val('s_tax') || '0', service_percent: val('s_service') || '0', delivery_fee: val('s_delivery') || '0',
    silent_print: chk('s_silent') ? '1' : '0', print_kot: chk('s_kot') ? '1' : '0', voice_alerts: chk('s_voice') ? '1' : '0',
    loyalty_min_orders: val('s_l1m') || '0', loyalty_percent: val('s_l1p') || '0', loyalty2_min_orders: val('s_l2m') || '0', loyalty2_percent: val('s_l2p') || '0',
    fbr_enabled: chk('s_fbr') ? '1' : '0', fbr_pos_id: val('s_fbrid'), fbr_token: val('s_fbrtok'), online_enabled: chk('s_online') ? '1' : '0', online_site: val('s_site'), online_key: val('s_okey'), setup_done: '1' });
  toast('Settings saved'); render();
};
A.backup = async () => { const p = await window.pos.backup(); if (p) toast('Backup saved: ' + p); };
A.restore = async () => { if (confirm('This replaces ALL current data with the backup. Continue?')) await window.pos.restore(); };
A.resetAsk = () => openModal(`<h3 style="color:var(--bad)">Delete all sales data</h3><p>This permanently deletes every order, expense, customer payment and customer balance. Menu, categories, tables, staff and suppliers stay.</p><label>Type exactly: <b>Delete All Data</b></label><input id="rtype" autocomplete="off">
  <div class="foot"><button data-act="close">Cancel</button><button class="bad" data-act="resetDo">Delete sales data</button></div>`);
A.resetDo = async () => { if (val('rtype') !== 'Delete All Data') return toast('Type Delete All Data exactly to confirm', true); await api('resetSalesData'); closeModal(); resetOrder(); toast('All sales data deleted. Menu kept.'); viewSettings(); };
