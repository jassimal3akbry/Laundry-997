// ⭐ Loyalty & campaigns: customer groups computed from the records, select all/some, WhatsApp campaigns (payment
// reminder, thank-you, personal discount codes by tier…), refresh, loyalty card + points redemption in the customer
// file, and the monthly customer study (sections 7–10, Excel, WhatsApp summary).
// Usage: node tests/e2e.loyalty.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 300) : ""}`); if (!cond) failures++; }

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {};
    window.open = (url) => { const a = JSON.parse(sessionStorage.getItem("__open") || "[]"); a.push(decodeURIComponent(String(url || ""))); sessionStorage.setItem("__open", JSON.stringify(a)); return { closed: false }; };
    if (localStorage.getItem("l997_customers")) return;
    const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(d);
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d) + "T07:00:00.000Z"; };
    const now = new Date().toISOString();
    const o = (id, cid, total, ago, extra) => ({ id, number: id, customerId: cid, status: "delivered", items: [{ id: "i" + id, clothingId: "thob_cotton", serviceId: "washiron", qty: Math.round(total / 0.5), unit: 0.5, total }],
      payment: { method: "cash", total, paid: total, outstanding: 0, subtotal: total, discount: 0, urgentFee: 0, vat: 0 }, paymentConfirmed: true, createdAt: day(ago), paidAt: day(ago), readyAt: day(ago), deliveredAt: day(ago), statusHistory: [], ...(extra || {}) });
    localStorage.setItem("l997_customers", JSON.stringify([
      { id: "vip", name: "Gold Lady", phone: "97333000001", balance: 0, openingBalance: 0, createdAt: day(200) },
      { id: "late", name: "Late Guy", phone: "97333000002", balance: -8, openingBalance: 0, createdAt: day(100) },
      { id: "gone", name: "Gone Man", phone: "97333000003", balance: 0, openingBalance: 0, createdAt: day(120) },
      { id: "nophone", name: "No Phone", phone: "", balance: 0, openingBalance: 0, createdAt: day(10) }]));
    localStorage.setItem("l997_orders", JSON.stringify([
      o("1", "vip", 40, 5), o("2", "vip", 30, 12), o("3", "vip", 15, 20),
      o("4", "late", 10, 40, { debtRecorded: true, payment: { method: "unpaid", total: 10, paid: 2, outstanding: 8, subtotal: 10, discount: 0, urgentFee: 0, vat: 0 } }),
      o("5", "gone", 6, 70), o("6", "nophone", 3, 3)]));
    localStorage.setItem("l997_ledger", JSON.stringify([{ id: "t1", customerId: "late", type: "order_charge", amount: -8, method: "unpaid", orderId: "4", at: day(40) }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const opened = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("__open") || "[]"));
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(300); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  await closeAll();
  check("⭐ Loyalty & campaigns is in the menu", await page.isVisible('.nav-item[data-page="loyalty"]'));
  await nav("loyalty"); await wait(300);
  const segN = (id) => page.evaluate((id) => Number(document.querySelector(`[data-seg="${id}"] span`).textContent), id);
  check("groups are computed: 4 customers, 1 owes, 1 late, 2 inactive (30+ days), 1 new (file opened this month)", (await segN("all")) === 4 && (await segN("owes")) === 1 && (await segN("late")) === 1 && (await segN("inactive")) === 2 && (await segN("new")) === 1);
  check("the VIP group holds the big spender (gold tier by 85 BD in 90 days)", (await segN("vip")) === 1 && /🥇/.test(await page.textContent(".loy-table")));
  const txt = await page.textContent("#loyaltyRoot");
  check("points: 85 BD paid → 850 points; the debtor earns only on what he paid (2 BD → 20)", /850/.test(txt) && /\b20\b/.test(txt));
  check("commitment shown (late payer marked)", /متأخر/.test(txt));

  /* payment reminder to the debtors */
  await page.click('[data-seg="owes"]'); await wait(150);
  await page.click("#loyAll"); await wait(150);
  check("select all in a group", /المختارون: 1/.test(await page.textContent(".loy-actions")));
  await page.click('[data-kind="due"]'); await page.waitForSelector("#quickFormSubmitBtn", { state: "visible" });
  check("the campaign shows a preview with the customer's own amount", /8\.000/.test(await page.textContent("#quickFormSub")));
  await submit(); await page.waitForSelector("#campaignDialog[open]");
  await page.click("#cqNext"); await wait(300);
  const msgs = await opened();
  check("WhatsApp opens on the customer's number with the reminder", msgs.some((u) => u.includes("97333000002") && /8\.000/.test(u)), msgs.slice(-1)[0]);
  check("…progress shows 1 of 1 sent", /أُرسلت 1 من 1/.test(await page.textContent("#campaignDialog")));
  await page.click("#cqClose"); await wait(200);
  check("the customer's last message is recorded", !!(await ls("l997_customers")).find((c) => c.id === "late").lastCampaign);

  /* special discount by tier → personal one-time codes for the selected customers only */
  await page.click('[data-seg="all"]'); await wait(150);
  await page.click("#loyAll"); await wait(150);
  check("customers without a phone cannot be selected", /المختارون: 3/.test(await page.textContent(".loy-actions")));
  await page.click('[data-kind="offer"]'); await page.waitForSelector("#qf_pct"); await submit(); await page.waitForSelector("#campaignDialog[open]");
  const codes = (await ls("l997_settings")).discountCodes.filter((c) => c.campaign);
  const vip = codes.find((c) => c.customerIds[0] === "vip");
  check("one personal code per customer, limited to them, single use, with expiry", codes.length === 3 && codes.every((c) => c.scope === "customers" && c.customerIds.length === 1 && c.maxUses === 1 && c.expiresAt), JSON.stringify(codes[0]));
  check("discount by tier: gold 15%", vip && vip.percent === 15, vip && vip.percent);
  check("the queue lists each code", (await page.textContent("#campaignDialog")).includes(vip.code));
  await page.click("#cqClose"); await wait(200);

  /* refresh button */
  await page.click("#loyRefresh"); await wait(200);
  check("refresh works without errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  /* loyalty card in the customer file + redeem 500 points → 1 BD credit */
  await page.click('[data-open="vip"]'); await wait(300);
  check("💳 loyalty card in the customer file: number, tier, points", /997-000001/.test(await page.textContent("#customerProfileDialog")) && /850/.test(await page.textContent(".loy-card")));
  await page.click("#cpRedeem"); await page.waitForSelector("#qf_n"); await submit(); await wait(300);
  await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 1500 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn");
  const vipC = (await ls("l997_customers")).find((c) => c.id === "vip"), tx = (await ls("l997_ledger")).find((t) => t.loyaltyPoints);
  check("redeeming 500 points adds 1.000 BD to the balance (ledger entry, no cash)", vipC.balance === 1 && tx && tx.loyaltyPoints === 500 && tx.amount === 1 && tx.method === "loyalty", JSON.stringify(tx));
  await closeAll(); await nav("loyalty"); await wait(300);
  check("…and the points drop to 350", /350/.test(await page.textContent(".loy-table")));

  /* monthly customer study */
  await closeAll(); await page.evaluate(() => window.openMonthlyReport997(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(new Date()).slice(0, 7))); await wait(400);
  const rep = await page.textContent("#reportContent");
  check("monthly report has customers, packages, loyalty and recommendations", /٧\. العملاء/.test(rep) && /٨\. الباقات/.test(rep) && /٩\. الولاء/.test(rep) && /إلى أين نتجه/.test(rep), rep.slice(-300));
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#monthlyReportCsv")]);
  const csv = require("fs").readFileSync(await dl.path(), "utf8");
  check("Excel export lists every customer with orders, sales, points, commitment", /Gold Lady/.test(csv) && /الالتزام %/.test(csv) && csv.split("\n").length >= 4, csv.split("\n")[0]);
  await page.click("#monthlyReportWa"); await wait(200);
  check("WhatsApp summary of the month", (await opened()).some((u) => /مغسلة 997 — تقرير/.test(u) && /المبيعات/.test(u)));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL LOYALTY CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
