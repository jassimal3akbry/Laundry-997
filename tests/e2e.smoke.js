// End-to-end smoke test: drives the real app in headless Chromium.
// Usage: node tests/e2e.smoke.js [path-to-html]   (default: laundry-997-full.html)
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
const PW = "Owner#2026pass";
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on("popup", (p) => p.close().catch(() => {}));
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await require("./fixed-prices")(page); // flow test: fixed test prices, independent of the shop's price list
  await page.goto(await serve(file));

  // 1) First-time owner setup
  await page.fill("#au_name", "Owner Test");
  await page.fill("#au_user", "owner");
  await page.fill("#au_pw", PW);
  await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]");
  await page.check("#au_saved");
  await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  check("owner setup + login", true);

  const quickSubmit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const quickCancelIfOpen = async () => {
    await page.waitForTimeout(250);
    if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); }
    else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); }
  };

  // 2) Create customer + order (2 x cotton thob wash&iron = 0.600, 1 x shirt = 0.200 → 0.800)
  async function newOrder(name, phone, taps) {
    await page.click('.nav-item[data-page="new-order"]');
    await page.click("#posCustomerBarBtn");
    await page.fill("#orderCustomerPhone", phone);
    await page.waitForTimeout(100);
    if (await page.isVisible("#newCustomerFromNoResultBtn")) {
      await page.click("#newCustomerFromNoResultBtn");
      await page.fill("#customerName", name);
      await page.fill("#customerPhone", phone);
      await page.click("#saveCustomerBtn");
    } else {
      await page.click("#customerResults [data-pick]");
    }
    for (const id of taps) await page.click(`#posProductGrid [data-cloth="${id}"]`);
    await page.click("#posSaveOrderMainBtn");
    await quickCancelIfOpen(); // WhatsApp prompt → "later"
  }
  await newOrder("Ali", "33001122", ["thob_cotton", "thob_cotton", "shirt"]);
  let orders = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")));
  check("order saved", orders.length === 1);
  check("order total computed", orders[0].payment.total === 0.8, orders[0].payment.total);

  // 3) Confirm payment with 0.500 cash → 0.300 debt (owner has allow_credit)
  async function pay(orderIdx, method, amount) {
    await page.click('.nav-item[data-page="orders"]');
    await page.click(`#ordersBody tr:nth-child(${orderIdx}) [data-view]`);
    await page.click("#advanceStatusBtn");
    await page.selectOption("#qf_method", method);
    await page.fill("#qf_paid", String(amount));
    await quickSubmit();
    await quickCancelIfOpen();
    if (await page.isVisible("#closeOrderDialog2")) await page.click("#closeOrderDialog2");
  }
  await pay(1, "cash", "0.5");
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")));
  const custs = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_customers")));
  check("order ready after payment", orders[0].status === "ready", orders[0].status);
  check("customer debt recorded", custs[0].balance === -0.3, custs[0].balance);

  // 4) Customer pays off the 0.300 debt in cash from the Balances page
  await page.click('.nav-item[data-page="balances"]');
  await page.click('[data-bact="tab"][data-id="debtors"]');
  await page.click('[data-bact="settle"]');
  await quickSubmit();
  const bal = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_customers"))[0].balance);
  check("debt settled", bal === 0, bal);

  // 5) A second order, paid fully by card
  await newOrder("Ali", "33001122", ["shirt"]);
  await pay(1, "card", "0.2");

  // 6) Expense 0.100 cash
  await page.click('.nav-item[data-page="finance"]');
  await page.click("#addExpenseBtn");
  await page.fill("#qf_amount", "0.1");
  await quickSubmit();

  // 6b) Third order paid 0.200 cash, then cancelled with a cash refund → must not change sales or drawer
  await newOrder("Ali", "33001122", ["shirt"]);
  await pay(1, "cash", "0.2");
  await page.click('.nav-item[data-page="orders"]');
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await page.click("#cancelOrderBtn");
  await page.fill("#qf_reason", "test cancel");
  await page.selectOption("#qf_refund", "cash");
  await quickSubmit();
  if (await page.isVisible("#closeOrderDialog2")) await page.click("#closeOrderDialog2");
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")));
  check("cancelled order has a recorded cash refund", orders[0].status === "cancelled" && orders[0].refund && orders[0].refund.amount === 0.2, JSON.stringify(orders[0].refund));

  // Expected truth: sales 1.000, cash collected 0.500+0.300 cash + 0.200 card = 1.000,
  // receivables 0, expenses 0.100, profit 0.900, expected drawer cash 0.700
  const text = async (sel) => (await page.textContent(sel)) || "";
  await page.click('.nav-item[data-page="dashboard"]');
  const dash = await text("#metricsGrid");
  console.log("\nDASHBOARD:\n" + dash.replace(/\s+/g, " ").trim());
  await page.click('.nav-item[data-page="closures"]');
  const cls = await text("#dailyClosurePreview");
  console.log("\nDAILY CLOSURE:\n" + cls.replace(/\s+/g, " ").trim());
  await page.click('.nav-item[data-page="reports"]');
  const rep = await text("#reportContent");
  console.log("\nREPORTS:\n" + rep.replace(/\s+/g, " ").trim());

  if (process.env.EXPECT_FIXED) {
    const norm = (s) => s.replace(/\s+/g, " ");
    check("dashboard shows sales 1.000", /1\.000/.test(norm(dash)));
    check("closure expected cash 0.700", /0\.700/.test(norm(cls)), norm(cls));
  }

  // 6c) Approve the daily closure, then try again → must be blocked (no duplicate closures)
  await page.click('.nav-item[data-page="closures"]');
  await page.click("#closeDayBtn");
  await page.fill("#qf_cash", "0.7");
  await quickSubmit();
  await page.click("#closeDayBtn");
  await page.waitForTimeout(200);
  const closures = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_closures")));
  check("daily closure saved once with zero difference", closures.length === 1 && closures[0].variance === 0, JSON.stringify(closures.map((c) => [c.forDate, c.cashExpected, c.variance])));

  // 6d) Edit an unpaid order: 1 shirt → 3 shirts → total recalculated to 0.600, edit logged
  await newOrder("Ali", "33001122", ["shirt"]);
  await page.click('.nav-item[data-page="orders"]');
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await page.click("#editOrderBtn");
  await page.fill("#qf_q0", "3");
  await page.fill("#qf_reason", "customer added pieces");
  await quickSubmit();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")));
  check("edited order total recalculated", orders[0].payment.total === 0.6 && orders[0].items[0].qty === 3 && orders[0].editHistory.length === 1, orders[0].payment.total);
  if (await page.isVisible("#closeOrderDialog2")) await page.click("#closeOrderDialog2");

  // 6e) Pay later: mark ready without payment, then collect cash + deliver at pickup
  await newOrder("Ali", "33001122", ["shirt", "shirt"]);
  await page.click('.nav-item[data-page="orders"]');
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await page.click("#advanceStatusBtn");
  await page.selectOption("#qf_method", "later");
  await quickSubmit();
  await quickCancelIfOpen();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")));
  check("pay later: order ready and unpaid", orders[0].status === "ready" && orders[0].paymentConfirmed === false && orders[0].payLater === true);
  await page.click("#advanceStatusBtn");
  await quickSubmit(); // empty piece count → must show a visible error inside the form
  const errText = await page.textContent("#quickFormError");
  const onTop = await page.evaluate(() => { const r = document.getElementById("quickFormError").getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && el.id === "quickFormError"; });
  check("empty count shows a visible error message", !!errText && onTop, errText);
  await page.fill("#qf_count", "2");
  await page.selectOption("#qf_method", "cash");
  await quickSubmit();
  await quickCancelIfOpen();
  // delivery opens the receipt for WhatsApp (copy image + chat, or the preview when copying is blocked) — close it
  await page.waitForTimeout(300); await page.evaluate(() => { const d = document.getElementById("receiptPreviewDialog"); if (d && d.open) d.close(); });
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")));
  check("pay later: collected and delivered at pickup", orders[0].status === "delivered" && orders[0].paymentConfirmed && orders[0].payment.paid === 0.4, JSON.stringify([orders[0].status, orders[0].payment.paid]));
  if (await page.isVisible("#closeOrderDialog2")) await page.click("#closeOrderDialog2");

  // 6f) Customer file: all of Ali's orders with paid / remaining
  // Ali: 0.800 (debt later settled) + 0.200 card + cancelled + 0.600 unpaid in progress + 0.400 paid at pickup
  await page.click('.nav-item[data-page="customers"]');
  await page.click('#customersBody [data-profile]');
  const prof = (await page.textContent("#customerProfileContent")).replace(/\s+/g, " ");
  const rowsCount = await page.$$eval("#customerProfileContent .cp-order", (r) => r.length);
  check("customer file lists all 5 orders", rowsCount === 5, rowsCount);
  check("customer file: purchases 1.400, paid 1.400, in progress 0.600, owes 0.000",
    /إجمالي المشتريات ?1\.400/.test(prof) && /إجمالي المدفوع ?1\.400/.test(prof) && /قيد التنفيذ ?0\.600/.test(prof) && /المستحق عليه الآن ?0\.000/.test(prof), prof.slice(0, 300));
  await page.click("#closeCustomerProfile");

  // 6g) Packages: define "Iron 2" (2 pieces, 0.500), sell to a new customer, consume via quick tap
  await page.click('.nav-item[data-page="settings"]');
  await page.click('[data-settings-tab="packages"]');
  await page.click("#addPackageDefBtn");
  await page.fill("#qf_name", "Iron 2");
  await page.selectOption("#qf_serviceType", "iron");
  await page.fill("#qf_pieceCount", "2");
  await page.fill("#qf_price", "0.5");
  await quickSubmit();
  await newOrder("Sara", "33445566", []); // creates the customer; empty cart → nothing saved
  await page.click("#posCancelBtn");
  await page.click('.nav-item[data-page="customers"]');
  await page.fill("#customerSearch", "Sara");
  await page.click("#customersBody tr:first-child [data-sell-package]");
  await quickSubmit();
  await quickCancelIfOpen(); // "send the package confirmation on WhatsApp?" → later
  await newOrder("Sara", "33445566", ["shirt", "shirt", "shirt"]);
  const pk = await page.evaluate(() => ({ cps: JSON.parse(localStorage.getItem("l997_customer_packages")), orders: JSON.parse(localStorage.getItem("l997_orders")), ledger: JSON.parse(localStorage.getItem("l997_ledger")) }));
  const sOrder = pk.orders[0];
  const pkgQty = sOrder.items.filter((i) => i.fromPackageId).reduce((a, i) => a + i.qty, 0);
  const paidQty = sOrder.items.filter((i) => !i.fromPackageId).reduce((a, i) => a + i.qty, 0);
  check("package covers 2 pieces, 3rd charged normally (0.200)", pkgQty === 2 && paidQty === 1 && sOrder.payment.total === 0.2, JSON.stringify([pkgQty, paidQty, sOrder.payment.total]));
  check("package balance now 0 and sale price recorded", pk.cps[0].remainingPieces === 0 && pk.ledger.some((t) => t.type === "package_purchase" && t.price === 0.5));
  await page.click('.nav-item[data-page="customers"]');
  await page.fill("#customerSearch", "Sara");
  await page.click("#customersBody tr:first-child [data-profile]");
  const pkText = (await page.textContent(".cp-packages")).replace(/\s+/g, " ");
  check("customer file shows package used 2 / left 0", /المستهلك ?2/.test(pkText) && /المتبقي ?0/.test(pkText) && !/لا يطابق/.test(pkText), pkText.slice(0, 200));
  await page.click("#closeCustomerProfile");

  // 6h) Package restricted to cotton thobes only: thobe from package, shirt charged normally
  await page.click('.nav-item[data-page="settings"]');
  await page.click('[data-settings-tab="packages"]');
  await page.click("#addPackageDefBtn");
  await page.fill("#qf_name", "Thobes 10");
  await page.selectOption("#qf_serviceType", "washiron");
  await page.fill("#qf_pieceCount", "10");
  await page.fill("#qf_price", "2.5");
  await page.click('#qf_garments [data-qf-group="__none"]');
  await page.check('#qf_garments input[value="thob_cotton"]');
  await quickSubmit();
  await newOrder("Huda", "33778899", []);
  await page.click("#posCancelBtn");
  await page.click('.nav-item[data-page="customers"]');
  await page.fill("#customerSearch", "Huda");
  await page.click("#customersBody tr:first-child [data-sell-package]");
  await page.selectOption("#qf_defId", await page.$eval("#qf_defId", (sel) => [...sel.options].find((o) => o.text.includes("Thobes 10")).value));
  await quickSubmit();
  await quickCancelIfOpen();
  await newOrder("Huda", "33778899", ["thob_cotton", "shirt"]);
  const hz = await page.evaluate(() => ({ cps: JSON.parse(localStorage.getItem("l997_customer_packages")), o: JSON.parse(localStorage.getItem("l997_orders"))[0] }));
  const thob = hz.o.items.find((i) => i.clothingId === "thob_cotton"), shirt = hz.o.items.find((i) => i.clothingId === "shirt");
  const hPkg = hz.cps.find((c) => c.name === "Thobes 10");
  check("thobe-only package: thobe from package, shirt charged 0.200", !!thob.fromPackageId && !shirt.fromPackageId && hz.o.payment.total === 0.2 && hPkg.remainingPieces === 9 && hPkg.garments.join() === "thob_cotton", JSON.stringify([thob.fromPackageId, shirt.fromPackageId, hz.o.payment.total, hPkg.remainingPieces, hPkg.garments]));

  // 6i) New order: WhatsApp confirmation is the only option (no Later, no close, Esc ignored)
  await page.click('.nav-item[data-page="new-order"]');
  await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122"); await page.waitForTimeout(100);
  await page.click("#customerResults [data-pick]");
  await page.click('#posProductGrid [data-cloth="shirt"]');
  await page.click("#posSaveOrderMainBtn"); await page.waitForTimeout(300);
  const later = await page.isVisible("#quickFormCancelBtn"), closeX = await page.isVisible("#closeQuickFormDialog");
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  const stillOpen = await page.isVisible("#quickFormSubmitBtn");
  const btn = await page.textContent("#quickFormSubmitBtn");
  check("order saved → WhatsApp confirmation is mandatory (no Later / close / Esc)", !later && !closeX && stillOpen && /واتساب/.test(btn), JSON.stringify([later, closeX, stillOpen]));
  await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200);
  // 6j) Search by order number: "2" puts order #00002 first; Enter opens it
  await page.click('.nav-item[data-page="orders"]');
  await page.fill("#orderSearch", "2");
  const first = await page.textContent("#ordersBody tr:nth-child(1) td:nth-child(1)");
  check("order search: exact number first", /#00002/.test(first), first);
  await page.press("#orderSearch", "Enter"); await page.waitForTimeout(200);
  check("Enter on an order number opens the order", /00002/.test(await page.textContent("#orderDialogContent h3")));
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  await page.fill("#orderSearch", "");

  // 7) Language persists across reload
  await page.selectOption("#langSelectTop", "en");
  await page.reload();
  await page.fill("#au_user", "owner").catch(() => {});
  const dir = await page.evaluate(() => document.documentElement.dir);
  check("English persists after reload (dir=ltr)", dir === "ltr", dir);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 5).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
