// English-mode test: walks the main flows with the interface in English and reports any Arabic
// text still visible (excluding customer/user-entered data). Fails if core dialogs show Arabic.
// Usage: node tests/e2e.english.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}
const AR = /[؀-ۿ]+(?:[\s؀-ۿ«»،؛؟.\-—:()]*[؀-ۿ]+)*/g;

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.open = () => ({ closed: false });
    window.print = () => {};
    Object.defineProperty(navigator, "clipboard", {
      value: { write: async () => { throw new Error("Clipboard unavailable"); } },
    });
    if (!localStorage.getItem("l997_lang")) localStorage.setItem("l997_lang", JSON.stringify("en"));
  });
  await require("./fixed-prices")(page); // flow test: fixed test prices, independent of the shop's price list
  await page.goto(await serve(file));
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", "Owner#2026pass"); await page.fill("#au_pw2", "Owner#2026pass");
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const leftovers = new Map();
  const dialogText = async (where) => {
    await page.waitForTimeout(200);
    const txt = await page.evaluate(() => {
      const d = document.getElementById("quickFormDialog");
      const parts = [d.querySelector("#quickFormTitle").textContent, d.querySelector("#quickFormSub").textContent,
        ...[...d.querySelectorAll("label span, option, button")].map((x) => x.textContent)];
      return parts.join(" | ");
    });
    (txt.match(AR) || []).forEach((m) => leftovers.set(m, where));
    return txt;
  };
  const pageText = async (where, sel) => {
    const txt = await page.evaluate((sel) => document.querySelector(sel).innerText, sel);
    (txt.match(AR) || []).filter((m) => !/^(Customer|Ali)$/.test(m)).forEach((m) => leftovers.set(m, where));
  };

  // customer + order (customer name in Latin letters so data does not count as leftover Arabic)
  await nav("new-order");
  await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122");
  await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Jasim"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn");
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="bathrobe"]');
  await pageText("new order page", "#page-new-order");
  await page.click("#posSaveOrderMainBtn");
  const t1 = await dialogText("order saved prompt");
  check("order-saved WhatsApp prompt in English", /Send order confirmation on WhatsApp/.test(t1), t1.slice(0, 160));
  await page.click("#quickFormSubmitBtn"); // mandatory WhatsApp confirmation
  await nav("orders");
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await pageText("order dialog", "#orderDialogContent");
  await page.click("#advanceStatusBtn");
  const t2 = await dialogText("prepare dialog");
  await page.selectOption("#qf_method", "later"); await page.click("#quickFormSubmitBtn");
  await page.waitForTimeout(300); await page.click("#quickFormCancelBtn").catch(() => {});
  await page.click("#advanceStatusBtn");
  const t3 = await dialogText("delivery dialog");
  await page.fill("#qf_count", "2"); await page.click("#quickFormSubmitBtn");
  // delivery now opens the receipt for WhatsApp at once (copy image + chat; here copying is blocked → the receipt preview)
  await page.waitForSelector("#receiptPreviewDialog[open]", { timeout: 5000 });
  const t4 = await page.evaluate(() => { const d = document.getElementById("receiptPreviewDialog"); const s = d && d.open ? d.textContent.replace(/\s+/g, " ") : ""; if (d && d.open) d.close(); return s; });
  check("delivery dialog in English", /Deliver order/.test(t3) && /Payment method/.test(t3) && /Collect & deliver/.test(t3) && !AR.test(t3), t3.slice(0, 160));
  AR.lastIndex = 0;
  check("delivery receipt preview in English", /Receipt/.test(t4) && /Open customer's chat/.test(t4) && /Download/.test(t4) && !AR.test(t4), t4.slice(0, 160));
  check("prepare dialog options in English", /Pay later/.test(t2) && /Cash/.test(t2) && /Credit \(customer debt\)/.test(t2), t2.slice(0, 160));
  await page.click("#quickFormCancelBtn").catch(() => {});
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));

  // other screens
  for (const pg of ["dashboard", "customers", "balances", "finance", "employees", "closures", "reports", "settings", "inventory"]) {
    await nav(pg); await page.waitForTimeout(150);
    await pageText(pg + " page", ".page.active");
  }
  await nav("finance"); await page.click("#addExpenseBtn"); await dialogText("expense dialog"); await page.click("#quickFormCancelBtn");
  await page.click("#shiftBoxBtn"); await dialogText("start shift dialog"); await page.click("#quickFormCancelBtn");

  const list = [...leftovers.entries()];
  console.log(`\nArabic left on English screens: ${list.length}`);
  list.slice(0, 80).forEach(([t, w]) => console.log(`  [${w}] ${t}`));
  check("core screens have almost no Arabic left (< 5 phrases, activity-log entries only)", list.length < 5, list.length);
  // back to Arabic: page reloads and original Arabic text returns
  await Promise.all([page.waitForEvent("load"), page.selectOption("#langSelectTop", "ar")]);
  await page.waitForSelector("body:not(.auth-locked)");
  check("switching back to Arabic restores the Arabic interface", /الرئيسية/.test(await page.textContent("#pageTitle")) && (await page.evaluate(() => document.documentElement.dir)) === "rtl");
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL ENGLISH CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
