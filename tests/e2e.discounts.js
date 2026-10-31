// Discounts: owner-defined discount codes (letters+digits or digits only, % per code) applied at order creation,
// and staff manual discounts without supervisor approval (within the owner's cap, reason required).
// Usage: node tests/e2e.discounts.js [path-to-html]
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
  await require("./fixed-prices")(page); // shirt wash & iron 0.200, thobe 0.300
  await page.goto(await serve(file));
  const PW = "Owner#2026pass", WPW = "Worker#2026pw";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const later = async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); };
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const toastText = () => page.evaluate(() => [...document.querySelectorAll(".toast, #toast, [class*=toast]")].map((e) => e.textContent).join(" | "));
  const startOrder = async (shirts) => {
    await closeAll(); await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122"); await wait(150);
    if (await page.isVisible("#newCustomerFromNoResultBtn")) { await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Ali"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn"); }
    else await page.click("#customerResults [data-pick]");
    await page.evaluate(() => { while (document.querySelector("[data-remove]")) document.querySelector("[data-remove]").click(); });
    if (await page.isVisible("#removeCodeBtn")) await page.click("#removeCodeBtn");
    await page.fill("#discountAmount", "0");
    for (let i = 0; i < shirts; i++) await page.click('#posProductGrid [data-cloth="shirt"]');
  };
  const saveOrder = async () => { const n = ((await ls("l997_orders")) || []).length; await page.click("#posSaveOrderMainBtn"); await wait(400); await later(); const o = (await ls("l997_orders")) || []; return o.length > n ? o[0] : null; };
  const addCode = async (code, pct) => { await page.click("#addDiscountCodeBtn"); await page.fill("#qf_code", code); await page.fill("#qf_percent", String(pct)); await submit(); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  /* ---------- 1. owner creates codes ---------- */
  await nav("settings"); await page.click('[data-settings-tab="packages"]');
  await addCode("summer10", 10); await addCode("1234", 25); await addCode("HALF50", 50);
  await addCode("ab", 10); const shortOpen = await page.isVisible("#quickFormSubmitBtn"); await closeAll();
  await addCode("SUMMER10", 30); const dupOpen = await page.isVisible("#quickFormSubmitBtn"); await closeAll();
  await addCode("BAD CODE!", 5); const badOpen = await page.isVisible("#quickFormSubmitBtn"); await closeAll();
  const codes = (await ls("l997_settings")).discountCodes;
  check("codes saved: letters+digits upper-cased, digits-only allowed, each with its own %", codes.length === 3 && codes[0].code === "SUMMER10" && codes[0].percent === 10 && codes[1].code === "1234" && codes[1].percent === 25, JSON.stringify(codes.map((c) => [c.code, c.percent])));
  check("too short, duplicate and invalid characters refused", shortOpen && dupOpen && badOpen);

  /* ---------- 2. code applied at order creation ---------- */
  await startOrder(4); // 4 × 0.200 = 0.800
  await page.fill("#discountCode", "summer10"); await page.click("#applyCodeBtn"); await wait(150);
  const shown = await page.textContent("#summaryTotal");
  check("code (typed in lower case) gives 10% off: 0.800 → 0.720", /0\.720/.test(shown) && (await page.inputValue("#discountAmount")) === "0.080", shown);
  await page.click('#posProductGrid [data-cloth="shirt"]'); // 5 × 0.200 = 1.000
  check("discount follows the order when items are added (10% of 1.000 = 0.100)", (await page.inputValue("#discountAmount")) === "0.100" && /0\.900/.test(await page.textContent("#summaryTotal")));
  check("discount amount is locked while a code is applied, no reason needed", (await page.$eval("#discountAmount", (e) => e.readOnly)) && !(await page.isVisible("#discountReason")));
  const oC = await saveOrder();
  check("saved without supervisor approval; code, % and amount recorded", oC && oC.discountCode === "SUMMER10" && oC.discountPercent === 10 && oC.payment.discount === 0.1 && oC.payment.total === 0.9 && /SUMMER10/.test(oC.discountReason), oC && JSON.stringify([oC.discountCode, oC.payment.discount, oC.payment.total]));
  await closeAll(); await nav("orders"); await page.click(`#ordersBody [data-view="${oC.id}"]`); await wait(150);
  check("order screen shows the code discount", /خصم بكود/.test(await page.textContent("#orderDialog")));
  await page.click("#editOrderBtn"); await page.fill("#qf_q0", "10"); await page.fill("#qf_reason", "more shirts"); await submit(); await closeAll();
  const oE = (await ls("l997_orders")).find((o) => o.id === oC.id);
  check("editing the order keeps the same %: 10 shirts 2.000 → discount 0.200, total 1.800", oE.payment.discount === 0.2 && oE.payment.total === 1.8, JSON.stringify([oE.payment.discount, oE.payment.total]));

  /* ---------- 3. wrong / disabled codes ---------- */
  await startOrder(1);
  await page.fill("#discountCode", "NOPE99"); await page.click("#applyCodeBtn"); await wait(150);
  check("unknown code: no discount", (await page.inputValue("#discountAmount")) === "0" && !(await page.isVisible("#discountCodeInfo")));
  await closeAll(); await nav("settings"); await page.click('[data-settings-tab="packages"]');
  await page.uncheck('[data-code-active="1234"]'); await wait(150);
  await startOrder(1);
  await page.fill("#discountCode", "1234"); await page.click("#applyCodeBtn"); await wait(150);
  check("disabled code is refused", (await page.inputValue("#discountAmount")) === "0");
  await page.fill("#discountCode", "SUMMER10"); await page.click("#applyCodeBtn"); await wait(150);
  await page.click("#removeCodeBtn"); await wait(150);
  check("a code can be removed before saving", (await page.inputValue("#discountAmount")) === "0" && !(await page.$eval("#discountAmount", (e) => e.readOnly)));
  await closeAll(); await nav("settings"); await page.click('[data-settings-tab="packages"]');
  const usesRow = await page.textContent('#discountCodesBody tr:has-text("SUMMER10")');
  check("settings show how many orders used each code", /\b1\b/.test(usesRow.replace("SUMMER10", "")), usesRow.replace(/\s+/g, " "));

  /* ---------- 4. worker: manual discount without approval, within the cap ---------- */
  await closeAll(); await nav("access"); await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Worker"); await page.selectOption("#qf_role", "worker"); await page.fill("#qf_username", "worker1");
  const tmp = await page.inputValue("#qf_password"); await submit(); await later(); await closeAll();
  await page.click("#logoutBtn"); await wait(300);
  await page.fill("#au_user", "worker1"); await page.fill("#au_pass", tmp); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("#au_pw2"); await wait(150); await page.fill("#au_pw", WPW); await page.fill("#au_pw2", WPW); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)"); await wait(500); await closeAll();
  await startOrder(5); // 1.000
  const nW = ((await ls("l997_orders")) || []).length;
  await page.fill("#discountAmount", "0.15"); await page.dispatchEvent("#discountAmount", "change");
  await page.click("#posSaveOrderMainBtn"); await wait(300);
  check("manual discount without a reason is refused", ((await ls("l997_orders")) || []).length === nW && (await page.isVisible("#discountReason")));
  await page.fill("#discountReason", "regular customer");
  const oW = await saveOrder();
  check("worker gives 0.150 off with a reason — saved with no supervisor approval", oW && oW.payment.discount === 0.15 && oW.payment.total === 0.85 && oW.createdBy === "Worker" && !oW.discountApprovedBy, oW && JSON.stringify([oW.payment.discount, oW.discountApprovedBy]));
  await startOrder(5);
  await page.fill("#discountAmount", "0.6"); await page.dispatchEvent("#discountAmount", "change"); await page.fill("#discountReason", "test");
  const oCap = await saveOrder();
  check("worker discount above the owner's cap (25%) is limited to 0.250", oCap && oCap.payment.discount === 0.25, oCap && oCap.payment.discount);
  await startOrder(5);
  await page.fill("#discountCode", "HALF50"); await page.click("#applyCodeBtn"); await wait(150);
  const oHalf = await saveOrder();
  check("worker can use an owner code above the cap (HALF50 → 0.500 off)", oHalf && oHalf.payment.discount === 0.5 && oHalf.discountCode === "HALF50", oHalf && oHalf.payment.discount);
  check("worker cannot see or change the codes list", !(await page.isVisible("#addDiscountCodeBtn")));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL DISCOUNT CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
