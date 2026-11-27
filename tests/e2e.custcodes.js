// Customer-only discount codes: the 8 built-in codes exist but work for nobody until the owner picks customers;
// a code works only for its customers (case-insensitive, Arabic digits ok), 100% makes the order free, a fixed
// piece-price code caps each piece, the code is suggested when its customer is picked, and it is removed if the
// customer is changed to someone else. Usage: node tests/e2e.custcodes.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {}; window.open = () => ({ closed: false });
    if (localStorage.getItem("l997_customers")) return;
    const now = new Date().toISOString();
    localStorage.setItem("l997_customers", JSON.stringify([
      { id: "c_nawaf", name: "نواف", phone: "97333110001", balance: 0, createdAt: now },
      { id: "c_other", name: "Other Guy", phone: "97333110002", balance: 0, createdAt: now },
      { id: "c_yad", name: "بيت يدتي", phone: "97333110003", balance: 0, createdAt: now }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const pick = async (phone) => { await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(200); await page.click("#customerResults [data-pick]"); await wait(150); };
  const fresh = async () => { await closeAll(); await nav("new-order"); await wait(150); while (await page.$("#orderItemsBody [data-remove]")) { await page.click("#orderItemsBody [data-remove]"); await wait(50); } };
  const code = async (c) => { await page.fill("#discountCode", c); await page.click("#applyCodeBtn"); await wait(150); };
  const total = () => page.textContent("#summaryTotal");
  const save = async () => { await page.click("#posSaveOrderMainBtn"); await wait(400); await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); await closeAll(); return (await ls("l997_orders"))[0]; };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  const codes = (await ls("l997_settings")).discountCodes;
  const want = { NAWAF: 45, BMJ11: 35, FAMILY: 35, MYHOME: 75, "997CLS": 20, "997FAR": 15, DDOSERI: 35, YADATI: 100 };
  check("the 8 requested codes exist with the right %, customer-only, nobody assigned yet",
    Object.entries(want).every(([k, v]) => codes.some((c) => c.code === k && c.percent === v && c.scope === "customers" && c.customerIds.length === 0)), JSON.stringify(codes.map((c) => [c.code, c.percent, c.scope])));

  // before assigning: the code is refused even for Nawaf
  await fresh(); await pick("33110001"); await page.click('#posProductGrid [data-cloth="shirt"]'); await code("nawaf");
  check("unassigned customer code is refused", !(await page.isVisible("#removeCodeBtn")) && /0\.400/.test(await total()), await total());

  // owner assigns Nawaf from Settings → Packages → codes → 👥
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(200);
  const warn = await page.textContent("#discountCodesBody");
  check("settings table warns that the codes have no customers yet", /لم تحدد العملاء/.test(warn));
  await page.click('[data-code-cust="NAWAF"]'); await page.waitForSelector("#qf_ids .qf-checks-search");
  await page.fill("#qf_ids .qf-checks-search", "3311 0001");
  const visible = await page.$$eval("#qf_ids .qf-check", (ls2) => ls2.filter((l) => l.style.display !== "none").map((l) => l.textContent));
  check("customer search in the code dialog finds by phone", visible.length === 1 && /نواف/.test(visible[0]), JSON.stringify(visible));
  await page.check('#qf_ids input[value="c_nawaf"]'); await page.click("#quickFormSubmitBtn"); await wait(200);
  check("Nawaf assigned to NAWAF", (await ls("l997_settings")).discountCodes.find((c) => c.code === "NAWAF").customerIds.join() === "c_nawaf");

  // Nawaf: the code is suggested and applies 45% (shirt wash&iron 0.400 → 0.220)
  await fresh(); await pick("33110001"); await page.click('#posProductGrid [data-cloth="shirt"]'); await wait(150);
  const sug = await page.textContent("#discountCodeInfo");
  check("picking Nawaf suggests his code", /NAWAF/.test(sug) && /45%/.test(sug), sug);
  await page.click('[data-use-code="NAWAF"]'); await wait(150);
  check("NAWAF gives 45%: 0.400 → 0.220", /0\.220/.test(await total()), await total());
  // changing the customer to someone else removes the code
  await pick("33110002"); await wait(150);
  check("changing to another customer removes the private code", !(await page.isVisible("#removeCodeBtn")) && /0\.400/.test(await total()), await total());
  // the other customer typing it (lower case) is refused
  await code("nawaf");
  check("another customer cannot use NAWAF", !(await page.isVisible("#removeCodeBtn")) && /0\.400/.test(await total()), await total());
  // Nawaf again, typed in lower case → saved order has the discount
  await pick("33110001"); await code("nawaf");
  const o1 = await save();
  check("Nawaf's order saved with NAWAF 45%", o1.discountCode === "NAWAF" && Math.abs(o1.payment.total - 0.22) < 0.001, JSON.stringify(o1.payment));

  // YADATI 100% via the customer's profile → free order
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c_yad")); await wait(200);
  await page.click("#cpCodes"); await page.check('#qf_codes input[value="YADATI"]'); await page.click("#quickFormSubmitBtn"); await wait(300);
  check("profile shows the customer's code", /YADATI/.test(await page.textContent("#customerProfileContent")));
  await fresh(); await pick("33110003"); for (let i = 0; i < 3; i++) await page.click('#posProductGrid [data-cloth="shirt"]'); await code("yadati");
  const o2 = await save();
  check("YADATI makes the order free (total 0.000, discount = full value)", o2.payment.total === 0 && Math.abs(o2.payment.discount - 1.2) < 0.001, JSON.stringify(o2.payment));

  // fixed piece-price code for everyone: each piece costs at most 0.300 (Arabic digits typed)
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(200);
  await page.click("#addDiscountCodeBtn"); await page.fill("#qf_code", "piece٣"); await page.selectOption("#qf_type", "piece"); await page.fill("#qf_piecePrice", "0.300"); await page.selectOption("#qf_scope", "all");
  await page.click("#quickFormSubmitBtn"); await wait(200);
  await fresh(); await pick("33110002");
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="abaya_plain"]'); // 0.400 + 1.000
  await code("PIECE3");
  check("piece-price code: shirt 0.300 + abaya 0.300 = 0.600", /0\.600/.test(await total()), await total());
  const o3 = await save();
  check("piece-price order saved with the code and price", o3.discountCode === "PIECE3" && o3.discountPiecePrice === 0.3 && Math.abs(o3.payment.total - 0.6) < 0.001, JSON.stringify({ c: o3.discountCode, pp: o3.discountPiecePrice, t: o3.payment.total }));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CUSTOMER-CODE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
