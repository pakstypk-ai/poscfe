'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { user: null, settings: {}, menu: { categories: [], items: [] }, tables: [], view: 'pos', cart: [], cat: 0, search: '',
  ctx: { type: 'dine-in', table_no: '', customer: '', phone: '', address: '', note: '', id: null }, disc: { type: 'amount', value: 0 } };
const api = (n, ...a) => window.pos.call(n, ...a);
const money = (n) => `${S.settings.currency || 'Rs.'} ${Math.round(n || 0).toLocaleString()}`;
const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
const chk = (id) => { const e = document.getElementById(id); return e ? e.checked : false; };
const A = {};

function toast(m, err) {
  const d = document.createElement('div'); if (err) d.className = 'e'; d.textContent = m; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), err ? 5000 : 2500);
}
async function safe(fn) {
  try { return await fn(); } catch (e) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']*': (Error: )?/, ''), true); }
}
const openModal = (html) => { $('#modal').innerHTML = `<div class="dlg">${html}</div>`; };
const closeModal = () => { $('#modal').innerHTML = ''; };
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (A[t.dataset.act]) safe(() => A[t.dataset.act](t.dataset, t));
});
document.addEventListener('input', (e) => { const t = e.target.closest('[data-in]'); if (t && A[t.dataset.in]) A[t.dataset.in](t.value, t); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

async function loadAll() {
  S.settings = await api('getSettings'); S.menu = await api('getMenu', false); S.tables = await api('listTables');
}
const isAdmin = () => S.user && S.user.role === 'admin';

// ================= LOGIN =================
let pinBuf = '';
function renderLogin() {
  $('#app').innerHTML = `<div class="login"><h1>${esc(S.settings.name || 'Cafe POS')}</h1><div class="sub">Enter your PIN</div>
  <input id="pin" class="pin" type="password" readonly value="">
  <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-act="pad" data-k="${n}">${n}</button>`).join('')}
  <button data-act="pad" data-k="C">C</button><button data-act="pad" data-k="0">0</button><button class="pri" data-act="pad" data-k="OK">OK</button></div>
  <div class="mut" style="margin-top:14px;font-size:12px">First login: PIN 1234 (change it in Staff)</div></div>`;
  pinBuf = '';
}
A.pad = async (d) => {
  if (d.k === 'C') pinBuf = ''; else if (d.k === 'OK') {
    const u = await api('login', pinBuf); pinBuf = '';
    if (!u) { $('#pin').value = ''; return toast('Wrong PIN', true); }
    S.user = u; await loadAll(); S.view = 'pos';
    if (S.settings.setup_done !== '1' && u.role === 'admin') { S.view = 'settings'; toast('Welcome! Please set up your restaurant details first.'); }
    return render();
  } else if (pinBuf.length < 6) pinBuf += d.k;
  $('#pin').value = pinBuf;
};
document.addEventListener('keydown', (e) => {
  if (S.user || !$('#pin')) return;
  if (/^\d$/.test(e.key)) A.pad({ k: e.key }); else if (e.key === 'Enter') A.pad({ k: 'OK' }); else if (e.key === 'Backspace') A.pad({ k: 'C' });
});

// ================= SHELL =================
function render() {
  if (!S.user) return renderLogin();
  const tabs = [['pos', 'POS'], ['orders', 'Orders']].concat(isAdmin() ? [['menu', 'Menu'], ['reports', 'Reports'], ['staff', 'Staff'], ['settings', 'Settings']] : []);
  $('#app').innerHTML = `<div class="top"><div class="brand">${S.settings.logo ? `<img src="${S.settings.logo}">` : ''}${esc(S.settings.name)}</div>
    <div class="nav">${tabs.map(([k, l]) => `<button class="${S.view === k ? 'on' : ''}" data-act="nav" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="sp"></div><div class="who">${esc(S.user.name)} (${S.user.role})</div><button data-act="logout">Logout</button></div><div class="main" id="main"></div>`;
  ({ pos: viewPos, orders: viewOrders, menu: viewMenu, reports: viewReports, staff: viewStaff, settings: viewSettings })[S.view]();
}
A.nav = async (d) => { S.view = d.v; if (d.v === 'pos') { S.menu = await api('getMenu', false); } render(); };
A.logout = () => { S.user = null; render(); };

// ================= POS =================
const lineKey = (i) => i.item_id + '|' + (i.variant || '') + '|' + (i.note || '');
function calc() {
  const sub = S.cart.reduce((a, i) => a + i.price * i.qty, 0);
  let disc = S.disc.type === 'percent' ? sub * (Number(S.disc.value) || 0) / 100 : Number(S.disc.value) || 0;
  disc = Math.min(Math.max(disc, 0), sub);
  const base = sub - disc, st = S.settings;
  const service = S.ctx.type === 'dine-in' ? base * (Number(st.service_percent) || 0) / 100 : 0;
  const tax = (base + service) * (Number(st.tax_percent) || 0) / 100;
  const delivery = S.ctx.type === 'delivery' ? Number(st.delivery_fee) || 0 : 0;
  return { sub, disc, service, tax, delivery, total: Math.round(base + service + tax + delivery) };
}
function viewPos() {
  $('#main').innerHTML = `<div class="menu"><div class="row2" style="flex:none;margin-bottom:8px"><input id="search" data-in="search" placeholder="Search item..." value="${esc(S.search)}"><div style="flex:none;display:flex;gap:6px">
    <button data-act="heldList" id="heldBtn">Held / Open</button></div></div><div class="cats" id="cats"></div><div class="items" id="items"></div></div><div class="cart" id="cart"></div>`;
  renderCats(); renderItems(); renderCart();
  api('listOrders', { status: 'held' }).then((h) => { const b = $('#heldBtn'); if (b) b.textContent = `Held / Open (${h.length})`; });
}
function renderCats() {
  $('#cats').innerHTML = `<button class="${!S.cat ? 'on' : ''}" data-act="cat" data-id="0">All</button>` + S.menu.categories.map((c) => `<button class="${S.cat === c.id ? 'on' : ''}" data-act="cat" data-id="${c.id}">${esc(c.name)}</button>`).join('');
}
function renderItems() {
  const s = S.search.toLowerCase();
  const list = S.menu.items.filter((i) => (!S.cat || i.category_id === S.cat) && (!s || i.name.toLowerCase().includes(s)));
  $('#items').innerHTML = list.map((i) => {
    const out = i.stock_track && i.stock <= 0;
    const price = i.variants.length ? `from ${money(Math.min(...i.variants.map((v) => v.price)))}` : money(i.price);
    return `<div class="item ${out ? 'out' : ''}" data-act="addItem" data-id="${i.id}"><div class="n">${esc(i.name)}</div><div><div class="p">${price}</div>${i.stock_track ? `<div class="st">Stock: ${i.stock}</div>` : ''}</div></div>`;
  }).join('') || '<div class="mut" style="padding:20px">No items. Add menu from Menu tab.</div>';
}
A.search = (v) => { S.search = v; renderItems(); };
A.cat = (d) => { S.cat = Number(d.id); renderCats(); renderItems(); };
function pushCart(i, variant, price) {
  const line = { item_id: i.id, name: i.name, variant: variant || '', price, qty: 1, note: '', kitchen: i.kitchen };
  const ex = S.cart.find((x) => lineKey(x) === lineKey(line));
  if (ex) ex.qty++; else S.cart.push(line);
  renderCart();
}
A.addItem = (d) => {
  const i = S.menu.items.find((x) => x.id === Number(d.id));
  if (i.variants.length) {
    openModal(`<h3>${esc(i.name)}</h3><div class="chips">${i.variants.map((v, k) => `<button data-act="pickVar" data-id="${i.id}" data-k="${k}">${esc(v.name)} - ${money(v.price)}</button>`).join('')}</div><div class="foot"><button data-act="close">Cancel</button></div>`);
  } else pushCart(i, '', i.price);
};
A.pickVar = (d) => { const i = S.menu.items.find((x) => x.id === Number(d.id)); const v = i.variants[Number(d.k)]; closeModal(); pushCart(i, v.name, v.price); };
A.close = closeModal;
A.qty = (d) => { const l = S.cart[Number(d.i)]; l.qty += Number(d.d); if (l.qty <= 0) S.cart.splice(Number(d.i), 1); renderCart(); };
A.lineNote = (d) => {
  const l = S.cart[Number(d.i)];
  openModal(`<h3>Note for ${esc(l.name)}</h3><input id="lnote" value="${esc(l.note)}" placeholder="e.g. no onion, extra cheese"><div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="saveLineNote" data-i="${d.i}">Save</button></div>`);
  setTimeout(() => $('#lnote') && $('#lnote').focus(), 50);
};
A.saveLineNote = (d) => { S.cart[Number(d.i)].note = val('lnote'); closeModal(); renderCart(); };
A.otype = (d) => { S.ctx.type = d.t; renderCart(); };
A.ctxField = (v, el) => { S.ctx[el.dataset.f] = v; };
A.discType = (v) => { S.disc.type = v; renderCart(); };
A.discVal = (v) => { S.disc.value = v; renderTotals(); };
function renderCart() {
  const c = $('#cart'); if (!c) return;
  const x = S.ctx;
  const tableSel = S.tables.length ? `<select data-in="ctxField" data-f="table_no"><option value="">Select table</option>${S.tables.map((t) => `<option ${x.table_no === t.name ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`
    : `<input data-in="ctxField" data-f="table_no" placeholder="Table no." value="${esc(x.table_no)}">`;
  c.innerHTML = `<div class="hd"><div class="seg">${['dine-in', 'takeaway', 'delivery'].map((t) => `<button class="${x.type === t ? 'on' : ''}" data-act="otype" data-t="${t}">${t}</button>`).join('')}</div>
    <div style="margin-top:8px">${x.type === 'dine-in' ? tableSel : `<div class="row2"><input data-in="ctxField" data-f="customer" placeholder="Customer" value="${esc(x.customer)}"><input data-in="ctxField" data-f="phone" placeholder="Phone" value="${esc(x.phone)}"></div>${x.type === 'delivery' ? `<input style="margin-top:6px" data-in="ctxField" data-f="address" placeholder="Delivery address" value="${esc(x.address)}">` : ''}`}</div></div>
    <div class="lines">${S.cart.map((l, i) => `<div class="line"><div class="nm">${esc(l.name)}${l.variant ? ` <small>${esc(l.variant)}</small>` : ''}${l.note ? `<small>* ${esc(l.note)}</small>` : ''}<small>${money(l.price)}</small></div>
      <div class="qty"><button data-act="qty" data-i="${i}" data-d="-1">-</button><b>${l.qty}</b><button data-act="qty" data-i="${i}" data-d="1">+</button></div>
      <div style="width:70px;text-align:right">${money(l.price * l.qty)}</div><button class="ghost" data-act="lineNote" data-i="${i}" title="Note">✎</button></div>`).join('') || '<div class="mut" style="padding:30px;text-align:center">Cart is empty</div>'}</div>
    <div class="tot" id="totals"></div>
    <div class="acts"><button data-act="clearCart">Clear</button><button data-act="holdOrder">Hold</button><button data-act="kotOnly">Print KOT</button><button data-act="heldList">Recall</button><button class="ok pay" data-act="payDlg" ${S.cart.length ? '' : 'disabled'}>Pay</button></div>`;
  renderTotals();
}
function renderTotals() {
  const t = calc(), st = S.settings; const el = $('#totals'); if (!el) return;
  el.innerHTML = `<div class="row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
    <div class="row"><span>Discount</span><span style="display:flex;gap:4px"><select style="width:70px;padding:3px" data-in="discType"><option value="amount" ${S.disc.type === 'amount' ? 'selected' : ''}>Amt</option><option value="percent" ${S.disc.type === 'percent' ? 'selected' : ''}>%</option></select><input style="width:70px;padding:3px" data-in="discVal" type="number" min="0" value="${S.disc.value || ''}"></span></div>
    ${t.service ? `<div class="row"><span>Service (${st.service_percent}%)</span><span>${money(t.service)}</span></div>` : ''}
    ${t.tax ? `<div class="row"><span>${esc(st.tax_label)} (${st.tax_percent}%)</span><span>${money(t.tax)}</span></div>` : ''}
    ${t.delivery ? `<div class="row"><span>Delivery</span><span>${money(t.delivery)}</span></div>` : ''}
    <div class="row big"><span>Total</span><span>${money(t.total)}</span></div>`;
}
function resetOrder() {
  S.cart = []; S.disc = { type: 'amount', value: 0 };
  S.ctx = { type: S.ctx.type, table_no: '', customer: '', phone: '', address: '', note: '', id: null };
}
A.clearCart = () => { resetOrder(); renderCart(); };
const orderPayload = (extra) => ({ ...S.ctx, items: S.cart, discount_type: S.disc.type, discount_value: S.disc.value, user: S.user, ...extra });
A.holdOrder = async () => {
  const o = await api('saveOrder', orderPayload({ status: 'held' }));
  if (S.settings.print_kot === '1') await printKot(o);
  toast('Order held #' + o.id); resetOrder(); viewPos();
};
A.kotOnly = async () => { if (!S.cart.length) return; await printKot({ id: S.ctx.id || '-', type: S.ctx.type, table_no: S.ctx.table_no, customer: S.ctx.customer, items: S.cart, created_at: new Date().toISOString(), user_name: S.user.name }); };
A.heldList = async () => {
  const h = await api('listOrders', { status: 'held' });
  openModal(`<h3>Held / Open orders</h3><table><tr><th>#</th><th>Type</th><th>Table/Customer</th><th class="r">Total</th><th></th></tr>${h.map((o) => `<tr><td>${o.id}</td><td>${o.type}</td><td>${esc(o.table_no || o.customer)}</td><td class="r">${money(o.total)}</td><td><button class="pri" data-act="recall" data-id="${o.id}">Recall</button> <button class="bad" data-act="delHeld" data-id="${o.id}">X</button></td></tr>`).join('') || '<tr><td colspan="5" class="mut">None</td></tr>'}</table><div class="foot"><button data-act="close">Close</button></div>`);
};
A.recall = async (d) => {
  const o = await api('getOrder', Number(d.id));
  S.cart = o.items; S.ctx = { type: o.type, table_no: o.table_no, customer: o.customer, phone: o.phone, address: o.address, note: o.note, id: o.id };
  S.disc = { type: 'amount', value: o.discount || 0 }; closeModal(); S.view = 'pos'; render();
};
A.delHeld = async (d) => { await api('deleteHeld', Number(d.id)); A.heldList(); };
let payMethod = 'cash';
A.payDlg = () => {
  const t = calc(); payMethod = 'cash';
  openModal(`<h3>Payment - ${money(t.total)}</h3><div class="chips" id="pm">${['cash', 'card', 'easypaisa', 'jazzcash', 'bank'].map((m) => `<button class="${m === 'cash' ? 'on' : ''}" data-act="pm" data-m="${m}">${m}</button>`).join('')}</div>
  <div id="cashBox"><label>Cash received</label><input id="recv" type="number" value="${t.total}" data-in="recvCalc"><div class="chips" style="margin-top:8px">${[t.total, 500, 1000, 2000, 5000].map((v) => `<button data-act="setRecv" data-v="${v}">${v === t.total ? 'Exact' : v}</button>`).join('')}</div>
  <div style="margin-top:10px;font-size:18px">Change: <b id="chg">${money(0)}</b></div></div>
  <label>Order note</label><input id="onote" value="${esc(S.ctx.note)}">
  <div class="foot"><button data-act="close">Cancel</button><button class="ok" id="payOk" data-act="doPay">Complete & Print</button></div>`);
  setTimeout(() => { const r = $('#recv'); if (r) { r.focus(); r.select(); } }, 50);
};
A.pm = (d) => { payMethod = d.m; document.querySelectorAll('#pm button').forEach((b) => b.classList.toggle('on', b.dataset.m === d.m)); $('#cashBox').style.display = d.m === 'cash' ? '' : 'none'; };
A.setRecv = (d) => { $('#recv').value = d.v; A.recvCalc(d.v); };
A.recvCalc = (v) => { const el = $('#chg'); if (el) el.textContent = money(Math.max(0, Number(v) - calc().total)); };
A.doPay = async () => {
  const wasHeld = !!S.ctx.id;
  const o = await api('saveOrder', orderPayload({ status: 'paid', payment: payMethod, received: val('recv'), note: val('onote') }));
  closeModal(); toast('Order #' + o.id + ' paid');
  await printReceipt(o);
  if (S.settings.print_kot === '1' && !wasHeld) await printKot(o);
  resetOrder(); S.menu = await api('getMenu', false); viewPos();
};

// ================= PRINTING =================
const pcss = () => { const w = S.settings.paper_width === '58' ? '54mm' : '76mm'; return `<style>@page{margin:0}body{width:${w};font:12px/1.35 Consolas,monospace;margin:0 auto;padding:4px;color:#000}h1{font-size:16px;text-align:center;margin:2px 0}.c{text-align:center}.r{text-align:right}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}.b{border-top:1px dashed #000;margin:4px 0}.t{font-weight:bold;font-size:14px}img{max-width:60%;display:block;margin:0 auto}</style>`; };
function receiptHtml(o) {
  const s = S.settings; const d = new Date(o.created_at);
  return `<html><head><meta charset="utf-8">${pcss()}</head><body>
  ${s.logo ? `<img src="${s.logo}">` : ''}<h1>${esc(s.name)}</h1><div class="c">${esc(s.tagline)}<br>${esc(s.address)}<br>${esc(s.phone)}${s.ntn ? `<br>NTN: ${esc(s.ntn)}` : ''}</div><div class="b"></div>
  <table><tr><td>Order #${o.id}</td><td class="r">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td></tr>
  <tr><td>${esc(o.type.toUpperCase())}${o.table_no ? ' - Table ' + esc(o.table_no) : ''}</td><td class="r">${esc(o.user_name)}</td></tr>
  ${o.customer ? `<tr><td colspan="2">${esc(o.customer)} ${esc(o.phone)}</td></tr>` : ''}${o.address ? `<tr><td colspan="2">${esc(o.address)}</td></tr>` : ''}</table><div class="b"></div>
  <table>${o.items.map((i) => `<tr><td>${i.qty} x ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''}${i.note ? '<br>&nbsp;&nbsp;* ' + esc(i.note) : ''}</td><td class="r">${Math.round(i.price * i.qty)}</td></tr>`).join('')}</table><div class="b"></div>
  <table><tr><td>Subtotal</td><td class="r">${Math.round(o.subtotal)}</td></tr>
  ${o.discount ? `<tr><td>Discount</td><td class="r">-${Math.round(o.discount)}</td></tr>` : ''}${o.service ? `<tr><td>Service</td><td class="r">${Math.round(o.service)}</td></tr>` : ''}
  ${o.tax ? `<tr><td>${esc(s.tax_label)} (${s.tax_percent}%)</td><td class="r">${Math.round(o.tax)}</td></tr>` : ''}${o.delivery ? `<tr><td>Delivery</td><td class="r">${Math.round(o.delivery)}</td></tr>` : ''}
  <tr class="t"><td>TOTAL</td><td class="r">${s.currency} ${Math.round(o.total)}</td></tr>
  <tr><td>Paid (${esc(o.payment)})</td><td class="r">${Math.round(o.received)}</td></tr>${o.payment === 'cash' && o.received > o.total ? `<tr><td>Change</td><td class="r">${Math.round(o.received - o.total)}</td></tr>` : ''}</table>
  <div class="b"></div><div class="c">${esc(s.receipt_footer)}</div></body></html>`;
}
function kotHtml(o) {
  const items = o.items.filter((i) => i.kitchen !== 0); const d = new Date(o.created_at);
  return `<html><head><meta charset="utf-8">${pcss()}</head><body><h1>KITCHEN ORDER</h1><div class="c t">${esc(o.type.toUpperCase())}${o.table_no ? ' - TABLE ' + esc(o.table_no) : ''}</div>
  <div class="c">#${o.id} - ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${esc(o.user_name || '')}</div><div class="b"></div>
  <table>${items.map((i) => `<tr class="t"><td>${i.qty} x ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''}${i.note ? '<br><small>* ' + esc(i.note) + '</small>' : ''}</td></tr>`).join('')}</table><div class="b"></div></body></html>`;
}
const printReceipt = (o) => window.pos.print(receiptHtml(o), S.settings.silent_print === '1');
const printKot = (o) => window.pos.print(kotHtml(o), S.settings.silent_print === '1');

// ================= ORDERS =================
let ordDay = null;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
async function viewOrders() {
  ordDay = ordDay || todayStr();
  const list = await api('listOrders', { day: ordDay });
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Orders</h2><input type="date" id="oday" value="${ordDay}" style="width:170px" data-in="ordDayChg"></div><div class="card"><table><tr><th>#</th><th>Time</th><th>Type</th><th>Table/Cust</th><th>Staff</th><th>Pay</th><th class="r">Total</th><th>Status</th><th></th></tr>
  ${list.map((o) => `<tr><td>${o.id}</td><td>${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>${o.type}</td><td>${esc(o.table_no || o.customer)}</td><td>${esc(o.user_name)}</td><td>${esc(o.payment)}</td><td class="r">${money(o.total)}</td><td><span class="badge ${o.status}">${o.status}</span></td><td><button data-act="viewOrder" data-id="${o.id}">View</button></td></tr>`).join('') || '<tr><td colspan="9" class="mut">No orders</td></tr>'}</table></div></div>`;
}
A.ordDayChg = (v) => { ordDay = v; viewOrders(); };
A.viewOrder = async (d) => {
  const o = await api('getOrder', Number(d.id));
  openModal(`<h3>Order #${o.id} <span class="badge ${o.status}">${o.status}</span></h3><div style="background:#fff;border-radius:8px;padding:8px;max-height:50vh;overflow:auto"><iframe style="border:0;width:320px;height:380px" srcdoc="${esc(receiptHtml(o))}"></iframe></div>
  <div class="foot"><button data-act="close">Close</button><button data-act="reprint" data-id="${o.id}">Reprint</button><button data-act="reprintKot" data-id="${o.id}">KOT</button>${o.status === 'paid' ? `<button class="bad" data-act="voidAsk" data-id="${o.id}">Void</button>` : ''}</div>`);
};
A.reprint = async (d) => printReceipt(await api('getOrder', Number(d.id)));
A.reprintKot = async (d) => printKot(await api('getOrder', Number(d.id)));
A.voidAsk = (d) => {
  openModal(`<h3>Void order #${d.id}</h3><label>Reason</label><input id="vreason" placeholder="Reason">${isAdmin() ? '' : '<label>Admin PIN</label><input id="vpin" type="password" inputmode="numeric">'}
  <div class="foot"><button data-act="close">Cancel</button><button class="bad" data-act="voidDo" data-id="${d.id}">Void order</button></div>`);
};
A.voidDo = async (d) => {
  let who = S.user.name;
  if (!isAdmin()) { const a = await api('login', val('vpin')); if (!a || a.role !== 'admin') return toast('Admin PIN required', true); who = a.name; }
  await api('voidOrder', Number(d.id), who, val('vreason')); closeModal(); toast('Order voided'); viewOrders();
};

render();
(async () => { S.settings = await api('getSettings'); render(); })();
