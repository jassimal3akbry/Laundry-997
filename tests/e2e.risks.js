// Previously untested risks: device time zone / wrong clock, customer without phone, price changes after an order,
// invalid prices, likely-duplicate manual payments, and a phone-sized touch screen.
// Usage: node tests/e2e.risks.js [path-to-html]   (the clock-warning part needs a local PostgreSQL server, run as root)
const path = require("path");
const { devices } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}
const PW = "Owner#2026pass";
// moves the page's clock by a fixed amount (time keeps running)
const shiftClock = (ms) => `(() => { const RD = Date, off = ${ms};
  class FD extends RD { constructor(...a) { if (!a.length) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  FD.UTC = RD.UTC; FD.parse = RD.parse; window.Date = FD; })();`;

(async () => {
  const browser = await launchBrowser();
  const url = await serve(file);
  const errors = [];
  async function open(opts, init) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
    for (const s of init || []) await page.addInitScript(s);
    await page.goto(typeof opts.url === "string" ? opts.url : url);
    return page;
  }
  const H = (page) => ({
    wait: (ms) => page.waitForTimeout(ms),
    nav: (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg),
    closeAll: () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())),
    submit: async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); },
    later: async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } },
    ls: (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k),
    async setup() {
      await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
      await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
      await page.waitForSelector("body:not(.auth-locked)");
    },
    async customer(name, phone) {
      await this.closeAll(); await this.nav("customers"); await page.click("#addCustomerBtn");
      await page.fill("#customerName", name); await page.fill("#customerPhone", phone); await page.click("#saveCustomerBtn"); await page.waitForTimeout(250);
      return (await this.ls("l997_customers")).find((c) => phone && String(c.phone).endsWith(phone));
    },
    async order(custId, phone, cloth, qty) {
      await this.closeAll(); await this.nav("new-order");
      await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await page.waitForTimeout(200);
      await page.click(`#customerResults [data-pick="${custId}"]`);
      for (let i = 0; i < qty; i++) await page.click(`#posProductGrid [data-cloth="${cloth}"]`);
      await page.click("#posSaveOrderMainBtn"); await this.later(); await this.closeAll();
      return (await this.ls("l997_orders"))[0];
    },
    async payReady(orderId, amount) {
      const o = (await this.ls("l997_orders")).find((x) => x.id === orderId);
      await this.closeAll(); await this.nav("orders"); await page.click(`#ordersBody tr:has-text("#${o.number}") [data-view]`);
      await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", "cash"); await page.fill("#qf_paid", String(amount));
      await this.submit(); await this.later(); await this.closeAll();
      return (await this.ls("l997_orders")).find((x) => x.id === orderId);
    },
  });

  /* ---------- 1. device set to another time zone, 23:30 in Bahrain (= 02:00 next day in India) ---------- */
  const target = Date.parse("2026-10-20T20:30:00Z"); // 23:30 Bahrain on the 20th
  const P = await open({ timezoneId: "Asia/Kolkata" }, [shiftClock(target - Date.now())]);
  const p = H(P);
  await p.setup();
  const c1 = await p.customer("Late Night", "33770001");
  const o1 = await p.order(c1.id, "33770001", "shirt", 2);
  const paid = await p.payReady(o1.id, o1.payment.total);
  const day = await P.evaluate((iso) => window.L997Finance.localDay(iso), paid.paidAt);
  check("device on India time, 23:30 in Bahrain: the sale belongs to Bahrain's 20 Oct (not 21 Oct)", day === "2026-10-20" && (await P.evaluate(() => window.L997Finance.todayStr())) === "2026-10-20", day);
  await p.nav("dashboard"); await p.wait(300);
  const dash = await P.textContent("#metricsGrid");
  check("dashboard 'today' on that device includes the sale", dash.includes(paid.payment.total.toFixed(3)), dash.replace(/\s+/g, " ").slice(0, 120));
  const shown = await P.evaluate((iso) => { const d = document.createElement("div"); return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bahrain", hour: "2-digit", minute: "2-digit" }); }, paid.paidAt);
  await p.closeAll(); await p.nav("orders"); await P.click(`#ordersBody tr:has-text("#${o1.number}") [data-view]`);
  const dlg = (await P.textContent("#orderDialog")).replace(/\s+/g, " ").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  check("times are shown in Bahrain time on that device (11:3x PM, not 02:0x AM)", /(23|11):3\d/.test(dlg) && !/\b0?2:0\d/.test(dlg), shown + " | " + (dlg.match(/\d{1,2}:\d{2}[^\s]*/g) || []).slice(0, 4).join(" "));
  await p.closeAll();

  /* ---------- 2. customer without a phone number ---------- */
  const nBefore = ((await p.ls("l997_customers")) || []).length;
  await p.nav("customers"); await P.click("#addCustomerBtn"); await P.fill("#customerName", "No Phone"); await P.fill("#customerPhone", ""); await P.click("#saveCustomerBtn"); await p.wait(250);
  check("a customer without a phone number is refused (WhatsApp receipts need it)", ((await p.ls("l997_customers")) || []).length === nBefore);
  await P.fill("#customerPhone", "1234"); await P.click("#saveCustomerBtn"); await p.wait(250);
  check("an invalid phone (not 8 digits) is refused", ((await p.ls("l997_customers")) || []).length === nBefore);
  await p.closeAll();

  /* ---------- 3. price changed in Settings after an order was saved ---------- */
  const oldPrice = (await p.ls("l997_settings")).prices.thob_cotton_washiron;
  const c2 = await p.customer("Price Test", "33770002");
  const oOld = await p.order(c2.id, "33770002", "thob_cotton", 2);
  await p.nav("settings"); await P.click('[data-settings-tab="pricing"]');
  await P.fill('[data-price="thob_cotton_washiron"]', String(oldPrice + 0.1)); await P.click("#savePricesBtn"); await p.wait(300);
  const newPrice = (await p.ls("l997_settings")).prices.thob_cotton_washiron;
  const oKept = (await p.ls("l997_orders")).find((o) => o.id === oOld.id);
  check("raising a price does not change an order already saved", newPrice > oldPrice && oKept.payment.total === oOld.payment.total, JSON.stringify([oldPrice, newPrice, oKept.payment.total]));
  const oNew = await p.order(c2.id, "33770002", "thob_cotton", 2);
  check("new orders use the new price", oNew.payment.total === Math.round(2 * newPrice * 1000) / 1000, oNew.payment.total);
  await p.closeAll(); await p.nav("orders"); await P.click(`#ordersBody tr:has-text("#${oOld.number}") [data-view]`);
  await P.click("#editOrderBtn"); await P.fill("#qf_q0", "3"); await P.fill("#qf_reason", "one more"); await p.submit(); await p.closeAll();
  const oEdit = (await p.ls("l997_orders")).find((o) => o.id === oOld.id);
  check("editing the old order keeps the price agreed at order time", oEdit.items[0].qty === 3 && oEdit.payment.total === Math.round(3 * oldPrice * 1000) / 1000, oEdit.payment.total);
  // invalid prices
  await p.nav("settings"); await P.click('[data-settings-tab="pricing"]');
  await P.fill('[data-price="thob_cotton_washiron"]', "-1"); await P.click("#savePricesBtn"); await p.wait(300);
  const afterNeg = (await p.ls("l997_settings")).prices.thob_cotton_washiron;
  check("a negative price is never saved", afterNeg >= 0, afterNeg);
  await P.fill('[data-price="thob_cotton_washiron"]', String(newPrice)); await P.click("#savePricesBtn"); await p.wait(200);

  /* ---------- 4. the same manual payment recorded twice ---------- */
  await p.payReady(oNew.id, 0.1); // leaves a debt
  const settle = async (amt) => { await p.closeAll(); await P.evaluate((id) => window.openCustomerProfile997(id), c2.id); await P.click("#cpSettle"); await P.fill("#qf_amount", String(amt)); await P.selectOption("#qf_notify", "no"); await p.submit(); };
  await settle(0.2); await p.closeAll();
  const credits = async () => (await p.ls("l997_ledger")).filter((t) => t.customerId === c2.id && t.type === "credit").length;
  const n1 = await credits();
  await settle(0.2);
  const stillOpen = await P.isVisible("#quickFormSubmitBtn");
  check("same amount again within 10 minutes: not recorded, staff asked to confirm", stillOpen && (await credits()) === n1);
  await p.submit(); await p.closeAll();
  check("after confirming, the second (separate) payment is recorded", (await credits()) === n1 + 1);
  await settle(0.3); await p.closeAll();
  check("a different amount is recorded straight away", (await credits()) === n1 + 2);

  /* ---------- 5. phone-sized touch screen (iPhone size, Chromium engine) ---------- */
  const M = await open({ ...devices["iPhone 13"], defaultBrowserType: undefined, timezoneId: "Asia/Bahrain" });
  const m = H(M);
  await m.setup();
  const cm = await m.customer("Phone User", "33770003");
  await m.closeAll(); await m.nav("new-order");
  await M.tap("#posCustomerBarBtn"); await M.fill("#orderCustomerPhone", "33770003"); await m.wait(200);
  await M.tap(`#customerResults [data-pick="${cm.id}"]`);
  await M.tap('#posProductGrid [data-cloth="shirt"]'); await M.tap('#posProductGrid [data-cloth="shirt"]');
  await M.tap("#posSaveOrderMainBtn"); await m.later(); await m.closeAll();
  const om = (await m.ls("l997_orders"))[0];
  check("phone: order created by touch", om && om.items[0].qty === 2);
  await m.nav("orders"); await m.wait(200);
  await M.tap(`#ordersCards .order-card-mobile:has-text("#${om.number}") [data-view]`);
  await M.tap("#advanceStatusBtn"); await M.selectOption("#qf_method", "cash"); await M.fill("#qf_paid", "0.1"); await M.tap("#quickFormSubmitBtn"); await m.wait(300); await m.later(); await m.closeAll();
  await M.evaluate((id) => window.openCustomerProfile997(id), cm.id); await m.wait(200);
  const wide = await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const prof = (await M.textContent("#customerProfileContent")).replace(/\s+/g, " ");
  check("phone: partial payment shown in the customer file (owed, payments history)", /المستحق عليه الآن/.test(prof) && /سجل المدفوعات/.test(prof));
  check("phone: no sideways scrolling on the customer file", wide);

  /* ---------- 6. wrong device clock is detected and shown ---------- */
  const cloud = await startStandin({ latencyMs: 50 });
  const cfg = (c) => `window.__L997_CLOUD_CONFIG = ${JSON.stringify(c)};`;
  const W = await open({ timezoneId: "Asia/Bahrain" }, [cfg({ url: cloud.url, key: "k", pollMs: 1000, idleMs: 300 }), shiftClock(42 * 60000)]);
  const w = H(W);
  await w.setup();
  await w.nav("profile"); await W.click("#cloudLinkBtn"); await W.fill("#qf_pw", PW); await W.fill("#qf_c", "رفع"); await W.click("#quickFormSubmitBtn");
  await W.waitForFunction(() => window.L997Cloud.status().clockSkewMin !== null, null, { timeout: 30000 }).catch(() => {});
  const skew = await W.evaluate(() => window.L997Cloud.status().clockSkewMin);
  await W.waitForSelector("#clockWarnBanner", { timeout: 30000 }).catch(() => {});
  const banner = await W.textContent("#clockWarnBanner").catch(() => "");
  check("a device clock 42 minutes fast is measured against the server", skew !== null && Math.abs(skew - 42) <= 1, skew);
  check("…and staff see a red warning to set the time to automatic", /متقدمة 42 دقيقة|متقدمة 4[123] دقيقة/.test(banner), banner);
  await cloud.close();

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL RISK CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
