// Month-end test: categorised expenses, salary advance (cash out), one-click salary run (no double pay),
// monthly report totals by group, daily closure with variance reason, month closure guard.
// Usage: node tests/e2e.month.js [path-to-html]
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
  await require("./fixed-prices")(page); // flow test: fixed test prices, independent of the shop's price list
  await page.goto(await serve(file));
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", "Owner#2026pass"); await page.fill("#au_pw2", "Owner#2026pass");
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const later = async () => { await page.waitForTimeout(250); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); } };
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const exps = () => page.evaluate(() => JSON.parse(JSON.stringify(window.L997Enterprise.data.expenses)));
  const text = async (sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ");

  // Employee (payroll only): salary 300, commission 20
  await nav("employees");
  await page.click("#addEmployeeBtn");
  await page.fill("#qf_name", "Ahmed"); await page.selectOption("#qf_login", "no");
  await page.fill("#qf_salary", "300"); await page.fill("#qf_commission", "20");
  await submit();
  // Bonus 15, advance 50 cash
  const payrollTx = async (type, amount) => {
    await page.click("#addPayrollTxBtn");
    await page.selectOption("#qf_type", type); await page.fill("#qf_amount", String(amount)); await page.selectOption("#qf_method", "cash");
    await submit();
  };
  await payrollTx("bonus", 15);
  await payrollTx("advance", 50);
  let e = await exps();
  check("salary advance recorded as a cash expense (salaries group)", e.length === 1 && e[0].catId === "advance" && e[0].amount === 50 && e[0].method === "cash");

  // Categorised expenses: rent 200 by transfer, LMRA 25 cash
  const expense = async (catId, amount, method) => {
    await nav("finance"); await page.click("#addExpenseBtn");
    await page.selectOption("#qf_catId", catId); await page.fill("#qf_amount", String(amount)); await page.selectOption("#qf_method", method);
    await submit();
  };
  await expense("rent", 200, "bank_transfer");
  await expense("lmra", 25, "cash");
  e = await exps();
  check("expenses saved with category and group", e.some((x) => x.catId === "lmra" && x.group === "government") && e.some((x) => x.catId === "rent" && x.group === "operating"));

  // One order 0.800 paid cash
  await nav("new-order");
  await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122");
  await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Ali"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn");
  for (const c of ["thob_cotton", "thob_cotton", "shirt"]) await page.click(`#posProductGrid [data-cloth="${c}"]`);
  await page.click("#posSaveOrderMainBtn"); await later();
  await nav("orders"); await page.click("#ordersBody tr:nth-child(1) [data-view]"); await page.click("#advanceStatusBtn");
  await submit(); await later();
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));

  // Salary run: net = 300 + 20 + 15 − 50 = 285 ; second run must pay nothing
  await nav("employees");
  await page.click("#payMonthSalariesBtn");
  const currentMonth = await page.inputValue("#qf_month");
  const previousMonth = await page.evaluate(() => {
    const F = window.L997Finance;
    return F.addDays(F.monthBounds(F.todayStr()).from, -1).slice(0, 7);
  });
  await page.fill("#qf_month", previousMonth);
  await page.locator("#qf_month").dispatchEvent("change");
  check("payroll preview follows the selected month and its adjustments", (await text("#quickFormSub")).includes(previousMonth) && /320\.000/.test(await text("#quickFormSub")));
  await page.fill("#qf_month", currentMonth);
  await page.selectOption("#qf_method", "bank_transfer");
  await submit();
  e = await exps();
  const sal = e.find((x) => x.catId === "salary");
  check("salary run pays net 285.000 once, linked to employee and month", sal && sal.amount === 285 && sal.employeeId && /^\d{4}-\d{2}$/.test(sal.period), sal && sal.amount);
  await page.click("#payMonthSalariesBtn"); await submit();
  const err2 = await page.textContent("#quickFormError");
  e = await exps();
  check("second salary run refused (no double pay)", e.filter((x) => x.catId === "salary").length === 1 && /لا توجد رواتب/.test(err2), err2);
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const paySum = await text("#payrollSummary");
  check("employees page shows salary paid ✓", /✓ صُرف/.test(paySum), paySum.slice(0, 120));

  // Settings tab click must not blank the reports page (regression)
  await nav("settings"); await page.click('[data-settings-tab="packages"]');
  await nav("reports");
  check("reports page not blank after using settings tabs", (await text("#reportContent")).length > 50);

  // Monthly report: salaries 335 (285 + 50 advance), government 25, operating 200, total 560, profit 0.8 − 560 = −559.200
  await page.click('#reportTypeTabs [data-report="monthly"]');
  const rep = await text("#reportContent");
  check("monthly report: salaries 335, government 25, operating 200", /الرواتب والأجور ?335\.000/.test(rep) && /الجهات الحكومية والرسوم ?25\.000/.test(rep) && /مصروفات تشغيل المحل ?200\.000/.test(rep), rep.slice(0, 300));
  check("monthly report: salary per employee and LMRA line", /Ahmed ?335\.000/.test(rep) && /هيئة تنظيم سوق العمل \(LMRA\) ?25\.000/.test(rep));
  check("monthly report: total expenses 560, net profit −559.200", /إجمالي المصروفات ?560\.000/.test(rep) && /صافي الربح ?-559\.200/.test(rep));
  await page.click("#monthlyReportPrint");
  const printed = await page.evaluate(() => document.getElementById("printReceipt").textContent.length);
  check("monthly report prints", printed > 200);

  // Daily closure: drawer = 0.800 cash sale − 50 advance − 25 LMRA = −74.200 ; difference needs a reason
  await nav("closures");
  const cls = await text("#dailyClosurePreview");
  check("drawer = −74.200 (cash only)", /-74\.200/.test(cls), cls.slice(-80));
  await page.click("#closeDayBtn");
  await page.fill("#qf_cash", "0");
  await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250);
  let closures = await page.evaluate(() => JSON.parse(JSON.stringify(window.L997Enterprise.data.closures)));
  check("closure with a difference and no reason is refused", closures.length === 0);
  await page.fill("#qf_note", "advance paid from owner pocket");
  await submit();
  closures = await page.evaluate(() => JSON.parse(JSON.stringify(window.L997Enterprise.data.closures)));
  check("closure saved with variance 74.200 and its reason", closures.length === 1 && closures[0].variance === 74.2 && /owner/.test(closures[0].varianceNote), JSON.stringify(closures.map((c) => [c.variance, c.varianceNote])));

  // Month closure for the running month is refused
  await page.click("#closeMonthBtn"); await page.waitForTimeout(250);
  closures = await page.evaluate(() => JSON.parse(JSON.stringify(window.L997Enterprise.data.closures)));
  check("current month cannot be closed before it ends", closures.filter((c) => c.type === "monthly").length === 0);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL MONTH-END CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
