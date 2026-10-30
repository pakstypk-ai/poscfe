'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { cust: null, user: null, settings: {}, menu: { categories: [], items: [] }, tables: [], view: 'pos', cart: [], cat: 0, search: '',
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
document.addEventListener('change', (e) => { const t = e.target.closest('[data-chg]'); if (t && A[t.dataset.chg]) safe(() => A[t.dataset.chg](t.type === 'checkbox' ? t.checked : t.value, t)); });
document.addEventListener('input', (e) => { const t = e.target.closest('[data-in]'); if (t && A[t.dataset.in]) A[t.dataset.in](t.value, t); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

async function loadAll() {
  S.settings = await api('getSettings'); S.menu = await api('getMenu', false); S.tables = await api('listTables');
}
const isAdmin = () => S.user && S.user.role === 'admin';

// ================= LOGIN =================
const can = (p) => !!S.user && (S.user.role === 'admin' || (Array.isArray(p) ? p.some((x) => S.user.permissions.includes(x)) : S.user.permissions.includes(p)));
const NAV = [['dashboard', 'Dashboard', '🏠', 'dashboard'], ['pos', 'POS', '🧾', 'pos'], ['orders', 'Orders', '📋', 'orders'], ['kitchen', 'Kitchen', '🍳', 'kitchen'], ['delivery', 'Delivery', '🛵', 'delivery'],
  ['tables', 'Tables', '🪑', ['tables', 'table_status']], ['menu', 'Menu', '🍔', 'menu'], ['customers', 'Customers', '🤝', 'customers'], ['khata', 'Customer Credit', '📒', 'khata'], ['inventory', 'Inventory', '📦', 'inventory'],
  ['suppliers', 'Suppliers', '🚚', 'suppliers'], ['payments', 'Payments', '💳', 'payments'], ['expenses', 'Expenses', '💸', 'expenses'], ['reports', 'Reports', '📊', 'reports'], ['receipt', 'Receipt Design', '🖨️', 'settings'],
  ['staff', 'Staff', '👥', 'staff'], ['settings', 'Settings', '⚙️', 'settings']];
let loginErr = '', loginUser = '';
function renderLogin() {
  const s = S.settings;
  $('#app').innerHTML = `<div class="loginwrap"><div class="login">${s.logo ? `<img src="${s.logo}">` : ''}<h1>${esc(s.name || 'Cafe POS')}</h1><div class="sub">Sign in to continue</div>
  <label style="text-align:left">Login ID</label><input id="lu" autocomplete="off" value="${esc(loginUser)}">
  <label style="text-align:left">PIN / Password</label><input id="lp" type="password" autocomplete="off">
  <div class="err" id="lerr">${esc(loginErr)}</div><button class="pri" style="width:100%;padding:12px" data-act="doLogin">Sign in</button>
  ${s.setup_done !== '1' ? '<div class="mut" style="margin-top:14px;font-size:12px">First time: Login ID <b>admin</b>, PIN <b>1234</b> (change it in Staff)</div>' : ''}</div></div>`;
  setTimeout(() => { const e = $(loginUser ? '#lp' : '#lu'); if (e) e.focus(); }, 30);
}
function firstView() { return (NAV.find((n) => can(n[3])) || [])[0] || 'none'; }
A.doLogin = async () => {
  loginUser = val('lu').trim();
  const r = await window.pos.login(loginUser, val('lp'));
  if (r.error) { loginErr = r.error; const e = $('#lerr'); if (e) e.textContent = r.error; const p = $('#lp'); if (p) { p.value = ''; p.focus(); } return; }
  loginErr = ''; loginUser = ''; S.user = r.user; S.readySeen = null; await loadAll(); S.view = firstView();
  if (S.settings.setup_done !== '1' && can('settings')) { S.view = 'settings'; toast('Welcome! Please set up your restaurant details first.'); }
  render();
};
document.addEventListener('keydown', (e) => { if (!S.user && e.key === 'Enter' && $('#lu')) A.doLogin(); });

// ================= SHELL =================
function clearTimers() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
function render() {
  clearTimers();
  if (!S.user) return renderLogin();
  const tabs = NAV.filter((n) => can(n[3]));
  if (!tabs.some(([k]) => k === S.view)) S.view = firstView();
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="sb-brand">${S.settings.logo ? `<img src="${S.settings.logo}">` : ''}<span>${esc(S.settings.name)}</span></div>
    <div class="sb-user"><div class="n">${esc(S.user.name)}</div><div class="u">@${esc(S.user.username)}</div><span class="role">${esc(S.user.role)}</span></div>
    <nav class="sb-nav">${tabs.map(([k, l, ic]) => `<button class="nv ${S.view === k ? 'on' : ''}" data-act="nav" data-v="${k}"><span class="ic">${ic}</span>${l}</button>`).join('')}</nav>
    <div class="sb-foot"><button data-act="myPin">Change my PIN</button><button data-act="logout">Logout</button></div></aside><div class="main" id="main"></div></div>`;
  const V = { dashboard: viewDashboard, pos: viewPos, orders: viewOrders, kitchen: viewKitchen, delivery: viewDelivery, tables: viewTables, menu: viewMenu, customers: () => viewCustomers(false), khata: () => viewCustomers(true), inventory: viewInventory, suppliers: viewSuppliers, payments: viewPayments, expenses: viewExpenses, reports: viewReports, receipt: viewReceipt, staff: viewStaff, settings: viewSettings };
  (V[S.view] || (() => { $('#main').innerHTML = '<div class="page"><div class="card">No screens are enabled for your account. Please ask the admin.</div></div>'; }))();
}
A.nav = async (d) => { S.view = d.v; if (d.v === 'delivery' && typeof DV !== 'undefined') DV.tab = 'orders'; if (d.v === 'pos') { S.menu = await api('getMenu', false); S.tables = await api('listTables'); } render(); };
A.logout = async () => { await window.pos.logout(); S.user = null; S.readySeen = null; S.cart = []; S.disc = { type: 'amount', value: 0 }; S.cust = null; S.ctx = { type: 'dine-in', table_no: '', customer: '', phone: '', address: '', note: '', id: null, customer_id: null, loyalty: false }; closeModal(); render(); };
A.myPin = () => openModal(`<h3>Change my PIN</h3><label>Current PIN / password</label><input id="mp0" type="password"><label>New PIN / password (4-30 characters)</label><input id="mp1" type="password"><label>Repeat new PIN</label><input id="mp2" type="password">
  <div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="myPinSave">Save</button></div>`);
A.myPinSave = async () => {
  if (val('mp1') !== val('mp2')) return toast('New PIN does not match', true);
  await api('changeMyPin', val('mp0'), val('mp1')); closeModal(); toast('Your PIN was changed');
};
// alert when the kitchen marks an order READY
let beepCtx;
function beep() { try { beepCtx = beepCtx || new AudioContext(); const o = beepCtx.createOscillator(), g = beepCtx.createGain(); o.connect(g); g.connect(beepCtx.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(); setTimeout(() => { o.frequency.value = 1175; }, 180); setTimeout(() => o.stop(), 450); } catch (e) { /* no sound */ } }
function speak(text) { try { if (S.settings.voice_alerts === '1' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; window.speechSynthesis.speak(u); } } catch (e) { /* no voice */ } }
async function pollReady() {
  if (!S.user || !(can('kitchen') || can('orders') || can('pos'))) return;
  try {
    const ready = (await api('kitchenOrders')).filter((o) => o.kstatus === 'ready');
    if (S.readySeen) {
      const fresh = ready.filter((o) => !S.readySeen.has(o.id));
      if (fresh.length) {
        beep(); fresh.forEach((o) => { const who = o.customer || (o.table_no ? 'table ' + o.table_no : ''); toast(`Order #${o.id} ${who ? '(' + who + ') ' : ''}is READY`); speak(`Order number ${o.id}${who ? ', ' + who : ''}, is ready. Please collect.`); });
        if (S.view === 'orders') viewOrders();
      }
    }
    S.readySeen = new Set(ready.map((o) => o.id));
  } catch (e) { /* ignore */ }
}
setInterval(pollReady, 6000);

// ================= POS =================
const lineKey = (i) => i.item_id + '|' + (i.variant || '') + '|' + (i.note || '');
const catColor = (id) => ((S.menu.categories.find((c) => c.id === id) || {}).color) || '#ea580c';
function calc() {
  const sub = S.cart.reduce((a, i) => a + i.price * i.qty, 0), st = S.settings;
  let disc = S.disc.type === 'percent' ? sub * (Number(S.disc.value) || 0) / 100 : Number(S.disc.value) || 0;
  disc = Math.min(Math.max(disc, 0), sub);
  const lp = S.ctx.loyalty && S.cust && S.cust.loyalty ? S.cust.loyalty.pct : 0;
  const loy = lp > 0 ? (sub - disc) * lp / 100 : 0;
  const base = sub - disc - loy;
  const service = S.ctx.type === 'dine-in' ? base * (Number(st.service_percent) || 0) / 100 : 0;
  const tax = (base + service) * (Number(st.tax_percent) || 0) / 100;
  const delivery = S.ctx.type === 'delivery' ? Number(st.delivery_fee) || 0 : 0;
  return { sub, disc, loy, lp, service, tax, delivery, total: Math.round(base + service + tax + delivery) };
}
function viewPos() {
  $('#main').innerHTML = `<div class="menu"><div class="row2" style="flex:none;margin-bottom:8px"><input id="search" data-in="search" placeholder="Search item..." value="${esc(S.search)}"><div style="flex:none;display:flex;gap:6px">
    <button data-act="heldList" id="heldBtn">Held / Open</button></div></div><div class="cats" id="cats"></div><div class="items" id="items"></div></div><div class="cart" id="cart"></div>`;
  renderCats(); renderItems(); renderCart();
  api('listOrders', { status: 'held' }).then((h) => { const b = $('#heldBtn'); if (b) b.textContent = `Held / Open (${h.length})`; });
}
function renderCats() {
  $('#cats').innerHTML = `<button class="${!S.cat ? 'on' : ''}" data-act="cat" data-id="0">All</button>` + S.menu.categories.map((c) => `<button class="${S.cat === c.id ? 'on' : ''}" style="${S.cat === c.id ? '' : `border-bottom:3px solid ${c.color}`}" data-act="cat" data-id="${c.id}">${esc(c.name)}</button>`).join('');
}
function renderItems() {
  const s = S.search.toLowerCase();
  const list = S.menu.items.filter((i) => (!S.cat || i.category_id === S.cat) && (!s || i.name.toLowerCase().includes(s)));
  $('#items').innerHTML = list.map((i) => {
    const out = i.stock_track && i.stock <= 0;
    const price = i.variants.length ? `from ${money(Math.min(...i.variants.map((v) => v.price)))}` : money(i.price);
    return `<div class="item ${out ? 'out' : ''}" style="border-top:4px solid ${catColor(i.category_id)}" data-act="addItem" data-id="${i.id}">${i.image ? `<img class="ti" src="${i.image}">` : ''}<div class="n">${esc(i.name)}</div>${i.description ? `<div class="st">${esc(i.description)}</div>` : ''}<div><div class="p">${price}</div>${i.stock_track ? `<div class="st">Stock: ${i.stock}</div>` : ''}</div></div>`;
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
  openModal(`<h3>Kitchen note for ${esc(l.name)}</h3><input id="lnote" value="${esc(l.note)}" placeholder="e.g. no onion, extra cheese, cheese lover"><div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="saveLineNote" data-i="${d.i}">Save</button></div>`);
  setTimeout(() => $('#lnote') && $('#lnote').focus(), 50);
};
A.saveLineNote = (d) => { S.cart[Number(d.i)].note = val('lnote'); closeModal(); renderCart(); };
A.otype = (d) => { S.ctx.type = d.t; renderCart(); };
A.ctxField = (v, el) => { S.ctx[el.dataset.f] = v; };
A.discType = (v) => { S.disc.type = v; renderCart(); };
A.discVal = (v) => { S.disc.value = v; renderTotals(); };
A.lookupCust = async (v) => {
  const c = String(v).replace(/\D/g, '').length >= 7 ? await api('findCustomer', v) : null;
  S.cust = c; S.ctx.customer_id = c ? c.id : null; S.ctx.loyalty = false;
  if (c) { S.ctx.customer = c.name; if (!S.ctx.address && c.address) S.ctx.address = c.address; }
  renderCart();
};
A.loyaltyChk = (checked) => { S.ctx.loyalty = checked; renderTotals(); };
function renderCart() {
  const c = $('#cart'); if (!c) return;
  const x = S.ctx;
  const free = S.tables.filter((t) => (t.status === 'available' && !t.occupied) || t.name === x.table_no);
  const tableSel = S.tables.length ? `<select data-in="ctxField" data-f="table_no"><option value="">Select table (${free.length} available)</option>${free.map((t) => `<option value="${esc(t.name)}" ${x.table_no === t.name ? 'selected' : ''}>${esc(t.name)} - ${t.capacity} seats${t.section ? ', ' + esc(t.section) : ''}</option>`).join('')}</select>`
    : `<input data-in="ctxField" data-f="table_no" placeholder="Table no." value="${esc(x.table_no)}">`;
  const cu = S.cust;
  c.innerHTML = `<div class="hd"><div class="seg">${['dine-in', 'takeaway', 'delivery'].map((t) => `<button class="${x.type === t ? 'on' : ''}" data-act="otype" data-t="${t}">${t}</button>`).join('')}</div>
    <div style="margin-top:8px">${x.type === 'dine-in' ? tableSel : ''}${x.type === 'delivery' ? `<input data-in="ctxField" data-f="address" placeholder="Delivery address / area" value="${esc(x.address)}">` : ''}</div>
    <div class="row2" style="margin-top:6px"><input data-in="ctxField" data-f="customer" placeholder="Customer name" value="${esc(x.customer)}"><input data-in="ctxField" data-chg="lookupCust" data-f="phone" placeholder="Phone (finds saved customer)" value="${esc(x.phone)}"></div>
    ${cu ? `<div class="custbox"><b>${esc(cu.name)}</b> - Khata due ${money(cu.balance)}${cu.credit_limit ? ' / limit ' + money(cu.credit_limit) : ''} - ${cu.loyalty.monthOrders} orders this month${cu.loyalty.pct > 0 ? `<label style="margin:4px 0 0;color:var(--ok);font-weight:700"><input type="checkbox" data-chg="loyaltyChk" ${x.loyalty ? 'checked' : ''}> Apply loyalty discount ${cu.loyalty.pct}%</label>` : ''}</div>` : ''}
    <input style="margin-top:6px" data-in="ctxField" data-f="note" placeholder="Order note for kitchen (not on customer bill)" value="${esc(x.note)}"></div>
    <div class="lines">${S.cart.map((l, i) => `<div class="line"><div class="nm">${esc(l.name)}${l.variant ? ` <small>${esc(l.variant)}</small>` : ''}${l.note ? `<small>* ${esc(l.note)}</small>` : ''}<small>${money(l.price)}</small></div>
      <div class="qty"><button data-act="qty" data-i="${i}" data-d="-1">-</button><b>${l.qty}</b><button data-act="qty" data-i="${i}" data-d="1">+</button></div>
      <div style="width:70px;text-align:right">${money(l.price * l.qty)}</div><button class="ghost" data-act="lineNote" data-i="${i}" title="Kitchen note">✎</button></div>`).join('') || '<div class="mut" style="padding:30px;text-align:center">Cart is empty</div>'}</div>
    <div class="tot" id="totals"></div>
    <div class="acts"><button data-act="clearCart">Clear</button><button data-act="holdOrder">Hold / Send to kitchen</button><button data-act="kotOnly">Print KOT</button><button data-act="heldList">Recall</button><button class="ok pay" data-act="payDlg" ${S.cart.length ? '' : 'disabled'}>Checkout</button></div>`;
  renderTotals();
}
function renderTotals() {
  const t = calc(), st = S.settings; const el = $('#totals'); if (!el) return;
  const dis = can('discount') ? '' : 'disabled';
  el.innerHTML = `<div class="row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
    <div class="row"><span>Discount</span><span style="display:flex;gap:4px"><select style="width:70px;padding:3px" data-in="discType" ${dis}><option value="amount" ${S.disc.type === 'amount' ? 'selected' : ''}>Amt</option><option value="percent" ${S.disc.type === 'percent' ? 'selected' : ''}>%</option></select><input style="width:70px;padding:3px" data-in="discVal" type="number" min="0" value="${S.disc.value || ''}" ${dis}></span></div>
    ${t.loy ? `<div class="row"><span>Loyalty (${t.lp}%)</span><span>-${money(t.loy)}</span></div>` : ''}
    ${t.service ? `<div class="row"><span>Service (${st.service_percent}%)</span><span>${money(t.service)}</span></div>` : ''}
    ${t.tax ? `<div class="row"><span>${esc(st.tax_label)} (${st.tax_percent}%)</span><span>${money(t.tax)}</span></div>` : ''}
    ${t.delivery ? `<div class="row"><span>Delivery charges</span><span>${money(t.delivery)}</span></div>` : ''}
    <div class="row big"><span>Total</span><span>${money(t.total)}</span></div>`;
}
function resetOrder() {
  S.cart = []; S.disc = { type: 'amount', value: 0 }; S.cust = null;
  S.ctx = { type: S.ctx.type, table_no: '', customer: '', phone: '', address: '', note: '', id: null, customer_id: null, loyalty: false };
}
A.clearCart = () => { resetOrder(); renderCart(); };
const orderPayload = (extra) => ({ ...S.ctx, items: S.cart, discount_type: S.disc.type, discount_value: S.disc.value, user: S.user, ...extra });
A.holdOrder = async () => {
  const o = await api('saveOrder', orderPayload({ status: 'held' }));
  if (S.settings.print_kot === '1') await printKot(o);
  toast('Order #' + o.id + ' saved - kitchen can see it'); resetOrder(); S.tables = await api('listTables'); viewPos();
};
A.kotOnly = async () => { if (!S.cart.length) return; await printKot({ id: S.ctx.id || '-', type: S.ctx.type, table_no: S.ctx.table_no, customer: S.ctx.customer, note: S.ctx.note, items: S.cart, created_at: new Date().toISOString(), user_name: S.user.name }); };
A.heldList = async () => {
  const h = await api('listOrders', { status: 'held' });
  openModal(`<h3>Held / Open orders</h3><table><tr><th>#</th><th>Type</th><th>Table/Customer</th><th class="r">Total</th><th></th></tr>${h.map((o) => `<tr><td>${o.id}</td><td>${o.type}</td><td>${esc(o.table_no || o.customer)}</td><td class="r">${money(o.total)}</td><td><button class="pri sm" data-act="recall" data-id="${o.id}">Recall / Edit</button> <button class="bad sm" data-act="delHeld" data-id="${o.id}">X</button></td></tr>`).join('') || '<tr><td colspan="5" class="mut">None</td></tr>'}</table><div class="foot"><button data-act="close">Close</button></div>`);
};
A.recall = async (d) => {
  const o = await api('getOrder', Number(d.id));
  S.cart = o.items; S.cust = null;
  S.ctx = { type: o.type, table_no: o.table_no, customer: o.customer, phone: o.phone, address: o.address, note: o.note, id: o.id, customer_id: o.customer_id || null, loyalty: false };
  S.disc = { type: 'amount', value: Math.round((o.discount || 0) - (o.loyalty || 0)) };
  if (o.phone) { try { S.cust = await api('findCustomer', o.phone); if (S.cust && S.cust.loyalty.pct > 0 && o.loyalty > 0) S.ctx.loyalty = true; } catch (e) { /* no customer */ } }
  S.tables = await api('listTables'); closeModal(); S.view = 'pos'; render();
};
A.delHeld = async (d) => { await api('deleteHeld', Number(d.id)); A.heldList(); };
let payMethod = 'cash', payStatus = 'paid';
A.payDlg = () => {
  const t = calc(); payMethod = 'cash'; payStatus = 'paid';
  openModal(`<h3>Checkout - ${money(t.total)}</h3>
  <label>Payment method</label><div class="chips" id="pm">${[['cash', 'Cash'], ['card', 'Card'], ['online', 'Online']].map(([m, l]) => `<button class="${m === 'cash' ? 'on' : ''}" data-act="pm" data-m="${m}">${l}</button>`).join('')}</div>
  <label>Payment status</label><div class="chips" id="ps">${[['paid', 'Paid'], ['unpaid', 'Unpaid (credit / khata)'], ['partial', 'Partial']].map(([m, l]) => `<button class="${m === 'paid' ? 'on' : ''}" data-act="ps" data-m="${m}">${l}</button>`).join('')}</div>
  <div id="partBox" style="display:none"><label>Amount paying now</label><input id="pamt" type="number" data-in="payCalc"></div>
  <div id="cashBox"><label>Cash received</label><input id="recv" type="number" value="${t.total}" data-in="payCalc"><div class="chips" style="margin-top:8px">${[t.total, 500, 1000, 2000, 5000].map((v) => `<button data-act="setRecv" data-v="${v}">${v === t.total ? 'Exact' : v}</button>`).join('')}</div>
  <div style="margin-top:10px;font-size:18px">Change: <b id="chg">${money(0)}</b></div></div>
  <div id="dueLine" class="mut" style="margin-top:8px"></div>
  <div class="foot"><button data-act="close">Cancel</button><button class="ok" data-act="doPay">Confirm & Print Receipt</button></div>`);
  setTimeout(() => { const r = $('#recv'); if (r) { r.focus(); r.select(); } }, 50);
};
function payNow() { const t = calc().total; return payStatus === 'paid' ? t : payStatus === 'partial' ? Number(val('pamt')) || 0 : 0; }
function payUi() {
  const t = calc().total, now = payNow();
  $('#partBox').style.display = payStatus === 'partial' ? '' : 'none';
  $('#cashBox').style.display = payMethod === 'cash' && payStatus !== 'unpaid' ? '' : 'none';
  const chg = $('#chg'); if (chg) chg.textContent = money(Math.max(0, (Number(val('recv')) || 0) - now));
  const due = $('#dueLine'); if (due) due.textContent = t - now > 0 ? `Goes to customer credit (khata): ${money(t - now)}${S.ctx.phone || S.cust ? '' : ' - enter customer name + phone first'}` : '';
}
A.pm = (d) => { payMethod = d.m; document.querySelectorAll('#pm button').forEach((b) => b.classList.toggle('on', b.dataset.m === d.m)); payUi(); };
A.ps = (d) => { payStatus = d.m; document.querySelectorAll('#ps button').forEach((b) => b.classList.toggle('on', b.dataset.m === d.m)); const r = $('#recv'); if (r && d.m !== 'partial') r.value = calc().total; payUi(); };
A.setRecv = (d) => { $('#recv').value = d.v; payUi(); };
A.payCalc = () => payUi();
A.doPay = async () => {
  const o = await api('saveOrder', orderPayload({ status: 'paid', payment: payMethod, pay_status: payStatus, received: val('recv'), paid_amount: val('pamt') }));
  closeModal(); toast('Order #' + o.id + ' saved');
  await printReceipt(o);
  if (S.settings.print_kot === '1' && !S.ctx.id) await printKot(o);
  resetOrder(); S.menu = await api('getMenu', false); S.tables = await api('listTables'); viewPos();
};

// ================= PRINTING =================
const FONTS = { Consolas: 'Consolas,monospace', Arial: 'Arial,Helvetica,sans-serif', Tahoma: 'Tahoma,sans-serif', 'Segoe UI': "'Segoe UI',sans-serif", 'Courier New': "'Courier New',monospace" };
const pcss = () => {
  const s = S.settings, pw = s.paper_width, w = pw === '58' ? '54mm' : pw === 'A4' ? '180mm' : '76mm', fs = Number(s.rc_font_size) || 12;
  return `<style>@page{margin:${pw === 'A4' ? '14mm' : '0'}}body{width:${w};font:${fs}px/1.4 ${FONTS[s.rc_font] || FONTS.Consolas};margin:0 auto;padding:4px;color:#000}h1{font-size:${fs + 4}px;text-align:center;margin:2px 0}.c{text-align:center}.r{text-align:right}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}.b{border-top:1px dashed #000;margin:4px 0}.t{font-weight:bold;font-size:${fs + 2}px}img{display:block;margin:0 auto}small{font-size:${Math.max(9, fs - 2)}px}</style>`;
};
function receiptHtml(o) {
  const s = S.settings, on = (k) => s[k] === '1', d = new Date(o.created_at), due = Math.max(0, o.total - o.paid_amount);
  const payLine = o.status === 'held' ? 'OPEN ORDER (not paid yet)' : o.pay_status === 'unpaid' ? 'UNPAID - on customer credit' : o.pay_status === 'partial' ? `PARTIAL - paid ${Math.round(o.paid_amount)}, due ${Math.round(due)}` : `PAID IN FULL${o.payment ? ' - ' + o.payment.toUpperCase() : ''}`;
  return `<html><head><meta charset="utf-8">${pcss()}</head><body>
  ${on('rc_show_logo') && s.logo ? `<img src="${s.logo}" style="width:${Number(s.rc_logo_w) || 60}px">` : ''}<h1>${esc(s.name)}</h1><div class="c">${esc(s.tagline)}${s.address ? '<br>' + esc(s.address) : ''}${s.phone ? '<br>' + esc(s.phone) : ''}${on('rc_show_ntn') && s.ntn ? `<br>NTN: ${esc(s.ntn)}` : ''}</div><div class="b"></div>
  <table><tr><td>Order #${o.id}</td><td class="r">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td></tr>
  <tr><td>${esc(o.type.toUpperCase())}${o.table_no ? ' - Table ' + esc(o.table_no) : ''}</td><td class="r">Cashier: ${esc(o.user_name)}</td></tr>
  ${on('rc_show_customer') && (o.customer || o.phone) ? `<tr><td colspan="2">${esc(o.customer)} ${esc(o.phone)}</td></tr>` : ''}${o.address ? `<tr><td colspan="2">${esc(o.address)}</td></tr>` : ''}${o.rider_name ? `<tr><td colspan="2">Rider: ${esc(o.rider_name)}</td></tr>` : ''}</table><div class="b"></div>
  <table><tr><td><b>Item</b></td><td class="r"><b>Amount</b></td></tr>${o.items.map((i) => `<tr><td>${i.qty} x ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} @${Math.round(i.price)}${on('rc_show_notes') && i.note ? '<br>&nbsp;&nbsp;* ' + esc(i.note) : ''}</td><td class="r">${Math.round(i.price * i.qty)}</td></tr>`).join('')}</table><div class="b"></div>
  <table><tr><td>Subtotal</td><td class="r">${Math.round(o.subtotal)}</td></tr>
  ${on('rc_show_discount') && o.discount ? `<tr><td>Discount${o.loyalty ? ' (incl. loyalty)' : ''}</td><td class="r">-${Math.round(o.discount)}</td></tr>` : ''}${on('rc_show_service') && o.service ? `<tr><td>Service</td><td class="r">${Math.round(o.service)}</td></tr>` : ''}
  ${on('rc_show_tax') && o.tax ? `<tr><td>${esc(s.tax_label)} (${s.tax_percent}%)</td><td class="r">${Math.round(o.tax)}</td></tr>` : ''}${o.delivery ? `<tr><td>Delivery charges</td><td class="r">${Math.round(o.delivery)}</td></tr>` : ''}
  <tr class="t"><td>TOTAL</td><td class="r">${s.currency} ${Math.round(o.total)}</td></tr></table>
  <div class="b"></div><div class="c"><b>${esc(payLine)}</b></div>
  ${on('rc_show_cash') && o.payment === 'cash' && o.received > 0 ? `<table><tr><td>Cash received</td><td class="r">${Math.round(o.received)}</td></tr>${o.received > o.paid_now ? `<tr><td>Change</td><td class="r">${Math.round(o.received - o.paid_now)}</td></tr>` : ''}</table>` : ''}
  <div class="b"></div>${s.rc_terms ? `<div class="c"><small>${esc(s.rc_terms).replace(/\n/g, '<br>')}</small></div>` : ''}<div class="c">${esc(s.receipt_footer)}</div>${on('rc_credit') ? '<div class="c"><small>Powered by Cafe POS</small></div>' : ''}</body></html>`;
}
function kotHtml(o) {
  const items = o.items.filter((i) => i.kitchen !== 0); const d = new Date(o.created_at);
  return `<html><head><meta charset="utf-8">${pcss()}</head><body><h1>KITCHEN ORDER</h1><div class="c t">${esc(o.type.toUpperCase())}${o.table_no ? ' - TABLE ' + esc(o.table_no) : ''}</div>
  <div class="c">Order #${o.id} - ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${o.user_name ? ' - ' + esc(o.user_name) : ''}${o.customer ? '<br>Client: ' + esc(o.customer) : ''}</div><div class="b"></div>
  ${o.note ? `<div class="t">NOTE: ${esc(o.note)}</div><div class="b"></div>` : ''}
  <table>${items.map((i, k) => `<tr class="t"><td>${k + 1}. ${i.qty} x ${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''}${i.note ? '<br><small>* ' + esc(i.note) + '</small>' : ''}</td></tr>`).join('')}</table><div class="b"></div></body></html>`;
}
const printReceipt = (o) => window.pos.print(receiptHtml(o), S.settings.silent_print === '1');
const printKot = (o) => window.pos.print(kotHtml(o), S.settings.silent_print === '1');

// ================= ORDERS =================
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const OF = { from: null, to: null, type: '', pay: '', q: '' };
const kLabel = (o) => (o.status === 'void' ? 'cancelled' : o.kstatus);
async function viewOrders() {
  OF.from = OF.from || todayStr(); OF.to = OF.to || OF.from;
  const list = await api('listOrders', { from: OF.from, to: OF.to, type: OF.type || undefined, pay_status: OF.pay || undefined, q: OF.q || undefined });
  const done = list.filter((o) => o.status === 'paid');
  const st = { n: list.length, rev: done.reduce((a, o) => a + o.total, 0), paid: done.filter((o) => o.pay_status === 'paid').length, unpaid: done.filter((o) => o.pay_status !== 'paid').length, open: list.filter((o) => o.status === 'held').length, void: list.filter((o) => o.status === 'void').length };
  const opt = (v, cur, l) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Orders</h2></div>
  <div class="grid g4"><div class="card stat"><div class="l">Total orders</div><div class="v">${st.n}</div></div><div class="card stat"><div class="l">Revenue (completed)</div><div class="v">${money(st.rev)}</div></div><div class="card stat"><div class="l">Paid / Unpaid-partial</div><div class="v">${st.paid} / ${st.unpaid}</div></div><div class="card stat"><div class="l">Open / Cancelled</div><div class="v">${st.open} / ${st.void}</div></div></div>
  <div class="card" style="margin-top:12px"><div class="row2" style="margin-bottom:10px;align-items:end"><div><label>From</label><input type="date" value="${OF.from}" data-chg="ofFrom"></div><div><label>To</label><input type="date" value="${OF.to}" data-chg="ofTo"></div>
  <div><label>Order type</label><select data-chg="ofType">${opt('', OF.type, 'All types')}${opt('dine-in', OF.type, 'Dine-in')}${opt('takeaway', OF.type, 'Takeaway')}${opt('delivery', OF.type, 'Delivery')}</select></div>
  <div><label>Payment status</label><select data-chg="ofPay">${opt('', OF.pay, 'All')}${opt('paid', OF.pay, 'Paid')}${opt('unpaid', OF.pay, 'Unpaid')}${opt('partial', OF.pay, 'Partial')}</select></div>
  <div><label>Search (order #, name, phone, table)</label><input value="${esc(OF.q)}" data-chg="ofQ" placeholder="type and press Enter"></div></div>
  <table><tr><th>#</th><th>Time</th><th>Type</th><th>Table / Customer</th><th>Staff</th><th>Payment</th><th class="r">Total</th><th>Status</th><th></th></tr>
  ${list.map((o) => `<tr><td>${o.id}</td><td>${o.day.slice(5)} ${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>${o.type}</td><td>${esc(o.table_no || o.customer)}</td><td>${esc(o.user_name)}</td>
  <td>${o.status === 'paid' ? `<span class="badge ${o.pay_status === 'paid' ? 'paid' : 'held'}">${o.pay_status}</span> ${esc(o.payment)}` : ''}</td><td class="r">${money(o.total)}</td>
  <td>${o.status === 'held' ? '<span class="badge held">open</span> ' : ''}<span class="badge ${kLabel(o) === 'cancelled' ? 'void' : o.kstatus}">${kLabel(o)}</span></td>
  <td style="white-space:nowrap"><button class="sm" data-act="viewOrder" data-id="${o.id}">View</button> ${o.status !== 'void' ? `<button class="sm" data-act="editOrder" data-id="${o.id}">Edit</button>` : ''} <button class="sm" data-act="reprint" data-id="${o.id}">Print</button> <button class="sm" data-act="orderPdf" data-id="${o.id}">PDF</button></td></tr>`).join('') || '<tr><td colspan="9" class="mut">No orders for these filters</td></tr>'}</table></div></div>`;
}
A.ofFrom = (v) => { OF.from = v; if (OF.to < v) OF.to = v; viewOrders(); }; A.ofTo = (v) => { OF.to = v; viewOrders(); };
A.ofType = (v) => { OF.type = v; viewOrders(); }; A.ofPay = (v) => { OF.pay = v; viewOrders(); }; A.ofQ = (v) => { OF.q = v; viewOrders(); };
A.viewOrder = async (d) => {
  const o = await api('getOrder', Number(d.id));
  const free = S.tables.filter((t) => t.status === 'available' && !t.occupied);
  openModal(`<h3>Order #${o.id} <span class="badge ${o.status}">${o.status === 'void' ? 'cancelled' : o.status === 'held' ? 'open' : 'completed'}</span></h3>
  <div style="background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px"><iframe style="border:0;width:330px;height:400px" srcdoc="${esc(receiptHtml(o))}"></iframe></div>
  ${o.note ? `<div style="margin-top:8px;color:#b45309"><b>Kitchen note:</b> ${esc(o.note)}</div>` : ''}
  ${o.status === 'held' && o.type === 'dine-in' && can('orders') ? `<div class="row2" style="margin-top:10px;align-items:end"><div><label>Move this order to another table</label><select id="xtab"><option value="">Select free table</option>${free.map((t) => `<option>${esc(t.name)}</option>`).join('')}</select></div><div style="flex:none"><button data-act="doTransfer" data-id="${o.id}">Move table</button></div></div>` : ''}
  ${(o.status === 'paid' || o.status === 'held') && (can('orders') || can('kitchen')) ? `<div class="chips" style="margin-top:10px"><span class="mut" style="align-self:center">Kitchen status:</span>${['pending', 'preparing', 'ready', 'completed'].map((k) => `<button class="sm ${o.kstatus === k ? 'on' : ''}" data-act="kstat" data-id="${o.id}" data-s="${k}">${k}</button>`).join('')}</div>` : ''}
  <div class="foot"><button data-act="close">Close</button><button data-act="reprint" data-id="${o.id}">Print bill</button><button data-act="orderPdf" data-id="${o.id}">Download PDF</button><button data-act="reprintKot" data-id="${o.id}">Print KOT</button>${o.status === 'paid' && can('void') ? `<button class="bad" data-act="voidAsk" data-id="${o.id}">Cancel / Void</button>` : ''}</div>`);
};
A.reprint = async (d) => printReceipt(await api('getOrder', Number(d.id)));
A.reprintKot = async (d) => printKot(await api('getOrder', Number(d.id)));
A.orderPdf = async (d) => { const o = await api('getOrder', Number(d.id)); const p = await window.pos.export('orders', 'pdf', 'order-' + o.id, receiptHtml(o)); if (p) toast('Saved: ' + p); };
A.editOrder = async (d) => {
  const o = await api('getOrder', Number(d.id));
  if (!can('pos')) return toast('You need POS access to edit orders', true);
  if (o.status === 'paid') {
    if (!can('void')) return toast('Only a manager/admin can edit a completed order', true);
    if (!confirm('This reopens the order so you can change items or customer, then pay again (a new receipt is printed). Continue?')) return;
    await api('reopenOrder', o.id);
  }
  await A.recall({ id: o.id });
};
A.doTransfer = async (d) => { if (!val('xtab')) return toast('Select a table', true); await api('transferTable', Number(d.id), val('xtab')); S.tables = await api('listTables'); toast('Order moved to table ' + val('xtab')); await viewOrders(); await A.viewOrder(d); };
A.kstat = async (d) => { await api('setKitchenStatus', Number(d.id), d.s); await viewOrders(); await A.viewOrder(d); };
A.voidAsk = (d) => {
  openModal(`<h3>Cancel order #${d.id}</h3><label>Reason</label><input id="vreason" placeholder="Reason">
  <div class="foot"><button data-act="close">Back</button><button class="bad" data-act="voidDo" data-id="${d.id}">Cancel order</button></div>`);
};
A.voidDo = async (d) => { await api('voidOrder', Number(d.id), '', val('vreason')); closeModal(); toast('Order cancelled'); viewOrders(); };

(async () => {
  try {
    S.settings = await api('getSettings');
    const u = await window.pos.session();
    if (u) { S.user = u; await loadAll(); S.view = firstView(); }
  } catch (e) { /* show login */ }
  render();
})();
