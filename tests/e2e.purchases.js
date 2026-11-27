// Purchases: a purchase entered by mistake can be corrected (quantity / unit price) or voided; stock, average cost
// and the linked expense follow; a purchase already partly used cannot be voided or reduced below what was used.
// Usage: node tests/e2e.purchases.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { if (!localStorage.getItem("l997_inventory")) localStorage.setItem("l997_inventory", JSON.stringify([{ id: "soap", name: "صابون", unit: "لتر", category: "detergent", qty: 0, minQty: 2, targetQty: 20, avgCost: 0 }, { id: "bags", name: "Bags", unit: "pack", qty: 10, avgCost: 2, supplierId: "supplier" }])); if (!localStorage.getItem("l997_suppliers")) localStorage.setItem("l997_suppliers", JSON.stringify([{ id: "supplier", name: "Test Supplier" }])); });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), k);
  const soap = async () => (await ls("l997_inventory")).find((i) => i.id === "soap");
  const tab = async (t) => { await closeAll(); await nav("dashboard"); await nav("inventory"); await page.click(`[data-act="tab"][data-id="${t}"]`); await wait(150); };
  const buy = async (qty, cost) => { await tab("purchases"); await page.click('[data-act="addp"]'); await page.selectOption("#qf_inventoryId", "soap"); await page.fill("#qf_qty", String(qty)); await page.fill("#qf_unitCost", String(cost)); await submit(); await closeAll(); return (await ls("l997_purchases"))[0]; };
  const edit = async (id, qty, cost, reason) => { await tab("purchases"); await page.click(`[data-act="editpur"][data-id="${id}"]`); await page.fill("#qf_qty", String(qty)); await page.fill("#qf_unitCost", String(cost)); await page.fill("#qf_reason", reason); await submit(); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  await tab("purchases"); await page.click('[data-act="addp"]');
  await page.selectOption("#qf_inventoryId", "bags");
  check("switching material loads its own unit cost and supplier",
    (await page.inputValue("#qf_unitCost")) === "2" && (await page.inputValue("#qf_supplierId")) === "supplier");
  await page.selectOption("#qf_inventoryId", "soap");
  check("switching to an unpriced material clears the previous defaults",
    (await page.inputValue("#qf_unitCost")) === "" && (await page.inputValue("#qf_supplierId")) === "");
  await closeAll();

  // 1) wrong entry: 10 L soap @ 1.000 (should have been 6) — then 3 L used
  const p1 = await buy(10, 1);
  check("purchase recorded: stock 10, expense 10.000", (await soap()).qty === 10 && (await ls("l997_expenses"))[0].amount === 10);
  await tab("items"); await page.click('[data-act="use"][data-id="soap"]'); await page.fill("#qf_qty", "3"); await submit(); await closeAll();
  check("3 L used: stock 7", (await soap()).qty === 7);

  // 2) voiding the whole purchase is refused (part of it was used), with a clear way out
  await tab("purchases"); await page.click(`[data-act="voidpur"][data-id="${p1.id}"]`); await submit();
  const msg = await page.evaluate(() => [...document.querySelectorAll("[class*=toast], #toast")].map((e) => e.textContent).join(" "));
  check("void refused because part was used; message points to 'Edit'", !(await ls("l997_purchases"))[0].voided && /تعديل/.test(msg), msg.slice(0, 90));
  await closeAll();

  // 3) edit 10 → 6 L: stock 7 − 4 = 3, expense 6.000, change recorded
  await edit(p1.id, 6, 1, "wrong quantity entered"); await closeAll();
  let p = (await ls("l997_purchases"))[0], s = await soap(), ex = (await ls("l997_expenses"))[0];
  check("edit 10 → 6 L: stock 3, purchase 6.000, linked expense 6.000", s.qty === 3 && p.qty === 6 && p.total === 6 && ex.amount === 6, JSON.stringify([s.qty, p.total, ex.amount]));
  check("edit kept who/when/why and the values before", p.edits && p.edits.length === 1 && p.edits[0].before.qty === 10 && p.edits[0].reason === "wrong quantity entered" && p.edits[0].by === "Owner");
  check("stock movement and activity log record the correction", (await ls("l997_stock_moves")).some((m) => m.ref === p1.id && m.qty === -4) && (await ls("l997_audit")).some((a) => /تعديل شراء مخزون/.test(a.action || "")));

  // 4) cannot reduce below what was already used (3 L used → at least 3)
  await edit(p1.id, 2, 1, "too low");
  check("reducing to 2 L refused (3 L already used)", (await ls("l997_purchases"))[0].qty === 6 && (await soap()).qty === 3);
  await closeAll();

  // 5) price correction: 6 L @ 1.500 = 9.000; average cost follows
  await edit(p1.id, 6, 1.5, "price was 1.500"); await closeAll();
  p = (await ls("l997_purchases"))[0]; s = await soap(); ex = (await ls("l997_expenses"))[0];
  check("price 1.000 → 1.500: purchase 9.000, expense 9.000, average cost 1.500", p.total === 9 && ex.amount === 9 && Math.abs(s.avgCost - 1.5) < 0.0001, JSON.stringify([p.total, ex.amount, s.avgCost]));

  // 6) a purchase not used yet can still be voided completely
  const p2 = await buy(4, 2);
  await tab("purchases"); await page.click(`[data-act="voidpur"][data-id="${p2.id}"]`); await submit(); await closeAll();
  const v = (await ls("l997_purchases")).find((x) => x.id === p2.id);
  check("unused purchase voided: stock back to 3, its expense removed", v.voided && (await soap()).qty === 3 && !(await ls("l997_expenses")).some((e) => e.purchaseId === p2.id));
  // the month's expenses equal the corrected purchase only
  const exp = await page.evaluate(() => { const F = window.L997Finance, t = F.todayStr(); return F.summarize({ orders: [], ledger: [], customers: [], expenses: JSON.parse(localStorage.getItem("l997_expenses")), customerPackages: [] }, t, t).expenses; });
  check("today's expenses = 9.000 (corrected soap purchase only)", exp === 9, exp);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PURCHASE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
