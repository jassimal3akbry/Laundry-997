// Operations test: inventory purchases / usage / credit purchases / void guard, low-stock alert,
// employees bonus → profit, and that expenses flow into the cash drawer.
// Usage: node tests/e2e.ops.js [path-to-html]
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
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  // known starting stock for the cost/alert math below (the app itself starts every material at zero)
  await page.addInitScript(() => { if (!localStorage.getItem("l997_inventory")) localStorage.setItem("l997_inventory", JSON.stringify([{ id: "det-fixture", name: "مسحوق غسيل", unit: "كجم", category: "detergent", qty: 12, minQty: 5, targetQty: 30, avgCost: 1.8 }])); });
  await page.goto(await serve(file));
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", "Owner#2026pass"); await page.fill("#au_pw2", "Owner#2026pass");
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const inv = () => page.evaluate(() => JSON.parse(JSON.stringify(window.L997Enterprise.data.inventory)));
  const exps = () => page.evaluate(() => JSON.parse(JSON.stringify(window.L997Enterprise.data.expenses)));

  // Starting stock (test fixture): detergent 12 kg @ 1.800, minimum 5
  let items = await inv();
  const det = items.find((i) => i.name === "مسحوق غسيل");
  check("starting inventory present", det && det.qty === 12 && det.minQty === 5);

  // 1) Paid purchase: 10 kg @ 2.000 cash → stock 22, average cost (12×1.8 + 20) / 22 = 1.8909, expense 20.000
  await nav("inventory");
  await page.click('[data-act="tab"][data-id="purchases"]');
  await page.click('[data-act="addp"]');
  await page.selectOption("#qf_inventoryId", det.id);
  await page.fill("#qf_qty", "10"); await page.fill("#qf_unitCost", "2");
  await submit();
  items = await inv();
  let d = items.find((i) => i.id === det.id);
  let e = await exps();
  check("paid purchase adds stock and average cost", d.qty === 22 && Math.abs(d.avgCost - 1.8909) < 0.0001, `${d.qty} @ ${d.avgCost}`);
  check("paid purchase creates a 20.000 cash expense", e.length === 1 && e[0].amount === 20 && e[0].method === "cash", JSON.stringify(e.map((x) => [x.amount, x.method])));

  // 2) Use 20 kg → 2 left (below minimum 5); using 5 more must be refused
  const useItem = async (qty) => {
    await nav("inventory");
    await page.click('[data-act="tab"][data-id="items"]');
    await page.click(`[data-act="use"][data-id="${det.id}"]`);
    await page.fill("#qf_qty", String(qty));
    await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250);
  };
  await useItem(20);
  await useItem(5);
  const errMsg = await page.textContent("#quickFormError").catch(() => "");
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((x) => x.close()));
  d = (await inv()).find((i) => i.id === det.id);
  check("usage reduces stock; over-use refused with a message", d.qty === 2 && !!errMsg, `${d.qty} / "${errMsg}"`);

  // 3) Voiding the 10 kg purchase must be refused (only 2 kg left)
  page.once("dialog", (dl) => dl.accept());
  await nav("inventory");
  await page.click('[data-act="tab"][data-id="purchases"]').catch(() => {});
  const canVoid = await page.isVisible('[data-act="voidpur"]');
  if (canVoid) {
    await page.click('[data-act="voidpur"]');
    await page.waitForTimeout(200);
    if (await page.isVisible("#quickFormSubmitBtn")) await submit();
  }
  e = await exps();
  d = (await inv()).find((i) => i.id === det.id);
  check("void refused when stock already used (expense kept)", canVoid && e.length === 1 && d.qty === 2, `${e.length} expenses, qty ${d.qty}`);
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((x) => x.close()));

  // 4) Credit purchase 5 kg @ 1.000 → no expense until paid; then pay by card → expense 5.000 (card)
  await nav("inventory");
  await page.click('[data-act="tab"][data-id="purchases"]');
  await page.click('[data-act="addp"]');
  await page.selectOption("#qf_inventoryId", det.id);
  await page.fill("#qf_qty", "5"); await page.fill("#qf_unitCost", "1");
  await page.selectOption("#qf_pstatus", "credit");
  await submit();
  e = await exps();
  check("credit purchase: stock in, no expense yet", e.length === 1 && (await inv()).find((i) => i.id === det.id).qty === 7);
  await nav("inventory");
  await page.click('[data-act="tab"][data-id="purchases"]').catch(() => {});
  await page.click('[data-act="paypur"]');
  await page.selectOption("#qf_method", "card");
  await submit();
  e = await exps();
  check("paying the credit purchase records a 5.000 card expense", e.length === 2 && e[0].amount === 5 && e[0].method === "card", JSON.stringify(e.map((x) => [x.amount, x.method])));

  // 5) Dashboard shows a low-stock alert for packaging? (detergent now 7 > 5 → no); consume to 3 → alert
  await useItem(4);
  await nav("dashboard");
  const att = await page.textContent("#attentionList");
  check("dashboard low-stock alert", /مخزون منخفض: مسحوق غسيل/.test(att), att.replace(/\s+/g, " ").slice(0, 120));

  // 6) Employee bonus 10.000 → staff costs in P&L; expected drawer = −20.000 (cash purchase only)
  await nav("employees");
  await page.click("#addPayrollTxBtn");
  await page.selectOption("#qf_type", "bonus");
  await page.fill("#qf_amount", "10");
  await submit();
  await nav("reports");
  await page.click('[data-report="pnl"]');
  const pnl = (await page.textContent("#reportContent")).replace(/\s+/g, " ");
  // a bonus is part of the salary paid later — it is not a second cost: profit = 0 − 25.000 stock purchases
  check("P&L: expenses 25.000 (stock purchases), profit −25.000", /المصروفات ?25\.000/.test(pnl) && /الربح التقديري ?-25\.000/.test(pnl) && /مشتريات المخزون ?25\.000/.test(pnl), pnl.slice(0, 260));
  await nav("closures");
  const cls = (await page.textContent("#dailyClosurePreview")).replace(/\s+/g, " ");
  check("drawer counts only cash expenses (−20.000)", /-20\.000/.test(cls), cls);

  // 6b) A mistyped 99.000 cash expense is cancelled with a reason → drawer back to −20.000
  await nav("finance");
  await page.click("#addExpenseBtn");
  await page.fill("#qf_amount", "99");
  await submit();
  await page.click('#expenseList [data-void-exp]');
  await page.fill("#qf_reason", "typo");
  await submit();
  e = await exps();
  await nav("closures");
  const cls2 = (await page.textContent("#dailyClosurePreview")).replace(/\s+/g, " ");
  check("cancelled expense kept for audit but excluded from drawer", e[0].voided === true && e[0].voidReason === "typo" && /-20\.000/.test(cls2), cls2.slice(-60));

  // 7) Stock movement history records every step
  const moves = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_stock_moves")));
  // the refused over-use is not a movement → purchase, use, purchase, use
  check("stock history: purchase, use, purchase, use", moves.filter((m) => m.itemId === det.id && m.type !== "opening").map((m) => m.type).reverse().join(",") === "purchase,out,purchase,out", moves.map((m) => m.type).join(","));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL OPERATIONS CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
