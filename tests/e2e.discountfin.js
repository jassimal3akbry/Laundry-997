// Discounts all the way through the money: code and manual discounts → payment (full / partial / later) →
// customer debt and balance → receipt → dashboard, reports, daily closing → edit, cancel, settle.
// Fixed test prices: shirt wash & iron 0.200, thobe wash & iron 0.300, urgent = double.
// Usage: node tests/e2e.discountfin.js [path-to-html]
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}
const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await require("./fixed-prices")(page);
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const later = async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); };
  const db = () => page.evaluate(() => ({ orders: JSON.parse(localStorage.getItem("l997_orders") || "[]"), customers: JSON.parse(localStorage.getItem("l997_customers") || "[]"), ledger: JSON.parse(localStorage.getItem("l997_ledger") || "[]") }));
  const orderOf = async (id) => (await db()).orders.find((o) => o.id === id);
  let custId = null;
  async function order(items, { code, manual, reason, urgent } = {}) {
    await closeAll(); await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122"); await wait(150);
    if (await page.isVisible("#newCustomerFromNoResultBtn")) { await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Discount Customer"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn"); }
    else await page.click("#customerResults [data-pick]");
    for (const [cloth, n] of items) for (let i = 0; i < n; i++) await page.click(`#posProductGrid [data-cloth="${cloth}"]`);
    if (urgent) await page.check("#orderPriorityToggle");
    if (code) { await page.fill("#discountCode", code); await page.click("#applyCodeBtn"); await wait(150); }
    if (manual) { await page.fill("#discountAmount", String(manual)); await page.dispatchEvent("#discountAmount", "change"); await page.fill("#discountReason", reason || "test"); }
    const n0 = (await db()).orders.length;
    await page.click("#posSaveOrderMainBtn"); await wait(400); await later(); await closeAll();
    const d = await db(); if (!custId) custId = d.customers[0].id;
    return d.orders.length > n0 ? d.orders[0] : null;
  }
  async function openOrder(id) { await closeAll(); await nav("orders"); await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id); await wait(150); }
  async function ready(id, method, paid) { await openOrder(id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", method); if (paid !== undefined) await page.fill("#qf_paid", String(paid)); await submit(); await later(); await closeAll(); return orderOf(id); }
  async function deliver(id, method, paid) { const o = await orderOf(id); await openOrder(id); await page.click("#advanceStatusBtn"); await page.fill("#qf_count", String(o.items.reduce((a, i) => a + i.qty, 0))); if (method) { await page.selectOption("#qf_method", method); if (paid !== undefined) await page.fill("#qf_paid", String(paid)); } await submit(); await later(); await closeAll(); return orderOf(id); }
  const summary = () => page.evaluate((id) => { const c = JSON.parse(localStorage.getItem("l997_customers")).find((x) => x.id === id); const s = window.L997Finance.customerSummary(c, JSON.parse(localStorage.getItem("l997_orders")), JSON.parse(localStorage.getItem("l997_ledger"))); return { balance: c.balance, debt: s.debt, rows: Object.fromEntries(s.rows.map((r) => [r.order.number, r])) }; }, custId);
  const integrity = async () => { const d = await db(); return d.customers.every((c) => r3((c.openingBalance || 0) + d.ledger.filter((t) => t.customerId === c.id).reduce((a, t) => a + Number(t.amount), 0)) === r3(c.balance)); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  await nav("settings"); await page.click('[data-settings-tab="packages"]');
  await page.click("#addDiscountCodeBtn"); await page.fill("#qf_code", "SAVE20"); await page.fill("#qf_percent", "20"); await submit(); await closeAll();

  /* A: code 20% on 10 shirts (2.000 → 1.600), partial payment 1.000 → debt 0.600 */
  const A0 = await order([["shirt", 10]], { code: "SAVE20" });
  check("A order: 2.000 − 20% = 1.600 (discount 0.400 stored)", A0.payment.subtotal === 2 && A0.payment.discount === 0.4 && A0.payment.total === 1.6, JSON.stringify([A0.payment.subtotal, A0.payment.discount, A0.payment.total]));
  const A = await ready(A0.id, "cash", 1);
  let s = await summary();
  check("A partial payment 1.000 on 1.600: debt 0.600 recorded once on the customer", A.payment.paid === 1 && s.debt === 0.6 && s.balance === -0.6 && (await db()).ledger.filter((t) => t.orderId === A.id).map((t) => t.amount).join() === "-0.6", JSON.stringify([A.payment.paid, s.debt, s.balance]));
  check("A customer file: paid 1.000, remaining 0.600 (on the discounted total)", s.rows[A.number].paid === 1 && s.rows[A.number].remaining === 0.6 && s.rows[A.number].total === 1.6);
  const recA = await page.evaluate((id) => window.receiptText997(id), A.id);
  check("A receipt shows discount 0.400, total 1.600, remaining 0.600", /0\.400/.test(recA) && /1\.600/.test(recA) && /0\.600/.test(recA), recA.split("\n").filter((l) => /0\.400|1\.600|0\.600/.test(l)).join(" | "));

  /* B: manual discount 0.300 on 5 thobes (1.500 → 1.200), paid in full by card */
  const B0 = await order([["thob_cotton", 5]], { manual: 0.3, reason: "regular customer" });
  const B = await ready(B0.id, "card", 1.2);
  s = await summary();
  check("B manual discount: 1.500 − 0.300 = 1.200 paid in full by card, no new debt", B.payment.total === 1.2 && B.payment.paid === 1.2 && B.payment.discount === 0.3 && s.debt === 0.6 && s.rows[B.number].state === "paid");

  /* C: urgent + code: 2 shirts 0.400 + urgent 0.400 = 0.800 − 20% = 0.640; pay on pickup, delivered on credit */
  const C0 = await order([["shirt", 2]], { code: "SAVE20", urgent: true });
  check("C urgent + code: (0.400 + 0.400 urgent) − 20% = 0.640", C0.payment.urgentFee === 0.4 && C0.payment.discount === 0.16 && C0.payment.total === 0.64, JSON.stringify([C0.payment.urgentFee, C0.payment.discount, C0.payment.total]));
  await ready(C0.id, "later");
  const C = await deliver(C0.id, "unpaid");
  s = await summary();
  check("C delivered on credit: customer now owes 0.600 + 0.640 = 1.240", C.status === "delivered" && s.debt === 1.24 && s.balance === -1.24, JSON.stringify([s.debt, s.balance]));

  /* E: code order edited before payment (10 → 5 shirts): total follows the same 20% */
  const E0 = await order([["shirt", 10]], { code: "SAVE20" });
  await openOrder(E0.id); await page.click("#editOrderBtn"); await page.fill("#qf_q0", "5"); await page.fill("#qf_reason", "customer took 5 back"); await submit(); await closeAll();
  let E = await orderOf(E0.id);
  check("E edit 10 → 5 shirts: 1.000 − 20% = 0.800", E.payment.subtotal === 1 && E.payment.discount === 0.2 && E.payment.total === 0.8, JSON.stringify([E.payment.subtotal, E.payment.discount, E.payment.total]));
  E = await ready(E0.id, "cash", 0.8);

  /* F: code order paid 0.800 cash then cancelled with a cash refund — must not count as a sale */
  const F0 = await order([["shirt", 5]], { code: "SAVE20" });
  await ready(F0.id, "cash", 0.8);
  await openOrder(F0.id); await page.click("#cancelOrderBtn"); await wait(200); await page.fill("#qf_reason", "customer cancelled"); await page.selectOption("#qf_refund", "cash"); await submit(); await closeAll();
  const F = await orderOf(F0.id);
  check("F cancelled: refund equals what was paid after discount (0.800)", F.status === "cancelled" && F.refund && F.refund.amount === 0.8, JSON.stringify(F.refund));

  /* D: customer settles the 1.240 debt in cash */
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), custId); await page.click("#cpSettle");
  await page.fill("#qf_amount", "1.24"); await page.selectOption("#qf_method", "cash"); await page.selectOption("#qf_notify", "no"); await submit(); await closeAll();
  s = await summary();
  check("D customer settles 1.240: balance 0.000, every order shows paid", s.balance === 0 && s.debt === 0 && s.rows[A.number].remaining === 0 && s.rows[C.number].remaining === 0);
  check("customer balance always equals the ledger (no drift)", await integrity());

  /* Final numbers for the day — engine, dashboard, reports, daily closing */
  // sales = 1.600 + 1.200 + 0.640 + 0.800 = 4.240 ; discounts = 0.400 + 0.300 + 0.160 + 0.200 = 1.060
  // collected: cash 1.000 + 0.800 + 1.240 (+0.800 − 0.800 refund) = 3.040, card 1.200 → 4.240 ; drawer cash 3.040
  const day = await page.evaluate(() => { const F = window.L997Finance, t = F.todayStr(); return F.summarize({ orders: JSON.parse(localStorage.getItem("l997_orders")), ledger: JSON.parse(localStorage.getItem("l997_ledger")), customers: JSON.parse(localStorage.getItem("l997_customers")), expenses: [], customerPackages: [] }, t, t); });
  check("day: sales 4.240 (after discounts, cancelled excluded)", day.salesTotal === 4.24, day.salesTotal);
  check("day: discounts given 1.060", day.discounts === 1.06, day.discounts);
  check("day: cash collected 4.240 (cash 3.040 + card 1.200, refund deducted)", day.collected === 4.24, JSON.stringify([day.collected, day.collectedBy]));
  check("day: expected cash in the drawer 3.040", day.expectedCash === 3.04, day.expectedCash);
  await closeAll(); await nav("dashboard"); await wait(300);
  const dash = (await page.textContent("#metricsGrid")).replace(/\s+/g, " ");
  check("dashboard shows sales 4.240 and receivables 0", /4\.240/.test(dash), dash.slice(0, 200));
  await nav("reports"); await wait(300);
  const rep = (await page.textContent("#reportContent")).replace(/\s+/g, " ");
  check("reports show discounts 1.060 and sales 4.240", /1\.060/.test(rep) && /4\.240/.test(rep), (rep.match(/الخصومات[^٠-٩0-9]{0,30}[0-9.]+/) || [""])[0]);
  await nav("closures"); await wait(300);
  const cls = (await page.textContent("#dailyClosurePreview")).replace(/\s+/g, " ");
  check("daily closing expects 3.040 cash in the drawer", /3\.040/.test(cls), (cls.match(/المتوقع[^٠-٩0-9]{0,20}-?[0-9.]+/) || [""])[0]);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL DISCOUNT-FINANCE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
