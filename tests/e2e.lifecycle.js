// Order lifecycle & customer financial audit (browser, real app, real storage).
// Customers of every kind → orders with real catalogue prices → ready / delivered → full, partial, later, unpaid,
// overpaid and order-allocated payments → cancellations and refunds → arrears per order and per customer →
// customer file (summary, orders, payments history) → edge cases. Every amount is checked against what is stored,
// what the screens show and what the receipt says.
// Usage: node tests/e2e.lifecycle.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
const results = [];
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  results.push([cond ? "PASS" : "FAIL", name]);
  if (!cond) failures++;
}
const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";

  /* ---------------- helpers (drive the real screens; read the real storage) ---------------- */
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  // dismiss the WhatsApp / receipt prompt that follows a save, if any
  const later = async () => { await wait(250); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await wait(150); } };
  const db = () => page.evaluate(() => ({
    orders: JSON.parse(localStorage.getItem("l997_orders") || "[]"), customers: JSON.parse(localStorage.getItem("l997_customers") || "[]"),
    ledger: JSON.parse(localStorage.getItem("l997_ledger") || "[]"), settings: JSON.parse(localStorage.getItem("l997_settings")),
    packages: JSON.parse(localStorage.getItem("l997_customer_packages") || "[]"),
  }));
  const summary = (custId) => page.evaluate((id) => {
    const c = JSON.parse(localStorage.getItem("l997_customers")).find((x) => x.id === id);
    const s = window.L997Finance.customerSummary(c, JSON.parse(localStorage.getItem("l997_orders")), JSON.parse(localStorage.getItem("l997_ledger")));
    return { balance: c.balance, debt: s.debt, prepaid: s.prepaid, dueNow: s.dueNow, inProgress: s.inProgress, totalOwed: s.totalOwed, totalSpent: s.totalSpent, totalPaid: s.totalPaid, counts: s.counts,
      rows: Object.fromEntries(s.rows.map((r) => [r.order.number, { total: r.total, paid: r.paid, remaining: r.remaining, state: r.state }])) };
  }, custId);
  // customer balance must always equal opening balance + every ledger entry (never a drifting stored number)
  const balanceIntegrity = async () => { const d = await db(); return d.customers.every((c) => r3((Number(c.openingBalance) || 0) + d.ledger.filter((t) => t.customerId === c.id).reduce((a, t) => a + Number(t.amount || 0), 0)) === r3(c.balance)); };
  const price = async (cloth, svc) => (await db()).settings.prices[`${cloth}_${svc}`];
  const custByPhone = async (ph) => (await db()).customers.find((c) => String(c.phone).endsWith(ph));

  async function newCustomer(name, phone) {
    await closeAll(); await nav("customers"); await page.click("#addCustomerBtn");
    await page.fill("#customerName", name); await page.fill("#customerPhone", phone); await page.click("#saveCustomerBtn"); await wait(200);
    return custByPhone(phone);
  }
  async function pickCustomer(query, custId) {
    await closeAll(); await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", query); await wait(150);
    await page.click(`#customerResults [data-pick="${custId}"]`); await wait(100);
  }
  // add qty pieces of a garment with a given service; returns the cart line id
  async function addItem(cloth, svc, qty) {
    const before = await page.$$eval("[data-qty-plus]", (b) => b.map((x) => x.dataset.qtyPlus));
    for (let i = 0; i < qty; i++) await page.click(`#posProductGrid [data-cloth="${cloth}"]`);
    const after = await page.$$eval("[data-qty-plus]", (b) => b.map((x) => x.dataset.qtyPlus));
    const id = after.find((x) => !before.includes(x)) || after[after.length - 1];
    const sel = await page.$(`[data-service-change="${id}"]`);
    if (sel && (await sel.inputValue()) !== svc) await page.selectOption(`[data-service-change="${id}"]`, svc);
    return id;
  }
  async function saveOrder() {
    const n0 = (await db()).orders.length;
    await page.click("#posSaveOrderMainBtn"); await wait(300); await later();
    const d = await db();
    return d.orders.length > n0 ? d.orders[0] : null;
  }
  async function makeOrder(custId, query, items, opts = {}) {
    await pickCustomer(query, custId);
    for (const [cloth, svc, qty] of items) await addItem(cloth, svc, qty);
    if (opts.urgent) await page.check("#orderPriorityToggle");
    return saveOrder();
  }
  async function openOrder(orderId) {
    await closeAll(); await page.evaluate((id) => window.L997OpenOrder ? window.L997OpenOrder(id) : null, orderId);
    if (!(await page.isVisible("#orderDialog"))) {
      const o = (await db()).orders.find((x) => x.id === orderId);
      await nav("orders"); await page.fill("#globalSearch", "").catch(() => {});
      await page.click(`#ordersBody tr:has-text("#${o.number}") [data-view]`);
    }
    await wait(150);
  }
  const orderOf = async (id) => (await db()).orders.find((o) => o.id === id);
  async function makeReady(orderId, method, paid) {
    await openOrder(orderId); await page.click("#advanceStatusBtn");
    await page.selectOption("#qf_method", method); if (paid !== undefined) await page.fill("#qf_paid", String(paid));
    await submit(); await later(); await closeAll();
    return orderOf(orderId);
  }
  async function deliver(orderId, count, method, paid) {
    await openOrder(orderId); await page.click("#advanceStatusBtn");
    await page.fill("#qf_count", String(count));
    if (method) { await page.selectOption("#qf_method", method); if (paid !== undefined) await page.fill("#qf_paid", String(paid)); }
    await submit(); await later(); await closeAll();
    return orderOf(orderId);
  }
  // payment recorded on the customer's account; with orderId it is allocated to that order
  async function payment(custId, amount, orderId, method = "cash") {
    if (orderId) { await openOrder(orderId); await page.click("#payOrderRemainingBtn"); }
    else { await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), custId); await page.click("#cpSettle"); }
    await page.fill("#qf_amount", String(amount)); await page.selectOption("#qf_method", method); await page.selectOption("#qf_notify", "no");
    await submit();
    // same amount for the same customer within 10 minutes → the form asks to press again (possible duplicate)
    if (await page.isVisible("#quickFormSubmitBtn")) { payment.confirmed = (payment.confirmed || 0) + 1; await submit(); }
    await closeAll();
  }
  async function cancelOrder(orderId, reason, refund) {
    await openOrder(orderId); await page.click("#cancelOrderBtn"); await wait(200);
    await page.fill("#qf_reason", reason); if (refund) await page.selectOption("#qf_refund", refund);
    await submit(); await closeAll();
    return orderOf(orderId);
  }
  const pieces = (o) => o.items.reduce((n, it) => n + it.qty, 0);

  /* ---------------- 0. owner account ---------------- */
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  // this audit covers every service, so the wash-only service (off by default) is switched back on in Settings
  await nav("settings"); await page.click('[data-settings-tab="pricing"]'); await page.check('[data-service-active="wash"]'); await wait(200);
  check("wash-only service can be switched back on in Settings", (await db()).settings.serviceActive.wash === true);
  const P = (await db()).settings.prices;
  check("catalogue prices come from Settings (no invented prices): thobe iron, abaya, suit, blanket, ghatra present", P.thob_cotton_iron > 0 && P.abaya_plain_washiron > 0 && P.suit2pcs_iron > 0 && P.blanket_single_washiron > 0 && P.ghatra_iron > 0, JSON.stringify([P.thob_cotton_iron, P.abaya_plain_washiron, P.suit2pcs_iron, P.blanket_single_washiron]));

  /* ---------------- 1. customers: create, search by name / phone, similar names, no duplicates ---------------- */
  const cNew = await newCustomer("Ahmed Ali", "33110001");
  const cSim = await newCustomer("Ahmed Alawi", "33110002");
  check("customers created with normalised phone and zero balance", cNew && cSim && cNew.balance === 0 && cNew.openingBalance === 0, JSON.stringify(cNew));
  await nav("customers"); await page.click("#addCustomerBtn"); await page.fill("#customerName", "Copy"); await page.fill("#customerPhone", "33110001"); await page.click("#saveCustomerBtn"); await wait(200);
  check("same phone number cannot create a second customer", (await db()).customers.filter((c) => String(c.phone).endsWith("33110001")).length === 1);
  await closeAll();
  await nav("new-order"); await page.click("#posCustomerBarBtn");
  await page.fill("#orderCustomerPhone", "Ahmed"); await wait(150);
  const byName = await page.$$eval("#customerResults [data-pick]", (b) => b.map((x) => x.dataset.pick));
  await page.fill("#orderCustomerPhone", "3311 0002"); await wait(150);
  const byPhone = await page.$$eval("#customerResults [data-pick]", (b) => b.map((x) => x.dataset.pick));
  check("search by name finds both similar names; by phone finds exactly one", byName.length === 2 && byPhone.length === 1 && byPhone[0] === cSim.id, JSON.stringify([byName.length, byPhone.length]));
  await page.fill("#orderCustomerPhone", "33119999"); await wait(150);
  await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "From POS"); await page.click("#saveCustomerBtn"); await wait(200);
  const cPos = await custByPhone("33119999");
  check("new customer created from the order screen and selected for the order", !!cPos && /From POS/.test(await page.textContent("#posCustomerBarBtn").catch(() => "")), cPos && cPos.name);

  /* ---------------- 2. orders: every service mix, totals = Σ qty × price (+ urgent), stored = shown = receipt ---------------- */
  const o1 = await makeOrder(cNew.id, "33110001", [["thob_cotton", "iron", 1]]);
  check("new customer, 1 thobe iron: linked to the right customer, total = price", o1 && o1.customerId === cNew.id && o1.payment.total === P.thob_cotton_iron && o1.status === "received" && !o1.paymentConfirmed, o1 && JSON.stringify([o1.payment.total, P.thob_cotton_iron]));
  // big mixed order; remove a line and adjust a qty before saving
  await pickCustomer("Ahmed Alawi", cSim.id);
  await addItem("thob_cotton", "washiron", 3);
  const shirtLine = await addItem("shirt", "iron", 2);
  await addItem("pants_long", "washiron", 2);
  await addItem("ghatra", "iron", 1);
  await addItem("abaya_plain", "washiron", 1);
  await addItem("suit2pcs", "iron", 1);
  await addItem("blanket_single", "washiron", 1);
  const dressLine = await addItem("dress", "washiron", 1);
  await page.click(`[data-remove="${dressLine}"]`); // removed before saving
  await page.click(`[data-qty-plus="${shirtLine}"]`); // shirts 2 → 3
  await page.click(`[data-qty-minus="${shirtLine}"]`); // back to 2
  const shownBefore = await page.textContent("#summaryTotal");
  const o2 = await saveOrder();
  const expect2 = r3(3 * P.thob_cotton_washiron + 2 * P.shirt_iron + 2 * P.pants_long_washiron + P.ghatra_iron + P.abaya_plain_washiron + P.suit2pcs_iron + P.blanket_single_washiron);
  const lineOk = o2 && o2.items.every((it) => it.total === r3(it.qty * P[`${it.clothingId}_${it.serviceId}`]));
  check("mixed order (thobes, shirts, trousers, ghatra, abaya, suit, blanket): each line = qty × price", lineOk && o2.items.length === 7 && !o2.items.some((i) => i.clothingId === "dress"), o2 && o2.items.map((i) => `${i.clothingId}:${i.qty}×${i.unit}=${i.total}`).join(" "));
  check("mixed order total = Σ lines; screen showed the same total before saving", o2.payment.total === expect2 && shownBefore.includes(expect2.toFixed(3)), `${o2.payment.total} vs ${expect2}; screen ${shownBefore}`);
  const rec2 = await page.evaluate((id) => window.receiptText997(id), o2.id);
  check("WhatsApp receipt shows the stored total and every line", rec2.includes(expect2.toFixed(3)) && (rec2.match(/×/g) || []).length >= 7, rec2.split("\n").slice(0, 4).join(" | "));
  // urgent: fee on garments
  const o3 = await makeOrder(cNew.id, "33110001", [["shirt", "washiron", 2]], { urgent: true });
  const fee = r3(2 * P.shirt_washiron * ((await db()).settings.urgentPercent / 100));
  check("urgent order: total = items + urgent fee (Settings %)", o3.priority === "urgent" && o3.payment.urgentFee === fee && o3.payment.total === r3(2 * P.shirt_washiron + fee), JSON.stringify([o3.payment.total, fee]));

  // invalid input: no customer, empty cart, double-click save, prices cannot be negative
  await closeAll(); await nav("new-order");
  const nBefore = (await db()).orders.length;
  await page.click("#posCancelBtn").catch(() => {});
  await page.click("#posSaveOrderMainBtn"); await wait(200); await closeAll();
  await pickCustomer("33110001", cNew.id); await page.click("#posSaveOrderMainBtn"); await wait(250); await closeAll();
  check("order without customer or without items is refused (nothing saved)", (await db()).orders.length === nBefore);
  await pickCustomer("33110001", cNew.id); await addItem("shirt", "iron", 1);
  await page.dblclick("#posSaveOrderMainBtn"); await page.click("#posSaveOrderMainBtn").catch(() => {}); await wait(400); await later();
  check("double / triple click on Save creates exactly one order", (await db()).orders.length === nBefore + 1, (await db()).orders.length - nBefore);
  const oDbl = (await db()).orders[0];

  /* ---------------- 3. lifecycle: received → ready → delivered, who/when, abnormal transitions ---------------- */
  const r1 = await makeReady(o1.id, "cash", o1.payment.total);
  check("ready + paid in full: status, payer and time recorded", r1.status === "ready" && r1.paymentConfirmed && r1.payment.paid === o1.payment.total && r1.paymentBy === "Owner" && !!r1.paidAt && r1.statusHistory.some((h) => h.status === "ready" && h.by === "Owner"));
  check("who prepared the order is recorded (readyBy + time)", r1.readyBy === "Owner" && !!r1.readyById && !!r1.readyAt);
  check("order created by is recorded", o1.createdBy === "Owner" && !!o1.createdById);
  await openOrder(o1.id); await page.click("#advanceStatusBtn"); await page.fill("#qf_count", "5"); await submit();
  check("delivery with the wrong piece count is refused", (await orderOf(o1.id)).status === "ready"); await closeAll();
  const d1 = await deliver(o1.id, pieces(o1));
  check("delivered: deliverer and time recorded; no further status button", d1.status === "delivered" && d1.deliveredBy === "Owner" && !!d1.deliveredAt);
  await openOrder(o1.id);
  const resp = (await page.textContent("#orderDialog")).replace(/\s+/g, " ");
  check("order screen shows who created, prepared, took payment and delivered", /أنشأ الطلب ?Owner/.test(resp) && /جهّز الطلب[^O]*Owner/.test(resp) && /أكّد الدفع ?Owner/.test(resp) && /سلّم الطلب للعميل ?Owner/.test(resp), (resp.match(/(أنشأ|جهّز|أكّد|سلّم)[^٠-٩0-9]{0,40}/g) || []).join(" | "));
  await closeAll();
  await openOrder(o1.id);
  check("a delivered order cannot be delivered again or cancelled", !(await page.isVisible("#advanceStatusBtn")) && !(await page.isVisible("#cancelOrderBtn"))); await closeAll();
  await openOrder(o2.id);
  check("an order that is not ready offers 'prepare', never 'deliver'", /تجهيز/.test(await page.textContent("#advanceStatusBtn"))); await closeAll();
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)");
  check("order history survives a page refresh", (await orderOf(o1.id)).status === "delivered" && (await db()).orders.length === nBefore + 1);
  await page.click("#logoutBtn"); await wait(300);
  await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)");
  check("order history survives sign-out and sign-in", (await orderOf(o1.id)).statusHistory.length === 3);

  /* ---------------- 4. payment cases A–F (10.000 orders: 20 × abaya embroidered wash+iron at the real price) ---------------- */
  const unit = P.bedsheet_single_washiron; // bedsheet wash & iron: 0.500 on the shop price list
  const qtyFor = (amt) => Math.round(amt / unit);
  check("test amounts use a real price-list price (bedsheet wash & iron)", unit > 0 && Math.abs(qtyFor(10) * unit - 10) < 1e-9, unit);
  const cA = await newCustomer("Case A", "33220001");
  const oA = await makeOrder(cA.id, "33220001", [["bedsheet_single", "washiron", qtyFor(10)]]);
  const A = await makeReady(oA.id, "cash", 10);
  let sA = await summary(cA.id);
  check("A full payment 10.000: paid 10, remaining 0, state paid, no debt entry", A.payment.total === 10 && A.payment.paid === 10 && sA.rows[A.number].remaining === 0 && sA.rows[A.number].state === "paid" && sA.debt === 0 && !(await db()).ledger.some((t) => t.orderId === oA.id), JSON.stringify(sA.rows[A.number]));
  check("A receipt says fully paid", /مدفوع بالكامل/.test(await page.evaluate((id) => window.receiptText997(id), oA.id)));

  const cB = await newCustomer("Case B", "33220002");
  const oB = await makeOrder(cB.id, "33220002", [["bedsheet_single", "washiron", qtyFor(10)]]);
  const B = await makeReady(oB.id, "cash", 4);
  let sB = await summary(cB.id);
  check("B partial 4 of 10: paid 4, remaining 6, state 'partial', customer owes 6", B.payment.paid === 4 && sB.rows[B.number].paid === 4 && sB.rows[B.number].remaining === 6 && sB.rows[B.number].state === "partial" && sB.debt === 6 && sB.balance === -6, JSON.stringify([sB.rows[B.number], sB.debt]));
  check("B debt recorded once in the ledger (−6.000)", (await db()).ledger.filter((t) => t.orderId === oB.id).map((t) => t.amount).join() === "-6");

  const cC = await newCustomer("Case C", "33220003");
  const oC = await makeOrder(cC.id, "33220003", [["bedsheet_single", "washiron", qtyFor(10)]]);
  let sC = await summary(cC.id);
  check("C not paid at creation: saved, 10 in progress, nothing counted as collected", sC.inProgress === 10 && sC.debt === 0 && !(await db()).ledger.some((t) => t.customerId === cC.id));
  const C1 = await makeReady(oC.id, "later");
  sC = await summary(cC.id);
  check("C ready, pay on pickup: 10 due on pickup, still not a sale", C1.status === "ready" && !C1.paymentConfirmed && sC.dueNow === 10 && sC.totalOwed === 10);
  const C2 = await deliver(oC.id, pieces(oC), "unpaid");
  sC = await summary(cC.id);
  check("C delivered on credit (policy allows, recorded under the employee): debt 10", C2.status === "delivered" && C2.payment.outstanding === 10 && sC.debt === 10 && sC.rows[C2.number].state === "debt");

  // D: 10, paid 4, remaining 6 → +3 on the order → 7 / 3 → +3 → 0
  await payment(cB.id, 3, oB.id);
  sB = await summary(cB.id);
  const ledB = (await db()).ledger.filter((t) => t.customerId === cB.id);
  check("D second payment 3 on the order: paid 7, remaining 3", sB.rows[B.number].paid === 7 && sB.rows[B.number].remaining === 3 && sB.debt === 3, JSON.stringify(sB.rows[B.number]));
  check("D payment linked to the right order and customer; first payment intact", ledB.some((t) => t.type === "credit" && t.amount === 3 && t.orderId === oB.id && t.settles) && (await orderOf(oB.id)).payment.paid === 4);
  await openOrder(oB.id);
  const dlgB = (await page.textContent("#orderDialog")).replace(/\s+/g, " ");
  check("D order screen shows paid 7.000 (3.000 paid later) and remaining 3.000 — not the old 6.000", /المدفوع ?7\.000/.test(dlgB) && /منها سداد لاحق ?3\.000/.test(dlgB) && /المتبقي ?3\.000/.test(dlgB) && !/6\.000/.test(dlgB), dlgB.match(/(المدفوع|المتبقي|منها)[^د]*/g)?.join(" | "));
  await closeAll();
  check("D receipt shows remaining 3.000", /المتبقي عليكم: 3\.000/.test(await page.evaluate((id) => window.receiptText997(id), oB.id)));
  await payment(cB.id, 3, oB.id);
  sB = await summary(cB.id);
  check("D a second identical 3.000 within 10 minutes needed an explicit confirmation (duplicate guard)", payment.confirmed === 1, payment.confirmed);
  check("D final payment: order remaining 0, paid 10, customer owes nothing", sB.rows[B.number].remaining === 0 && sB.rows[B.number].paid === 10 && sB.rows[B.number].state === "paid" && sB.balance === 0);
  check("D payments history lists all three payments once each (4 + 3 + 3)", await (async () => { await page.evaluate((id) => window.openCustomerProfile997(id), cB.id); const t = await page.textContent(".cp-pays"); await closeAll(); return (t.match(/\+4\.000/g) || []).length === 1 && (t.match(/\+3\.000/g) || []).length === 2; })());

  // E: overpayment at ready (12 on 10) and on a debt (8 on 6)
  const cE = await newCustomer("Case E", "33220005");
  const oE = await makeOrder(cE.id, "33220005", [["bedsheet_single", "washiron", qtyFor(10)]]);
  const E = await makeReady(oE.id, "cash", 12);
  let sE = await summary(cE.id);
  check("E overpay at ready (12 on 10): order paid 10, extra 2 shown as customer credit", E.payment.paid === 10 && sE.prepaid === 2 && (await db()).ledger.some((t) => t.customerId === cE.id && t.type === "credit" && t.amount === 2));
  const oE2 = await makeOrder(cE.id, "33220005", [["bedsheet_single", "washiron", qtyFor(10)]]);
  await makeReady(oE2.id, "cash", 4); // balance: +2 − 6 = −4
  sE = await summary(cE.id);
  check("E earlier credit reduces the new debt (2 credit − 6 owed = owes 4)", sE.debt === 4, JSON.stringify([sE.balance, sE.debt]));
  await payment(cE.id, 8, null);
  sE = await summary(cE.id);
  check("E paying 8 on a 4 debt: debt 0, 4 kept as visible credit (not hidden)", sE.debt === 0 && sE.prepaid === 4 && sE.balance === 4);

  // F: cancellations
  const cF = await newCustomer("Case F", "33220006");
  const fUnpaid = await makeOrder(cF.id, "33220006", [["bedsheet_single", "washiron", qtyFor(4)]]);
  const fu = await cancelOrder(fUnpaid.id, "customer changed mind");
  check("F cancel unpaid: cancelled, reason and user recorded, no money moved", fu.status === "cancelled" && fu.cancelReason === "customer changed mind" && fu.cancelledBy === "Owner" && !(await db()).ledger.some((t) => t.orderId === fUnpaid.id));
  const fPart = await makeOrder(cF.id, "33220006", [["bedsheet_single", "washiron", qtyFor(10)]]);
  await makeReady(fPart.id, "cash", 4);
  const fp = await cancelOrder(fPart.id, "damaged item", "cash");
  let sF = await summary(cF.id);
  const ledF = (await db()).ledger.filter((t) => t.orderId === fPart.id).map((t) => t.amount);
  check("F cancel partly paid: 4 refunded in cash, 6 debt dropped, customer owes 0, history kept", fp.status === "cancelled" && fp.refund && fp.refund.amount === 4 && fp.refund.mode === "cash" && sF.balance === 0 && ledF.join() === "6,-6", JSON.stringify([fp.refund, ledF]));
  const fFull = await makeOrder(cF.id, "33220006", [["bedsheet_single", "washiron", qtyFor(4)]]);
  await makeReady(fFull.id, "card", 4);
  const ff = await cancelOrder(fFull.id, "duplicate", "balance");
  sF = await summary(cF.id);
  check("F cancel fully paid, refund to balance: 4 becomes customer credit, original payment kept", ff.refund.mode === "balance" && ff.payment.paid === 4 && sF.prepaid === 4, JSON.stringify([ff.refund, sF.prepaid]));
  check("F cancelled orders excluded from purchases but counted as cancelled", sF.counts.cancelled === 3 && sF.totalSpent === 0 && sF.rows[ff.number].state === "cancelled");

  /* ---------------- 5. arrears: 10/10, 8/3, 6/0, 4/2 = 13.000 → 5 on order 2 → 8.000 ---------------- */
  const cX = await newCustomer("Arrears Test", "33330001");
  const plan = [[10, 10], [8, 3], [6, 0], [4, 2]];
  const xs = [];
  for (const [tot, paid] of plan) {
    const o = await makeOrder(cX.id, "33330001", [["bedsheet_single", "washiron", qtyFor(tot)]]);
    xs.push(await makeReady(o.id, paid > 0 ? "cash" : "unpaid", paid > 0 ? paid : undefined));
    await wait(30);
  }
  let sX = await summary(cX.id);
  const remX = () => xs.map((o) => sX.rows[o.number].remaining);
  check("arrears table: remaining per order 0 / 5 / 6 / 2", remX().join() === "0,5,6,2", remX().join());
  check("arrears total 13.000; purchases 28.000; paid 15.000", sX.debt === 13 && sX.totalSpent === 28 && sX.totalPaid === 15, JSON.stringify([sX.debt, sX.totalSpent, sX.totalPaid]));
  await page.evaluate((id) => window.openCustomerProfile997(id), cX.id);
  const prof1 = (await page.textContent("#customerProfileContent")).replace(/\s+/g, " ");
  check("customer file shows owed now 13.000 and per-order remaining", /المستحق عليه الآن ?13\.000/.test(prof1) && /مدفوع جزئياً/.test(prof1), prof1.slice(0, 180));
  // pay 5 on order 2 from the customer file's per-order button
  await page.click(`[data-cp-pay="${xs[1].id}"]`);
  await page.fill("#qf_amount", "5"); await page.selectOption("#qf_notify", "no"); await submit(); await closeAll();
  sX = await summary(cX.id);
  check("5.000 on order 2: order 2 remaining 0, others unchanged (0 / 0 / 6 / 2)", remX().join() === "0,0,6,2", remX().join());
  check("arrears now 8.000 everywhere: summary, customer balance, Σ order remainders", sX.debt === 8 && sX.balance === -8 && r3(remX().reduce((a, b) => a + b, 0)) === 8);
  await nav("balances"); await wait(200);
  const balPage = (await page.textContent("#page-balances")).replace(/\s+/g, " ");
  check("balances page shows the same 8.000 debt", /8\.000/.test(balPage));
  // untargeted 1.000: settles the oldest open debt first, never twice
  await payment(cX.id, 1, null);
  sX = await summary(cX.id);
  check("unallocated 1.000 settles the oldest open order first (order 3: 6 → 5); total 7.000", remX().join() === "0,0,5,2" && sX.debt === 7, remX().join());

  /* ---------------- 6. customer file content ---------------- */
  await page.evaluate((id) => window.openCustomerProfile997(id), cX.id);
  const prof = (await page.textContent("#customerProfileContent")).replace(/\s+/g, " ");
  check("customer file: counts by stage (ready 4, delivered 0, cancelled 0)", /جاهز للاستلام ?4/.test(prof) && /مُسلَّم ?0/.test(prof) && /ملغي ?0/.test(prof), prof.match(/(قيد التجهيز|جاهز للاستلام|مُسلَّم|ملغي) ?\d+/g)?.join(" | "));
  check("customer file: every order lists its items and stage", (prof.match(/شرشف/g) || []).length >= 4);
  const payRows = await page.$$eval(".cp-pay-row", (rs) => rs.map((r) => r.textContent.replace(/\s+/g, " ")));
  check("payments history: order payments + allocated + unallocated, each with method and employee", payRows.length === 5 && payRows.every((r) => /بواسطة Owner/.test(r)) && payRows.some((r) => /#\d{5}/.test(r) && /\+5\.000/.test(r)), JSON.stringify(payRows.slice(0, 2)));
  await closeAll();

  /* ---------------- 7. packages: active, exhausted ---------------- */
  await nav("settings"); await page.click('[data-settings-tab="packages"]'); await page.click("#addPackageDefBtn");
  await page.fill("#qf_name", "Iron 3"); await page.selectOption("#qf_serviceType", "iron"); await page.fill("#qf_pieceCount", "3"); await page.fill("#qf_price", "0.9");
  await submit(); await closeAll();
  const cP = await newCustomer("Package Customer", "33440001");
  await nav("customers"); await page.fill("#customerSearch", "Package"); await page.click("#customersBody tr:first-child [data-sell-package]"); await submit(); await page.waitForTimeout(300); await closeAll();
  const oP1 = await makeOrder(cP.id, "33440001", [["shirt", "iron", 2]]);
  check("active package: 2 shirts ironed from the package, order total 0", oP1.payment.total === 0 && oP1.items.every((i) => i.fromPackageId), JSON.stringify(oP1.items.map((i) => [i.qty, i.fromPackageId ? "pkg" : "paid"])));
  const oP2 = await makeOrder(cP.id, "33440001", [["shirt", "iron", 2]]);
  const pkgItems = oP2.items.filter((i) => i.fromPackageId).reduce((a, i) => a + i.qty, 0);
  const paidLine = oP2.items.find((i) => !i.fromPackageId);
  check("last package piece used, the next one charged at the normal price", pkgItems === 1 && paidLine && paidLine.qty === 1 && oP2.payment.total === P[`shirt_${paidLine.serviceId}`], JSON.stringify([pkgItems, paidLine && paidLine.serviceId, oP2.payment.total]));
  const oP3 = await makeOrder(cP.id, "33440001", [["shirt", "iron", 1]]);
  check("exhausted package: full price, nothing taken from the package", oP3.payment.total === P.shirt_iron && !oP3.items.some((i) => i.fromPackageId) && (await db()).packages[0].remainingPieces === 0);
  await cancelOrder(oP1.id, "test return");
  check("cancelling a package order returns its pieces", (await db()).packages[0].remainingPieces === 2);

  /* ---------------- 8. several open orders, ready + in progress for one customer ---------------- */
  const oM1 = await makeOrder(cNew.id, "33110001", [["tshirt", "washiron", 1]]);
  await makeReady(oM1.id, "later");
  const sN = await summary(cNew.id);
  check("one customer with orders delivered, ready and in progress: counted separately", sN.counts.delivered === 1 && sN.counts.ready === 1 && sN.counts.open === 2 && sN.dueNow === P.tshirt_washiron, JSON.stringify(sN.counts));

  /* ---------------- 9. edge cases ---------------- */
  // edit after payment is blocked; edit before payment recalculates, zero / negative quantities refused
  await openOrder(oB.id);
  check("a paid order cannot be edited", !(await page.isVisible("#editOrderBtn"))); await closeAll();
  await openOrder(oDbl.id); await page.click("#editOrderBtn");
  await page.fill("#qf_q0", "-2"); await page.fill("#qf_reason", "test"); await submit();
  const afterNeg = await orderOf(oDbl.id);
  check("edit with a negative quantity is refused", afterNeg.items[0].qty === 1 && afterNeg.payment.total === P.shirt_iron, JSON.stringify(afterNeg.items.map((i) => i.qty)));
  await closeAll();
  // zero and negative payments
  await page.evaluate((id) => window.openCustomerProfile997(id), cX.id); await page.click("#cpSettle");
  await page.fill("#qf_amount", "0"); await submit();
  const zeroOpen = await page.isVisible("#quickFormSubmitBtn");
  await page.fill("#qf_amount", "-5"); await submit();
  check("payment of 0 or a negative amount is refused (form stays open, nothing recorded)", zeroOpen && (await page.isVisible("#quickFormSubmitBtn")) && (await summary(cX.id)).debt === 7);
  await closeAll();
  // paying from balance more than the customer has is refused
  const oBal = await makeOrder(cF.id, "33220006", [["bedsheet_single", "washiron", qtyFor(10)]]);
  await openOrder(oBal.id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", "balance"); await submit();
  check("paying 10 from a 4.000 balance is refused with a clear message", (await orderOf(oBal.id)).status === "received"); await closeAll();
  // payment 'ready' with 0 cash must be refused (choose credit instead)
  await openOrder(oBal.id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", "cash"); await page.fill("#qf_paid", "0"); await submit();
  check("cash payment of 0 is refused (use 'credit' explicitly)", (await orderOf(oBal.id)).status === "received"); await closeAll();
  // three-decimal BHD amounts
  const cD = await newCustomer("Fils", "33550001");
  const oD = await makeOrder(cD.id, "33550001", [["socks", "washiron", 7], ["cap", "washiron", 3]]);
  const expD = r3(7 * P.socks_washiron + 3 * P.cap_washiron);
  await makeReady(oD.id, "cash", 0.333);
  const sD = await summary(cD.id);
  check("fils precision: total and remaining exact to 3 decimals", oD.payment.total === expD && sD.debt === r3(expD - 0.333), JSON.stringify([oD.payment.total, expD, sD.debt]));
  // refresh after a payment keeps everything
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)");
  check("after refresh: arrears still 7.000 and every balance = opening + ledger", (await summary(cX.id)).debt === 7 && (await balanceIntegrity()));

  // an employee without payment permission cannot record payments
  await nav("access"); await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Worker"); await page.selectOption("#qf_role", "worker"); await page.fill("#qf_username", "worker1");
  const wpw = await page.inputValue("#qf_password"); await submit(); await later(); await closeAll();
  await page.click("#logoutBtn"); await wait(300);
  await page.fill("#au_user", "worker1"); await page.fill("#au_pass", wpw); await page.click("#au_form button[type=submit]"); await wait(300);
  if (!(await page.isVisible("#au_pw"))) console.log("DIAG worker login:", await page.textContent("#au_err").catch(() => "?"), JSON.stringify((await page.evaluate(() => JSON.parse(localStorage.getItem("l997_employees")))).map((e) => e.username)));
  await page.fill("#au_pw", "Worker#2026x"); await page.fill("#au_pw2", "Worker#2026x"); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)");
  await wait(800);
  check("staff are not asked to start a shift (shifts off by default)", !(await page.isVisible("#qf_opening")));
  await closeAll();
  await closeAll();
  await page.evaluate((id) => window.openCustomerProfile997(id), cX.id);
  await page.click("#cpSettle"); await wait(250);
  check("…and can record a payment straight away (no shift needed)", await page.isVisible("#qf_amount"));
  await wait(300); if (await page.isVisible("#qf_opening")) { await page.fill("#qf_opening", "0"); await submit(); await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), cX.id); await page.click("#cpSettle"); await wait(250); }
  const wTypes = await page.$$eval("#qf_type option", (os) => os.map((o) => o.value)).catch(() => []);
  check("worker may receive a payment (default cashier permission) but cannot adjust, refund or reverse", wTypes.length > 0 && wTypes.every((x) => x === "credit"), JSON.stringify(wTypes));
  await closeAll();

  /* ---------------- 10. reports agree with the transactions ---------------- */
  check("every customer balance equals opening balance + ledger entries", await balanceIntegrity());
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${results.filter((r) => r[0] === "PASS").length} passed, ${failures} failed`);
  console.log(failures ? `${failures} check(s) FAILED` : "ALL LIFECYCLE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
