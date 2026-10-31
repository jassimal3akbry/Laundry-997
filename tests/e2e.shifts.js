// Shifts test: login = check-in with opening cash, money attributed to the employee, shift close with
// counted cash and variance reason, logout choice, handover check, money blocked without a shift,
// manager panel + force close, attendance days/hours on the employees page.
// Usage: node tests/e2e.shifts.js [path-to-html]
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
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await require("./fixed-prices")(page); // flow test: fixed test prices, independent of the shop's price list
  await page.goto(await serve(file));
  const OWNER_PW = "Owner#2026pass", W_PW = "Cashier#2026pass";
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const later = async () => { await page.waitForTimeout(250); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); } };
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeDialogs = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const shifts = () => page.evaluate(() => JSON.parse(localStorage.getItem("l997_shifts") || "[]"));
  const loginForm = async (u, p) => {
    await page.waitForSelector("#au_user"); await page.waitForTimeout(150);
    await page.fill("#au_user", u); await page.fill("#au_pass", p); await page.click("#au_form button[type=submit]");
  };

  // Owner setup, cashier account, one customer + two orders
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", OWNER_PW); await page.fill("#au_pw2", OWNER_PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  check("owner is not forced into a shift", !(await page.isVisible("#qf_opening")));
  // this suite covers shifts / cash custody: switch on "staff must start a shift" (off by default)
  await page.evaluate(() => document.querySelector('.nav-item[data-page="settings"]').click()); await page.click('[data-settings-tab="operating"]');
  check("shifts are optional and off by default", !(await page.isChecked("#shiftsRequiredSetting")));
  await page.check("#shiftsRequiredSetting"); await page.click("#saveSettingsBtn"); await page.waitForTimeout(250);

  await nav("access"); await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Cashier Ali"); await page.selectOption("#qf_role", "worker"); await page.fill("#qf_username", "ali");
  const tmp = await page.inputValue("#qf_password");
  await submit(); await later();
  const newOrder = async (first) => {
    await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122"); await page.waitForTimeout(100);
    if (first) { await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Customer"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn"); }
    else await page.click("#customerResults [data-pick]");
    for (const c of ["thob_cotton", "thob_cotton", "shirt"]) await page.click(`#posProductGrid [data-cloth="${c}"]`);
    await page.click("#posSaveOrderMainBtn"); await later();
  };
  await newOrder(true); await newOrder(false);

  // Cashier logs in → shift prompt → opening cash 10.000
  await closeDialogs(); await page.click("#logoutBtn");
  await loginForm("ali", tmp);
  await page.waitForSelector("#au_pw2"); await page.waitForTimeout(150); await page.fill("#au_pw", W_PW); await page.fill("#au_pw2", W_PW); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)");
  await page.waitForSelector("#qf_opening");
  check("login asks the employee to start the shift (check-in)", /بدء الوردية/.test(await page.textContent("#quickFormTitle")));
  await page.fill("#qf_opening", "10"); await submit();
  let sh = await shifts();
  check("shift opened with opening cash 10.000", sh.length === 1 && !sh[0].endAt && sh[0].openingCash === 10 && sh[0].employeeName === "Cashier Ali");
  check("shift indicator shown", /في الوردية منذ/.test(await page.textContent("#shiftChip")));

  // Cashier collects order 1 (0.800 cash) and a 5.000 cash deposit
  await nav("orders");
  await page.click("#ordersBody tr:nth-child(2) [data-view]"); await page.click("#advanceStatusBtn"); await submit(); await later(); await closeDialogs();
  // workers have no Balances page: the deposit is taken from the customer file
  await page.evaluate(() => window.openCustomerProfile997(JSON.parse(localStorage.getItem("l997_customers"))[0].id)); await page.click("#cpSettle");
  await page.fill("#qf_amount", "5"); await page.selectOption("#qf_notify", "no"); await submit(); await closeDialogs();
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")).find((x) => x.status === "ready"));
  const led = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_ledger")));
  const me = await page.evaluate(() => window.L997Auth.user().id);
  check("payment and deposit recorded under the cashier", o.paymentById === me && led.some((t) => t.type === "credit" && t.byId === me));

  // Logout → "close shift" → expected 10 + 0.8 + 5 = 15.800 ; counted 15 without reason refused, with reason saved
  await page.click("#logoutBtn");
  await page.waitForTimeout(200);
  check("logout with open shift asks: close or break", await page.isVisible("#qf_what"));
  await page.selectOption("#qf_what", "close"); await submit(); await page.waitForTimeout(300);
  const sub = await page.textContent("#quickFormSub");
  check("close form shows expected cash 15.800", /15\.800/.test(sub), sub.slice(-80));
  await page.fill("#qf_counted", "15"); await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250);
  sh = await shifts();
  check("difference without a reason is refused", !sh[0].endAt);
  await page.fill("#qf_note", "gave change"); await submit(); await page.waitForTimeout(500);
  sh = await shifts();
  check("shift closed: expected 15.800, counted 15.000, variance −0.800 (check-out)", sh[0].endAt && sh[0].expectedCash === 15.8 && sh[0].countedCash === 15 && sh[0].variance === -0.8, JSON.stringify([sh[0].expectedCash, sh[0].countedCash, sh[0].variance]));
  check("logged out after closing", await page.isVisible("#au_user"));

  // Next shift: handover check (opening must match 15.000 or have a note); skip → money blocked
  await loginForm("ali", W_PW);
  await page.waitForSelector("#qf_opening");
  check("start form shows the previous handover 15.000", /15\.000/.test(await page.textContent("#quickFormSub")));
  await page.click("#quickFormCancelBtn"); await page.waitForTimeout(200);
  await nav("orders");
  await page.click("#ordersBody tr:nth-child(1) [data-view]"); await page.click("#advanceStatusBtn"); await page.waitForTimeout(400);
  check("money action without a shift is blocked and asks to start the shift", /بدء الوردية/.test(await page.textContent("#quickFormTitle")));
  await page.fill("#qf_opening", "14"); await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250);
  check("opening different from handover needs a note", (await shifts()).filter((x) => !x.endAt).length === 0);
  await page.fill("#qf_note", "owner took 1"); await submit();
  check("second shift opened", (await shifts()).filter((x) => !x.endAt).length === 1);
  await closeDialogs();
  // break logout keeps the shift open
  await page.click("#logoutBtn"); await page.waitForTimeout(200);
  await page.selectOption("#qf_what", "break"); await submit(); await page.waitForTimeout(300);
  check("break logout keeps the shift open", (await shifts()).filter((x) => !x.endAt).length === 1 && (await page.isVisible("#au_user")));

  // Owner: shifts panel + force close of the open shift
  await loginForm("owner", OWNER_PW);
  await page.waitForSelector("body:not(.auth-locked)");
  await nav("closures");
  const panel = (await page.textContent("#shiftsPanel")).replace(/\s+/g, " ");
  check("manager sees both shifts with the −0.800 difference", /Cashier Ali/.test(panel) && /-0\.800/.test(panel) && /مفتوحة/.test(panel), panel.slice(0, 200));
  await page.click("[data-force-close]"); await page.waitForTimeout(250);
  await page.fill("#qf_counted", "14"); await submit();
  sh = await shifts();
  check("manager can close a forgotten shift", sh.every((x) => x.endAt) && sh[0].forced === true && sh[0].closedBy === "Owner");

  // Attendance from shifts on the employees page
  await nav("employees");
  const pay = (await page.textContent("#payrollSummary")).replace(/\s+/g, " ");
  check("attendance counted from shifts", /Cashier Ali \(حضور 1 يوم/.test(pay), pay.slice(0, 160));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL SHIFT CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
