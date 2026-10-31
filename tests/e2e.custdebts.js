// Customers page: who owes the shop money, since when, and when they last paid; worker accounts open on the
// new-order screen with no home page and no balances page.
// Usage: node tests/e2e.custdebts.js [path-to-html]
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await require("./fixed-prices")(page); // shirt wash & iron 0.200
  await page.goto(await serve(file));
  const PW = "Owner#2026pass", WPW = "Worker#2026pw";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const later = async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); };
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  async function order(name, phone, shirts) {
    await closeAll(); await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(150);
    await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", name); await page.fill("#customerPhone", phone); await page.click("#saveCustomerBtn");
    for (let i = 0; i < shirts; i++) await page.click('#posProductGrid [data-cloth="shirt"]');
    await page.click("#posSaveOrderMainBtn"); await wait(400); await later(); await closeAll();
    return (await ls("l997_orders"))[0];
  }
  async function ready(id, method, paid) {
    await closeAll(); await nav("orders"); await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id);
    await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", method); if (paid !== undefined) await page.fill("#qf_paid", String(paid));
    await submit(); await later(); await closeAll();
  }
  // move an order's dates (and its ledger entries) into the past, as if it happened N days ago
  const ageOrder = (id, days) => page.evaluate(([id, days]) => {
    const t = new Date(Date.now() - days * 86400000).toISOString();
    const os = JSON.parse(localStorage.getItem("l997_orders")); const o = os.find((x) => x.id === id);
    ["createdAt", "paidAt", "readyAt"].forEach((k) => { if (o[k]) o[k] = t; }); localStorage.setItem("l997_orders", JSON.stringify(os));
    const l = JSON.parse(localStorage.getItem("l997_ledger") || "[]"); l.forEach((tx) => { if (tx.orderId === id) tx.at = t; }); localStorage.setItem("l997_ledger", JSON.stringify(l));
  }, [id, days]);

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  const o1 = await order("Old Debt", "33111001", 5); await ready(o1.id, "cash", 0.4);   // 1.000, paid 0.400 → owes 0.600, 40 days ago
  const o2 = await order("Never Paid", "33111002", 10); await ready(o2.id, "unpaid");    // 2.000 on credit, 5 days ago
  const o3 = await order("All Paid", "33111003", 5); await ready(o3.id, "cash", 1);      // nothing owed
  const o4 = await order("Pickup Due", "33111004", 4); await ready(o4.id, "later");      // 0.800 due on pickup, 20 days ago
  await ageOrder(o1.id, 40); await ageOrder(o2.id, 5); await ageOrder(o4.id, 20);
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)");

  await nav("customers"); await wait(200);
  await page.selectOption("#customerFilter", "owes"); await wait(200);
  const rows = await page.$$eval("#customersBody tr", (trs) => trs.map((tr) => tr.textContent.replace(/\s+/g, " ")));
  check("filter 'owe the shop money' lists exactly the 3 customers who owe", rows.length === 3 && !rows.some((r) => /All Paid/.test(r)), rows.map((r) => r.slice(0, 20)).join(" | "));
  const sum = (await page.textContent("#customerDebtSummary")).replace(/\s+/g, " ");
  check("summary: 3 customers, total 3.400, 1 over 30 days", /3 عميل/.test(sum) && /3\.400/.test(sum) && /1 أكثر من 30/.test(sum), sum);
  const row = (n) => rows.find((r) => r.includes(n)) || "";
  check("Old Debt: owes 0.600 for 40 days, last payment 40 days ago", /0\.600/.test(row("Old Debt")) && /40 يوم/.test(row("Old Debt")) && /منذ 40 يوم/.test(row("Old Debt")), row("Old Debt"));
  check("Never Paid: owes 2.000 for 5 days, never paid", /2\.000/.test(row("Never Paid")) && /5 يوم/.test(row("Never Paid")) && /لم يدفع بعد/.test(row("Never Paid")), row("Never Paid"));
  check("Pickup Due: 0.800 due on pickup for 20 days", /0\.800/.test(row("Pickup Due")) && /20 يوم/.test(row("Pickup Due")), row("Pickup Due"));
  await page.selectOption("#customerSort", "oldest"); await wait(150);
  let order1 = await page.$$eval("#customersBody tr", (trs) => trs.map((tr) => (tr.querySelector("strong") || {}).textContent));
  check("sort 'oldest debt first': 40 → 20 → 5 days", order1.join(",") === "Old Debt,Pickup Due,Never Paid", order1.join(","));
  await page.selectOption("#customerSort", "largest"); await wait(150);
  order1 = await page.$$eval("#customersBody tr", (trs) => trs.map((tr) => (tr.querySelector("strong") || {}).textContent));
  check("sort 'largest debt first': 2.000 → 0.800 → 0.600", order1.join(",") === "Never Paid,Pickup Due,Old Debt", order1.join(","));
  await page.fill("#customerSearch", "3311100"); await wait(150);
  check("search by phone works together with the filter", (await page.$$("#customersBody tr")).length === 3);
  await page.fill("#customerSearch", "Never"); await wait(150);
  check("search by name within debtors", (await page.$$("#customersBody tr")).length === 1);
  await page.fill("#customerSearch", ""); await page.selectOption("#customerFilter", "all"); await wait(150);
  check("'all customers' shows everyone again (4)", (await page.$$("#customersBody tr")).length === 4);
  check("owner still has the home page and balances", await page.isVisible('.nav-item[data-page="dashboard"]') && await page.isVisible('.nav-item[data-page="balances"]'));

  /* worker */
  await nav("access"); await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Worker"); await page.selectOption("#qf_role", "worker"); await page.fill("#qf_username", "worker1");
  const tmp = await page.inputValue("#qf_password"); await submit(); await later(); await closeAll();
  await page.click("#logoutBtn"); await wait(300);
  await page.fill("#au_user", "worker1"); await page.fill("#au_pass", tmp); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("#au_pw2"); await wait(150); await page.fill("#au_pw", WPW); await page.fill("#au_pw2", WPW); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)"); await wait(500); await closeAll();
  check("worker opens on the new-order screen", await page.evaluate(() => document.getElementById("page-new-order").classList.contains("active")));
  check("worker has no home page and no balances page in the menu", !(await page.isVisible('.nav-item[data-page="dashboard"]')) && !(await page.isVisible('.nav-item[data-page="balances"]')));
  await page.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click()); await wait(200);
  check("…and cannot open the home page another way", !(await page.evaluate(() => document.getElementById("page-dashboard").classList.contains("active"))));
  await nav("customers"); await page.selectOption("#customerFilter", "owes"); await wait(200);
  check("worker can see who owes money on the customers page", (await page.$$("#customersBody tr")).length === 3);
  const c1 = (await ls("l997_customers")).find((c) => c.name === "Old Debt");
  await page.evaluate((id) => window.openCustomerProfile997(id), c1.id); await wait(200);
  check("worker can collect a payment from the customer file; no statement link to balances", await page.isVisible("#cpSettle") && !(await page.isVisible("#cpStatement")));
  await closeAll();
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)"); await wait(400);
  check("after refresh the worker is still not on the home page", !(await page.evaluate(() => document.getElementById("page-dashboard").classList.contains("active"))));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CUSTOMER-DEBT CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
