// 💳 BenefitPay: number & name from Settings shown in WhatsApp messages; the transaction reference is required when
// paying by Benefit (and a reference cannot be used twice); it shows on the order/receipt and in the reconciliation list.
// Usage: node tests/e2e.benefit.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 300) : ""}`); if (!cond) failures++; }

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {};
    window.open = (url) => { const a = JSON.parse(sessionStorage.getItem("__open") || "[]"); a.push(decodeURIComponent(String(url || ""))); sessionStorage.setItem("__open", JSON.stringify(a)); return { closed: false }; };
    if (localStorage.getItem("l997_customers")) return;
    const now = new Date().toISOString();
    localStorage.setItem("l997_customers", JSON.stringify([{ id: "c1", name: "Huda", phone: "97333660001", balance: 0, openingBalance: 0, createdAt: now }]));
    const o = (id) => ({ id, number: "0000" + id, customerId: "c1", status: "received", priority: "normal", items: [{ id: "i" + id, clothingId: "thob_cotton", serviceId: "washiron", qty: 4, unit: 0.5, total: 2 }], extras: [],
      payment: { method: "unpaid", total: 2, paid: 0, outstanding: 2, subtotal: 2, discount: 0, urgentFee: 0, vat: 0 }, paymentConfirmed: false, createdAt: now, statusHistory: [{ status: "received", at: now }] });
    localStorage.setItem("l997_orders", JSON.stringify([o("1"), o("2")]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass", wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const opened = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("__open") || "[]"));
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)"); await closeAll();

  await nav("settings"); await wait(300);
  // the BenefitPay box is on the operating-settings tab
  await page.evaluate(() => { const t = [...document.querySelectorAll("[data-settings-tab]")].find((x) => { x.click(); return !!document.getElementById("bpNumberSetting") && document.getElementById("bpNumberSetting").offsetParent; }); return !!t; });
  await page.fill("#bpNumberSetting", "39599902"); await page.fill("#bpNameSetting", "مغسلة 997"); await page.fill("#bpIbanSetting", "BH12 TEST 0000 1111 2222 33");
  await page.click("#saveSettingsBtn"); await wait(300);
  check("BenefitPay number & name saved in Settings", JSON.stringify((await ls("l997_settings")).benefitPay) === JSON.stringify({ number: "39599902", name: "مغسلة 997", iban: "BH12TEST0000111122223333".slice(0, 22), qr: "", requireRef: true }), JSON.stringify((await ls("l997_settings")).benefitPay));

  const openOrder = async (id) => { await closeAll(); await nav("orders"); await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id); await wait(200); };
  await openOrder("1"); await page.click("#advanceStatusBtn"); await page.waitForSelector("#qf_method");
  await page.selectOption("#qf_method", "benefitpay"); await page.click("#quickFormSubmitBtn"); await wait(300);
  check("paying by Benefit without a reference is refused", (await ls("l997_orders")).find((o) => o.id === "1").paymentConfirmed === false && await page.isVisible("#qf_ref"));
  await page.fill("#qf_ref", "230145678912"); await page.click("#quickFormSubmitBtn"); await wait(400);
  const o1 = (await ls("l997_orders")).find((o) => o.id === "1");
  check("with the reference the payment is saved on the order", o1.paymentConfirmed && o1.payment.method === "benefitpay" && o1.payment.ref === "230145678912", JSON.stringify(o1.payment));
  await closeAll();
  await openOrder("2"); await page.click("#advanceStatusBtn"); await page.waitForSelector("#qf_method");
  await page.selectOption("#qf_method", "benefitpay"); await page.fill("#qf_ref", "230145678912"); await page.click("#quickFormSubmitBtn"); await wait(300);
  check("the same reference cannot be used twice", (await ls("l997_orders")).find((o) => o.id === "2").paymentConfirmed === false);
  await page.selectOption("#qf_method", "later"); await page.click("#quickFormSubmitBtn"); await wait(400);
  await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 1500 }).catch(() => {});
  if (await page.isVisible("#quickFormSubmitBtn")) { await page.click("#quickFormSubmitBtn"); await wait(400); }
  const msg = (await opened()).filter((u) => /api\.whatsapp\.com/.test(u)).pop() || "";
  check("…and the IBAN (grouped by 4)", /أو تحويل للآيبان: BH12 TEST 0000 1111 2222 33/.test(msg), msg.slice(-160));
  check("the 'ready' WhatsApp message shows the BenefitPay number and order to write", /BenefitPay على الرقم: 39599902 \(مغسلة 997\) — اكتب رقم الطلب #00002/.test(msg), msg.slice(-200));
  await openOrder("1");
  check("the order shows the method with its reference", /230145678912/.test(await page.textContent("#orderDialogContent")));
  await closeAll(); await nav("reports"); await wait(400);
  check("reports list BenefitPay payments with references for reconciliation", /مدفوعات BenefitPay/.test(await page.textContent("#reportContent")) && /230145678912/.test(await page.textContent("#reportContent")));
  await page.evaluate(() => window.openCustomerProfile997("c1")); await page.waitForTimeout(300);
  check("the customer file offers «send BenefitPay details» while money is owed", await page.isVisible("#cpPayInfo"));
  await page.click("#cpPayInfo"); await page.waitForTimeout(300);
  const pm = (await opened()).filter((u) => /api\.whatsapp\.com/.test(u)).pop() || "";
  check("…the message has the amount, BenefitPay number and IBAN", /المبلغ المطلوب: 2\.000/.test(pm) && /39599902/.test(pm) && /BH12 TEST/.test(pm), pm.slice(0, 200));
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL BENEFITPAY CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
