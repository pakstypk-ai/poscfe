'use strict';
// ---------- shared helpers: exports ----------
const csvCell = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const htmlTable = (head, rows, right = []) => `<table><tr>${head.map((h, i) => `<th class="${right.includes(i) ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${right.includes(i) ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}">No data</td></tr>`}</table>`;
const pdfDoc = (title, sub, body) => `<html><head><meta charset="utf-8"><style>body{font:12px 'Segoe UI',Arial,sans-serif;color:#111;margin:0}h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}th{background:#f3f4f6}.r{text-align:right}.k{display:inline-block;border:1px solid #ddd;border-radius:8px;padding:8px 14px;margin:4px 6px 4px 0}.k b{display:block;font-size:16px}</style></head><body><h1>${esc(S.settings.name)}</h1><div style="color:#555;margin-bottom:8px">${esc(title)} - ${esc(sub)}</div>${body}</body></html>`;
async function exportTable(scope, kind, name, title, head, rows, right = []) {
  const content = kind === 'csv' ? toCsv([head, ...rows]) : kind === 'json' ? JSON.stringify(rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))), null, 2) : pdfDoc(title, new Date().toLocaleDateString(), htmlTable(head, rows, right));
  const p = await window.pos.export(scope, kind, name, content); if (p) toast('Saved: ' + p);
}
const exportBtns = (act) => `<button data-act="${act}" data-k="pdf">PDF</button><button data-act="${act}" data-k="csv">Excel / CSV</button>`;
const RP_MONTH = () => { const t = new Date(); return fmtDay(new Date(t.getFullYear(), t.getMonth(), 1)); };

// ================= CUSTOMERS (CRM) + KHATA =================
let CUST = [], KH = true;
async function viewCustomers(khata) {
  KH = khata; CUST = await api('listCustomers');
  const due = CUST.reduce((a, c) => a + c.balance, 0);
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>${khata ? 'Customer credit (Khata)' : 'Customers'}</h2>${!khata ? exportBtns('custExport') : ''}<button class="pri" data-act="editCust" data-id="0">+ Add customer</button></div>
  ${khata ? `<div class="grid g3" style="margin-bottom:12px"><div class="card stat"><div class="l">Total credit to collect</div><div class="v">${money(due)}</div></div><div class="card stat"><div class="l">Customers with credit</div><div class="v">${CUST.filter((c) => c.balance > 0).length}</div></div><div class="card stat"><div class="l">Credit-enabled customers</div><div class="v">${CUST.filter((c) => c.credit_limit > 0).length}</div></div></div>` : `<div class="mut" style="margin-bottom:10px">Customers are saved automatically when you enter their name and phone on an order. Use this list for marketing and loyalty (set the discount rules in Settings).</div>`}
  <div class="card"><div style="margin-bottom:8px"><input id="csearch" placeholder="Search name or phone" data-in="custSearch" style="max-width:300px"></div><div id="ctable"></div></div></div>`;
  drawCust();
}
function drawCust() {
  const list = KH ? CUST.filter((c) => c.balance > 0 || c.credit_limit > 0) : CUST;
  const q = (val('csearch') || '').toLowerCase();
  const rows = list.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
  $('#ctable').innerHTML = `<table><tr><th>Customer</th><th>Phone</th><th class="r">Orders (month / total)</th><th class="r">Spent</th><th class="r">Credit due</th><th class="r">Limit</th><th></th></tr>${rows.map((c) => `<tr><td><b>${esc(c.name)}</b>${c.email ? `<div class="mut" style="font-size:12px">${esc(c.email)}</div>` : ''}</td><td>${esc(c.phone)}</td><td class="r">${c.month_orders} / ${c.total_orders}</td><td class="r">${money(c.spent)}</td><td class="r" style="${c.balance > 0 ? 'color:var(--bad);font-weight:700' : ''}">${money(c.balance)}</td><td class="r">${c.credit_limit ? money(c.credit_limit) : '-'}</td>
  <td style="white-space:nowrap">${can('khata') && c.balance > 0 ? `<button class="sm ok" data-act="payCust" data-id="${c.id}">Record payment</button> ` : ''}<button class="sm" data-act="custLedger" data-id="${c.id}">Ledger</button> <button class="sm" data-act="editCust" data-id="${c.id}">Edit</button></td></tr>`).join('') || '<tr><td class="mut" colspan="7">No customers yet</td></tr>'}</table>`;
}
A.custSearch = () => drawCust();
A.editCust = (d) => {
  const c = CUST.find((x) => x.id === Number(d.id)) || { id: 0, name: '', phone: '', email: '', address: '', notes: '', credit_limit: 0 };
  openModal(`<h3>${c.id ? 'Edit' : 'Add'} customer</h3><div class="row2"><div><label>Name</label><input id="cn" value="${esc(c.name)}"></div><div><label>Phone</label><input id="cp" value="${esc(c.phone)}"></div></div>
  <div class="row2"><div><label>Email</label><input id="ce" value="${esc(c.email)}"></div><div><label>Credit limit (0 = no limit set)</label><input id="cl" type="number" value="${c.credit_limit || 0}"></div></div><label>Address</label><input id="ca" value="${esc(c.address)}"><label>Notes</label><input id="cno" value="${esc(c.notes)}">
  <div class="foot">${c.id && can('customers') ? `<button class="bad" data-act="delCust" data-id="${c.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveCust" data-id="${c.id}">Save</button></div>`);
};
A.saveCust = async (d) => { await api('saveCustomer', { id: Number(d.id) || undefined, name: val('cn'), phone: val('cp'), email: val('ce'), credit_limit: val('cl'), address: val('ca'), notes: val('cno') }); closeModal(); toast('Customer saved'); viewCustomers(KH); };
A.delCust = async (d) => { if (!confirm('Delete this customer?')) return; await api('deleteCustomer', Number(d.id)); closeModal(); viewCustomers(KH); };
A.payCust = (d) => {
  const c = CUST.find((x) => x.id === Number(d.id));
  openModal(`<h3>Record payment - ${esc(c.name)}</h3><div class="mut">Currently owes <b>${money(c.balance)}</b></div><label>Amount received</label><input id="kpa" type="number" value="${Math.round(c.balance)}">
  <label>Method</label><select id="kpm"><option>cash</option><option>card</option><option>online</option></select><label>Note</label><input id="kpn"><div class="foot"><button data-act="close">Cancel</button><button class="ok" data-act="savePay" data-id="${c.id}">Save payment</button></div>`);
};
A.savePay = async (d) => { await api('addCustomerPayment', { customer_id: Number(d.id), amount: val('kpa'), method: val('kpm'), note: val('kpn') }); closeModal(); toast('Payment recorded'); viewCustomers(KH); };
A.custLedger = async (d) => {
  const L = await api('customerLedger', Number(d.id)), c = L.customer;
  openModal(`<h3>${esc(c.name)} - ledger</h3><div class="mut">${esc(c.phone)} - owes <b style="color:var(--bad)">${money(c.balance)}</b>${c.credit_limit ? ' (limit ' + money(c.credit_limit) + ')' : ''}</div>
  <h4 style="margin:10px 0 4px">Orders</h4><div style="max-height:200px;overflow:auto"><table><tr><th>#</th><th>Date</th><th class="r">Total</th><th class="r">Paid</th><th>Status</th></tr>${L.orders.map((o) => `<tr><td>${o.id}</td><td>${o.day}</td><td class="r">${money(o.total)}</td><td class="r">${money(o.paid_amount)}</td><td><span class="badge ${o.pay_status === 'paid' ? 'paid' : 'held'}">${o.pay_status}</span></td></tr>`).join('') || '<tr><td class="mut" colspan="5">No orders</td></tr>'}</table></div>
  <h4 style="margin:10px 0 4px">Payments received</h4><div style="max-height:160px;overflow:auto"><table><tr><th>Date</th><th>Method</th><th>By</th><th class="r">Amount</th></tr>${L.payments.map((p) => `<tr><td>${p.day}</td><td>${p.method}</td><td>${esc(p.user_name)}</td><td class="r">${money(p.amount)}</td></tr>`).join('') || '<tr><td class="mut" colspan="4">No payments</td></tr>'}</table></div><div class="foot"><button data-act="close">Close</button></div>`);
};
A.custExport = (d) => exportTable('customers', d.k, 'customers-marketing-list', 'Customer marketing list', ['Name', 'Phone', 'Email', 'Address', 'Orders this month', 'Total orders', 'Total spent', 'Last order'], CUST.map((c) => [c.name, c.phone, c.email, c.address, c.month_orders, c.total_orders, Math.round(c.spent), c.last_order ? c.last_order.slice(0, 10) : '']), [4, 5, 6]);

// ================= INVENTORY (raw materials) =================
let MATS = [];
async function viewInventory() {
  MATS = await api('listMaterials');
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Inventory - raw materials</h2>${exportBtns('matExport')}<button class="pri" data-act="editMat" data-id="0">+ Add material</button></div>
  <div class="mut" style="margin-bottom:10px">Track ingredients and packing. Buy stock from a supplier in <b>Suppliers</b> and the quantity is added here automatically. Menu items with "track stock" are managed in Menu.</div>
  <div class="card"><table><tr><th>Material</th><th class="r">In stock</th><th class="r">Minimum</th><th class="r">Last cost / unit</th><th class="r">Stock value</th><th></th></tr>${MATS.map((m) => `<tr><td><b>${esc(m.name)}</b> ${m.min_stock > 0 && m.stock <= m.min_stock ? '<span class="badge bad">LOW</span>' : ''}</td><td class="r">${m.stock} ${esc(m.unit)}</td><td class="r">${m.min_stock} ${esc(m.unit)}</td><td class="r">${money(m.cost)}</td><td class="r">${money(m.stock * m.cost)}</td>
  <td style="white-space:nowrap"><button class="sm" data-act="adjMat" data-id="${m.id}">+ / - Stock</button> <button class="sm" data-act="editMat" data-id="${m.id}">Edit</button></td></tr>`).join('') || '<tr><td class="mut" colspan="6">No materials yet</td></tr>'}</table></div></div>`;
}
A.editMat = (d) => {
  const m = MATS.find((x) => x.id === Number(d.id)) || { id: 0, name: '', unit: 'kg', stock: 0, min_stock: 0, cost: 0 };
  openModal(`<h3>${m.id ? 'Edit' : 'Add'} material</h3><div class="row2"><div><label>Name</label><input id="mn" value="${esc(m.name)}"></div><div><label>Unit (kg, litre, pcs)</label><input id="mu" value="${esc(m.unit)}"></div></div>
  <div class="row2">${m.id ? '' : `<div><label>Opening stock</label><input id="ms" type="number" value="0"></div>`}<div><label>Minimum stock (low alert)</label><input id="mm" type="number" value="${m.min_stock}"></div><div><label>Cost per unit</label><input id="mc" type="number" value="${m.cost}"></div></div>
  <div class="foot">${m.id ? `<button class="bad" data-act="delMat" data-id="${m.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveMat" data-id="${m.id}">Save</button></div>`);
};
A.saveMat = async (d) => { await api('saveMaterial', { id: Number(d.id) || undefined, name: val('mn'), unit: val('mu'), stock: val('ms'), min_stock: val('mm'), cost: val('mc') }); closeModal(); viewInventory(); };
A.delMat = async (d) => { if (!confirm('Delete this material?')) return; await api('deleteMaterial', Number(d.id)); closeModal(); viewInventory(); };
A.adjMat = (d) => { const m = MATS.find((x) => x.id === Number(d.id)); openModal(`<h3>Adjust stock - ${esc(m.name)}</h3><div class="mut">Now: ${m.stock} ${esc(m.unit)}</div><label>Change (use minus to remove, e.g. -2 for wastage)</label><input id="ma" type="number" step="any"><label>Reason</label><input id="mr" placeholder="e.g. used, wastage, count correction"><div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="saveAdj" data-id="${m.id}">Save</button></div>`); };
A.saveAdj = async (d) => { await api('adjustMaterial', Number(d.id), Number(val('ma')), val('mr')); closeModal(); viewInventory(); };
A.matExport = (d) => exportTable('inventory', d.k, 'inventory', 'Raw material stock', ['Material', 'Unit', 'Stock', 'Minimum', 'Cost per unit', 'Value'], MATS.map((m) => [m.name, m.unit, m.stock, m.min_stock, m.cost, Math.round(m.stock * m.cost)]), [2, 3, 4, 5]);

// ================= SUPPLIERS + LEDGER =================
let SUP = [];
async function viewSuppliers() {
  SUP = await api('listSuppliers');
  const due = SUP.reduce((a, s) => a + Math.max(0, s.balance), 0);
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Suppliers</h2>${exportBtns('supExport')}<button class="pri" data-act="editSup" data-id="0">+ Add supplier</button></div>
  <div class="grid g3" style="margin-bottom:12px"><div class="card stat"><div class="l">Total payable to suppliers</div><div class="v">${money(due)}</div></div><div class="card stat"><div class="l">Total purchases</div><div class="v">${money(SUP.reduce((a, s) => a + s.purchases, 0))}</div></div><div class="card stat"><div class="l">Total paid</div><div class="v">${money(SUP.reduce((a, s) => a + s.payments, 0))}</div></div></div>
  <div class="card"><table><tr><th>Supplier</th><th>Phone</th><th class="r">Purchases</th><th class="r">Paid</th><th class="r">Remaining</th><th></th></tr>${SUP.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.phone)}</td><td class="r">${money(s.purchases)}</td><td class="r">${money(s.payments)}</td><td class="r" style="${s.balance > 0 ? 'color:var(--bad);font-weight:700' : ''}">${money(s.balance)}</td>
  <td style="white-space:nowrap"><button class="sm" data-act="supLedger" data-id="${s.id}">Ledger</button> <button class="sm" data-act="editSup" data-id="${s.id}">Edit</button></td></tr>`).join('') || '<tr><td class="mut" colspan="6">No suppliers yet</td></tr>'}</table></div></div>`;
}
A.editSup = (d) => { const s = SUP.find((x) => x.id === Number(d.id)) || { id: 0, name: '', phone: '', address: '', notes: '' };
  openModal(`<h3>${s.id ? 'Edit' : 'Add'} supplier</h3><div class="row2"><div><label>Name</label><input id="sn" value="${esc(s.name)}"></div><div><label>Phone</label><input id="sp" value="${esc(s.phone)}"></div></div><label>Address</label><input id="sa" value="${esc(s.address)}"><label>Notes</label><input id="sno" value="${esc(s.notes)}">
  <div class="foot">${s.id ? `<button class="bad" data-act="delSup" data-id="${s.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveSup" data-id="${s.id}">Save</button></div>`); };
A.saveSup = async (d) => { await api('saveSupplier', { id: Number(d.id) || undefined, name: val('sn'), phone: val('sp'), address: val('sa'), notes: val('sno') }); closeModal(); viewSuppliers(); };
A.delSup = async (d) => { if (!confirm('Delete this supplier and its ledger?')) return; await api('deleteSupplier', Number(d.id)); closeModal(); viewSuppliers(); };
let SUPL = null;
A.supLedger = async (d) => {
  SUPL = await api('supplierLedger', Number(d.id)); if (can(['inventory', 'suppliers'])) MATS = await api('listMaterials');
  const s = SUPL.supplier;
  openModal(`<h3>${esc(s.name)} - ledger</h3><div class="grid g3" style="margin-bottom:8px"><div class="card stat"><div class="l">Purchases</div><div class="v">${money(s.purchases)}</div></div><div class="card stat"><div class="l">Paid</div><div class="v">${money(s.payments)}</div></div><div class="card stat"><div class="l">Remaining</div><div class="v" style="color:var(--bad)">${money(s.balance)}</div></div></div>
  <div class="chips" style="margin-bottom:8px"><button class="pri" data-act="supPurchase" data-id="${s.id}">+ Add purchase</button><button class="ok" data-act="supPay" data-id="${s.id}">Pay supplier</button></div>
  <div style="max-height:280px;overflow:auto"><table><tr><th>Date</th><th>Type</th><th>Details</th><th class="r">Amount</th></tr>${SUPL.entries.map((e) => `<tr><td>${e.day}</td><td><span class="badge ${e.type === 'payment' ? 'paid' : 'held'}">${e.type}</span></td><td>${esc(e.material ? e.qty + ' x ' + e.material : '')} ${esc(e.note)}</td><td class="r">${money(e.amount)}</td></tr>`).join('') || '<tr><td class="mut" colspan="4">No entries</td></tr>'}</table></div><div class="foot"><button data-act="close">Close</button></div>`);
};
A.supPurchase = (d) => openModal(`<h3>Add purchase</h3><label>Total bill amount</label><input id="pa" type="number"><div class="row2"><div><label>Material bought (optional)</label><select id="pm_"><option value="">- none -</option>${MATS.map((m) => `<option value="${m.id}">${esc(m.name)} (${esc(m.unit)})</option>`).join('')}</select></div><div><label>Quantity</label><input id="pq" type="number" step="any"></div></div>
  <label>Paid now (optional)</label><input id="pp" type="number" value="0"><label>Note / bill no.</label><input id="pn"><div class="foot"><button data-act="close">Cancel</button><button class="pri" data-act="savePurchase" data-id="${d.id}">Save purchase</button></div>`);
A.savePurchase = async (d) => { await api('addSupplierEntry', { supplier_id: Number(d.id), type: 'purchase', amount: val('pa'), material_id: Number(val('pm_')) || null, qty: val('pq'), paid: val('pp'), note: val('pn') }); toast('Purchase added'); await viewSuppliers(); A.supLedger(d); };
A.supPay = (d) => openModal(`<h3>Pay supplier</h3><label>Amount</label><input id="pa" type="number"><label>Note</label><input id="pn"><div class="foot"><button data-act="close">Cancel</button><button class="ok" data-act="savePaySup" data-id="${d.id}">Save payment</button></div>`);
A.savePaySup = async (d) => { await api('addSupplierEntry', { supplier_id: Number(d.id), type: 'payment', amount: val('pa'), note: val('pn') }); toast('Payment recorded'); await viewSuppliers(); A.supLedger(d); };
A.supExport = (d) => exportTable('suppliers', d.k, 'suppliers-ledger', 'Supplier balances', ['Supplier', 'Phone', 'Purchases', 'Paid', 'Remaining'], SUP.map((s) => [s.name, s.phone, Math.round(s.purchases), Math.round(s.payments), Math.round(s.balance)]), [2, 3, 4]);

// ================= PAYMENTS REGISTER =================
let pFrom = null, pTo = null;
async function viewPayments() {
  pFrom = pFrom || RP_MONTH(); pTo = pTo || todayStr();
  const [rows, pend] = await Promise.all([api('listPayouts', { from: pFrom, to: pTo }), api('pendingPayments')]);
  window._pay = rows;
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Payments register</h2><input type="date" value="${pFrom}" data-chg="payFrom" style="width:150px"><input type="date" value="${pTo}" data-chg="payTo" style="width:150px">${exportBtns('payExport')}</div>
  <div class="mut" style="margin-bottom:8px">Write down every payment you make to anyone, so you always know who was paid what. This register does not change your profit (use Expenses for that).</div>
  <div class="grid g2"><div class="card"><b>Pending payments</b><table>${pend.suppliers.map((s) => `<tr><td>Supplier: ${esc(s.name)}</td><td class="r" style="color:var(--bad)">${money(s.balance)}</td></tr>`).join('') || '<tr><td class="mut">No supplier dues</td><td></td></tr>'}<tr><td>Customer credit to collect</td><td class="r">${money(pend.customers)}</td></tr></table></div>
  <div class="card"><b>Add payment</b><div class="row2"><div><label>Paid to</label><input id="ypn" placeholder="Name"></div><div><label>Amount</label><input id="ypa" type="number"></div></div><div class="row2"><div><label>Method</label><select id="ypm"><option>cash</option><option>card</option><option>online</option></select></div><div><label>For what</label><input id="ypp" placeholder="e.g. electrician, rent advance"></div></div><button class="pri" style="margin-top:10px" data-act="addPayout">Save</button></div></div>
  <div class="card" style="margin-top:12px"><table><tr><th>Date</th><th>Paid to</th><th>For</th><th>Method</th><th>By</th><th class="r">Amount</th><th></th></tr>${rows.map((p) => `<tr><td>${p.day}</td><td>${esc(p.payee)}</td><td>${esc(p.purpose)}</td><td>${p.method}</td><td>${esc(p.user_name)}</td><td class="r">${money(p.amount)}</td><td class="r"><button class="ghost sm" data-act="delPayout" data-id="${p.id}">X</button></td></tr>`).join('') || '<tr><td class="mut" colspan="7">No payments in this period</td></tr>'}<tr><th colspan="5">Total</th><th class="r">${money(rows.reduce((a, p) => a + p.amount, 0))}</th><th></th></tr></table></div></div>`;
}
A.payFrom = (v) => { pFrom = v; viewPayments(); }; A.payTo = (v) => { pTo = v; viewPayments(); };
A.addPayout = async () => { await api('addPayout', { payee: val('ypn'), amount: val('ypa'), method: val('ypm'), purpose: val('ypp') }); toast('Payment saved'); viewPayments(); };
A.delPayout = async (d) => { await api('deletePayout', Number(d.id)); viewPayments(); };
A.payExport = (d) => exportTable('payments', d.k, 'payments-register', 'Payments register', ['Date', 'Paid to', 'For', 'Method', 'By', 'Amount'], window._pay.map((p) => [p.day, p.payee, p.purpose, p.method, p.user_name, Math.round(p.amount)]), [5]);

// ================= DELIVERY + RIDERS =================
let DV = { tab: 'orders', day: null, from: null, to: null, rider: 0 };
const dsLabel = { '': 'not assigned', assigned: 'assigned', out: 'on the way', delivered: 'delivered' };
async function viewDelivery() {
  DV.day = DV.day || todayStr(); DV.from = DV.from || RP_MONTH(); DV.to = DV.to || todayStr();
  const manager = S.user.role !== 'rider';
  const tabs = manager ? [['orders', 'Delivery orders'], ['riders', 'Riders'], ['report', 'Rider report']] : [['orders', 'My deliveries']];
  if (!manager) DV.tab = 'orders';
  let body = '';
  if (DV.tab === 'orders') {
    const [list, riders] = await Promise.all([api('listDeliveries', { day: manager ? DV.day : undefined }), manager ? api('listRiders') : []]);
    body = `<div class="card"><table><tr><th>#</th><th>Customer</th><th>Address</th><th class="r">Total</th><th>Rider</th><th>Status</th><th></th></tr>${list.map((o) => `<tr><td>${o.id}</td><td>${esc(o.customer)}<div class="mut" style="font-size:12px">${esc(o.phone)}</div></td><td>${esc(o.address)}</td><td class="r">${money(o.total)}<div class="mut" style="font-size:12px">${o.status === 'paid' && o.pay_status === 'paid' ? 'paid' : 'collect ' + money(o.total - o.paid_amount)}</div></td>
      <td>${manager ? `<select data-chg="assignRider" data-id="${o.id}" ${o.dstatus === 'delivered' ? 'disabled' : ''}><option value="">- assign -</option>${riders.filter((r) => r.active && (r.status === 'available' || r.id === o.rider_id)).map((r) => `<option value="${r.id}" ${o.rider_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>` : esc(o.rider_name)}</td>
      <td><span class="badge ${o.dstatus === 'delivered' ? 'paid' : o.dstatus ? 'held' : 'pending'}">${dsLabel[o.dstatus]}</span></td>
      <td style="white-space:nowrap">${o.rider_id && o.dstatus === 'assigned' ? `<button class="sm pri" data-act="dstat" data-id="${o.id}" data-s="out">Out for delivery</button>` : ''}${o.rider_id && o.dstatus !== 'delivered' ? ` <button class="sm ok" data-act="dstat" data-id="${o.id}" data-s="delivered">Delivered</button>` : ''}</td></tr>`).join('') || '<tr><td class="mut" colspan="7">No delivery orders</td></tr>'}</table></div>`;
    body = (manager ? `<div class="h"><input type="date" value="${DV.day}" data-chg="dvDay" style="width:160px"></div>` : '') + body;
  } else if (DV.tab === 'riders') {
    const riders = await api('listRiders'), users = (await api('listUsers')).filter((u) => u.role === 'rider');
    window._riders = riders; window._rusers = users;
    body = `<div class="h"><span class="mut">A rider shows "On delivery" from the moment you assign an order until it is marked delivered. Give a rider a login (role Rider in Staff) so they only see their own deliveries.</span><button class="pri" data-act="editRider" data-id="0" style="flex:none">+ Add rider</button></div>
    <div class="staffgrid">${riders.map((r) => `<div class="scard ${r.active ? '' : 'off'}"><div class="top"><div class="avatar">🛵</div><div style="flex:1"><div style="font-weight:700;font-size:16px">${esc(r.name)}</div><div class="mut">${esc(r.vehicle) || 'No vehicle noted'}</div></div><span class="badge ${r.status === 'available' ? 'available' : r.status === 'on-delivery' ? 'held' : 'off'}">${r.status === 'on-delivery' ? 'On delivery' : r.status}</span></div>
      <div class="meta"><span>Phone</span><span>${esc(r.phone) || '-'}</span><span>Login</span><span>${r.username ? '@' + esc(r.username) : 'none'}</span><span>Fee / delivery</span><span>${r.fee > 0 ? money(r.fee) : money(S.settings.delivery_fee) + ' (default)'}</span><span>Delivered today</span><span>${r.delivered_today}</span></div><div class="btns"><button class="sm" data-act="editRider" data-id="${r.id}">Edit</button></div></div>`).join('') || '<div class="card mut">No riders yet</div>'}</div>`;
  } else {
    const riders = await api('listRiders'); if (!DV.rider && riders[0]) DV.rider = riders[0].id;
    const rep = DV.rider ? await api('riderDetail', DV.rider, DV.from, DV.to) : null; window._rdet = rep;
    body = `<div class="h"><select data-chg="dvRider" style="width:220px">${riders.map((r) => `<option value="${r.id}" ${DV.rider === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><input type="date" value="${DV.from}" data-chg="dvFrom" style="width:150px"><input type="date" value="${DV.to}" data-chg="dvTo" style="width:150px"><span style="flex:1"></span>${rep ? exportBtns('rdExport') : ''}</div>
    ${rep ? `<div class="grid g4" style="margin-bottom:12px"><div class="card stat"><div class="l">Rider</div><div class="v" style="font-size:18px">${esc(rep.rider.name)}</div><div class="mut">${esc(rep.rider.vehicle)}</div></div><div class="card stat"><div class="l">Total deliveries</div><div class="v">${rep.count}</div></div><div class="card stat"><div class="l">Charge per delivery</div><div class="v">${money(rep.fee)}</div></div><div class="card stat"><div class="l">Total earnings</div><div class="v">${money(rep.earnings)}</div></div></div>
    <div class="card"><table><tr><th>Order</th><th>Date</th><th>Customer</th><th>Area / address</th><th class="r">Charge</th></tr>${rep.rows.map((o) => `<tr><td>#${o.id}</td><td>${o.day}</td><td>${esc(o.customer)}</td><td>${esc(o.address)}</td><td class="r">${money(rep.fee)}</td></tr>`).join('') || '<tr><td class="mut" colspan="5">No deliveries in this period</td></tr>'}</table></div>` : '<div class="card mut">Add a rider first</div>'}`;
  }
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Delivery</h2><div class="chips">${tabs.map(([k, l]) => `<button class="${DV.tab === k ? 'on' : ''}" data-act="dvTab" data-t="${k}">${l}</button>`).join('')}</div></div>${body}</div>`;
}
A.dvTab = (d) => { DV.tab = d.t; viewDelivery(); };
A.dvDay = (v) => { DV.day = v; viewDelivery(); }; A.dvFrom = (v) => { DV.from = v; viewDelivery(); }; A.dvTo = (v) => { DV.to = v; viewDelivery(); }; A.dvRider = (v) => { DV.rider = Number(v); viewDelivery(); };
A.assignRider = async (v, el) => { if (!v) return; await api('assignRider', Number(el.dataset.id), Number(v)); toast('Rider assigned'); viewDelivery(); };
A.dstat = async (d) => { await api('setDeliveryStatus', Number(d.id), d.s); viewDelivery(); };
A.editRider = (d) => {
  const r = (window._riders || []).find((x) => x.id === Number(d.id)) || { id: 0, name: '', phone: '', vehicle: '', fee: 0, active: 1, user_id: null };
  openModal(`<h3>${r.id ? 'Edit' : 'Add'} rider</h3><div class="row2"><div><label>Name</label><input id="rn" value="${esc(r.name)}"></div><div><label>Phone</label><input id="rp" value="${esc(r.phone)}"></div></div>
  <div class="row2"><div><label>Vehicle / bike number</label><input id="rv" value="${esc(r.vehicle)}"></div><div><label>Charge per delivery (0 = default ${S.settings.delivery_fee})</label><input id="rf" type="number" value="${r.fee || 0}"></div></div>
  <label>Linked login (create the user in Staff with role Rider first)</label><select id="ru"><option value="">- none -</option>${(window._rusers || []).map((u) => `<option value="${u.id}" ${r.user_id === u.id ? 'selected' : ''}>${esc(u.name)} (@${esc(u.username)})</option>`).join('')}</select>
  <label><input type="checkbox" id="ra" ${r.active ? 'checked' : ''}> Active</label><div class="foot">${r.id ? `<button class="bad" data-act="delRider" data-id="${r.id}">Delete</button>` : ''}<button data-act="close">Cancel</button><button class="pri" data-act="saveRider" data-id="${r.id}">Save</button></div>`);
};
A.saveRider = async (d) => { await api('saveRider', { id: Number(d.id) || undefined, name: val('rn'), phone: val('rp'), vehicle: val('rv'), fee: val('rf'), user_id: Number(val('ru')) || null, active: chk('ra') }); closeModal(); viewDelivery(); };
A.delRider = async (d) => { if (!confirm('Delete this rider?')) return; await api('deleteRider', Number(d.id)); closeModal(); viewDelivery(); };
A.rdExport = (d) => { const r = window._rdet; return exportTable('delivery', d.k, 'rider-' + r.rider.name, `Rider report: ${r.rider.name} (${r.rider.vehicle || 'no vehicle'}) ${r.from} to ${r.to} - ${r.count} deliveries, earnings ${Math.round(r.earnings)}`, ['Order', 'Date', 'Customer', 'Area / address', 'Charge'], r.rows.map((o) => ['#' + o.id, o.day, o.customer, o.address, r.fee]), [4]); };

// ================= RECEIPT DESIGN =================
function sampleOrder() {
  return { id: 1042, type: 'dine-in', table_no: 'T3', customer: 'Sample Customer', phone: '03001234567', address: '', note: 'cheese lover', rider_name: '', user_name: S.user.name, created_at: new Date().toISOString(),
    items: [{ name: 'Zinger Burger', qty: 2, price: 650, note: 'extra cheese', variant: '' }, { name: 'Latte', qty: 1, price: 400, variant: 'Large' }], subtotal: 1700, discount: 100, loyalty: 0, service: 80, tax: 0, delivery: 0, total: 1680, payment: 'cash', received: 2000, paid_now: 1680, paid_amount: 1680, pay_status: 'paid', status: 'paid' };
}
function viewReceipt() {
  const s = S.settings; window._logo = s.logo;
  const f = (id, label, v, type = 'text') => `<div><label>${label}</label><input id="${id}" type="${type}" value="${esc(v)}" data-in="rcLive"></div>`;
  const tg = (id, label, key) => `<label style="color:var(--tx);margin:6px 0"><input type="checkbox" id="${id}" data-chg="rcLive" ${s[key] === '1' ? 'checked' : ''}> ${label}</label>`;
  $('#main').innerHTML = `<div class="page"><div class="h"><h2>Receipt design</h2><button class="pri" data-act="saveReceipt">Save design</button></div>
  <div class="split"><div style="flex:1;min-width:0"><div class="card"><b>Branding</b><div class="row2">${f('r_name', 'Restaurant name', s.name)}${f('r_phone', 'Contact number', s.phone)}</div>${f('r_address', 'Address', s.address)}${f('r_tag', 'Tagline', s.tagline)}
  <label>Logo</label><div style="display:flex;gap:10px;align-items:center"><img id="logoPrev" ${s.logo ? `src="${s.logo}"` : ''} style="height:46px;max-width:120px;background:#fff;border:1px solid var(--line);border-radius:6px"><input type="file" id="logof" accept="image/*"><button class="sm" data-act="clrLogo">Remove</button></div></div>
  <div class="card" style="margin-top:12px"><b>Layout</b><div class="row2"><div><label>Paper</label><select id="r_paper" data-chg="rcLive">${[['80', '80 mm thermal'], ['58', '58 mm thermal'], ['A4', 'A4 page']].map(([v, l]) => `<option value="${v}" ${s.paper_width === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div><label>Font</label><select id="r_font" data-chg="rcLive">${Object.keys(FONTS).map((k) => `<option ${s.rc_font === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div></div><div class="row2">${f('r_fs', 'Font size (px)', s.rc_font_size, 'number')}${f('r_lw', 'Logo width (px)', s.rc_logo_w, 'number')}</div>
  <label>Footer message</label><input id="r_foot" value="${esc(s.receipt_footer)}" data-in="rcLive"><label>Terms & conditions (printed at the bottom)</label><textarea id="r_terms" rows="3" data-in="rcLive">${esc(s.rc_terms)}</textarea></div>
  <div class="card" style="margin-top:12px"><b>Show / hide on the customer bill</b><div class="permgrid">${tg('t_logo', 'Logo', 'rc_show_logo')}${tg('t_ntn', 'NTN / STRN', 'rc_show_ntn')}${tg('t_tax', 'Tax', 'rc_show_tax')}${tg('t_disc', 'Discount', 'rc_show_discount')}${tg('t_serv', 'Service charge', 'rc_show_service')}${tg('t_cash', 'Cash received / change', 'rc_show_cash')}${tg('t_cust', 'Customer name & phone', 'rc_show_customer')}${tg('t_notes', 'Kitchen notes on item lines', 'rc_show_notes')}${tg('t_credit', 'Software credit line', 'rc_credit')}</div>
  <div class="mut" style="font-size:12px">Order notes always go to the kitchen token only. Item notes are hidden from the bill unless you switch them on here.</div></div></div>
  <div style="width:380px;flex:none"><div class="card" style="position:sticky;top:0"><b>Live preview</b><div style="background:#fff;border:1px solid var(--line);border-radius:8px;margin-top:8px"><iframe id="rcPrev" style="border:0;width:100%;height:560px"></iframe></div></div></div></div></div>`;
  A.rcLive();
}
function rcApply() {
  const m = { name: val('r_name'), phone: val('r_phone'), address: val('r_address'), tagline: val('r_tag'), paper_width: val('r_paper'), rc_font: val('r_font'), rc_font_size: val('r_fs'), rc_logo_w: val('r_lw'), receipt_footer: val('r_foot'), rc_terms: val('r_terms'), logo: window._logo || '' };
  const t = { rc_show_logo: 't_logo', rc_show_ntn: 't_ntn', rc_show_tax: 't_tax', rc_show_discount: 't_disc', rc_show_service: 't_serv', rc_show_cash: 't_cash', rc_show_customer: 't_cust', rc_show_notes: 't_notes', rc_credit: 't_credit' };
  Object.entries(t).forEach(([k, id]) => { m[k] = chk(id) ? '1' : '0'; });
  return m;
}
A.rcLive = () => { const fr = $('#rcPrev'); if (!fr) return; const keep = { ...S.settings }; Object.assign(S.settings, rcApply()); const o = sampleOrder(); if (S.settings.tax_percent > 0) o.tax = 100; fr.srcdoc = receiptHtml(o); S.settings = keep; };
A.clrLogo = () => { window._logo = ''; const p = $('#logoPrev'); if (p) p.removeAttribute('src'); A.rcLive(); };
A.saveReceipt = async () => { const m = rcApply(); S.settings = await api('saveSettings', m); toast('Receipt design saved'); render(); };
document.addEventListener('change', async (e) => { if (e.target.id === 'logof' && e.target.files[0]) { try { window._logo = await fileToThumb(e.target.files[0], 300); const p = $('#logoPrev'); if (p) p.src = window._logo; A.rcLive && A.rcLive(); } catch (err) { toast('Could not read this picture', true); } } });
