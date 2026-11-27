// Home page (decision dashboard): numbers equal the Reports page (same engine), comparison with the previous
// period, recommendations from real data (debts, unclosed days, inactive customers, packages running out, late /
// uncollected orders), English without Arabic labels, and no sideways scrolling on iPad / iPhone.
// Usage: node tests/e2e.dashboard.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`); if (!cond) failures++; }
(async () => {
  const url = await serve(file);
  const b = await launchBrowser();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: "Asia/Bahrain" })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.addInitScript(() => {
    if (localStorage.getItem("l997_customers")) return;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const names = ["Nawaf", "Badoor", "Dana Al Dosari", "Ahmed", "Fatima", "Yaseen", "Latifa", "Hassan", "Mariam", "Ali", "Noor", "Khalid", "Sara", "Abdulla", "Huda", "Omar", "Reem", "Jasim"];
    const now = Date.now(), day = 864e5;
    const customers = names.map((n, i) => ({ id: "c" + i, name: n, phone: "9733300" + String(1000 + i), balance: 0, createdAt: new Date(now - (90 - i * 3) * day).toISOString() }));
    const items = [["thob_cotton", "washiron", 0.5], ["thob_cotton", "iron", 0.2], ["shirt", "washiron", 0.4], ["abaya_plain", "washiron", 1], ["ghatra", "washiron", 0.3], ["pants_long", "washiron", 0.4], ["bedsheet_double", "washiron", 1], ["duvet", "washiron", 1.5], ["tshirt", "washiron", 0.4]];
    const orders = []; let n = 1;
    for (let d = 59; d >= 0; d--) {
      const per = d < 30 ? 3 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < per; k++) {
        const c = customers[Math.floor(rnd() * (d > 40 ? 18 : 12))];
        const its = []; const m = 1 + Math.floor(rnd() * 3);
        for (let j = 0; j < m; j++) { const [g, s, u] = items[Math.floor(rnd() * items.length)]; const q = 1 + Math.floor(rnd() * 4); its.push({ id: "i" + n + j, clothingId: g, serviceId: s, qty: q, unit: u, total: Math.round(u * q * 1000) / 1000 }); }
        const total = Math.round(its.reduce((a, x) => a + x.total, 0) * 1000) / 1000;
        const t = new Date(now - d * day - (8 + Math.floor(rnd() * 13)) * 3600e3);
        const st = d > 3 ? "delivered" : d > 1 ? (rnd() < .5 ? "ready" : "delivered") : (rnd() < .6 ? "received" : "ready");
        const credit = st === "delivered" && rnd() < 0.08;
        const method = credit ? "unpaid" : ["cash", "card", "benefitpay", "cash"][Math.floor(rnd() * 4)];
        orders.unshift({ id: "o" + n, number: String(n).padStart(5, "0"), customerId: c.id, items: its, extras: [], priority: rnd() < .1 ? "urgent" : "normal", status: st, statusHistory: [], createdAt: t.toISOString(),
          readyAt: st !== "received" ? new Date(t.getTime() + 20 * 3600e3).toISOString() : null, deliveredAt: st === "delivered" ? new Date(t.getTime() + 30 * 3600e3).toISOString() : null,
          payment: { method: st === "received" ? "unpaid" : method, subtotal: total, extrasTotal: 0, urgentFee: 0, discount: 0, vatPercent: 0, vat: 0, total, paid: st === "received" || credit ? 0 : total, balanceUse: 0, outstanding: st === "received" || credit ? total : 0 },
          paymentConfirmed: st !== "received", debtRecorded: credit || undefined, createdBy: rnd() < .6 ? "Yaseen" : "Owner" });
        if (credit) c.balance = Math.round((c.balance - total) * 1000) / 1000;
        n++;
      }
    }
    localStorage.setItem("l997_customers", JSON.stringify(customers));
    localStorage.setItem("l997_orders", JSON.stringify(orders));
    const exps = []; for (let d = 55; d >= 0; d -= 5) exps.push({ id: "e" + d, date: new Date(now - d * day).toISOString().slice(0, 10), amount: 6 + Math.round(rnd() * 14), category: "مواد تنظيف", catId: "supplies", method: "cash" });
    exps.push({ id: "rent", date: new Date(now - 3 * day).toISOString().slice(0, 10), amount: 120, catId: "rent", category: "إيجار", method: "bank_transfer" });
    localStorage.setItem("l997_expenses", JSON.stringify(exps));
    localStorage.setItem("l997_customer_packages", JSON.stringify([{ id: "cp1", customerId: "c0", name: "باقة 30", serviceType: "washiron", garments: [], totalPieces: 30, remainingPieces: 2, price: 7, purchasedAt: new Date(now - 20 * day).toISOString() }]));
  });
  await p.goto(url);
  await p.fill("#au_name", "Owner"); await p.fill("#au_user", "owner"); await p.fill("#au_pw", "Owner#2026pass"); await p.fill("#au_pw2", "Owner#2026pass");
  await p.click("#au_form button[type=submit]"); await p.check("#au_saved"); await p.click("#au_next"); await p.waitForSelector("body:not(.auth-locked)");
  await p.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  await p.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click()); await p.waitForTimeout(300);
  const heroes = await p.$$eval(".ck-hero", (h) => h.map((x) => x.textContent.replace(/\s+/g, " ")));
  check("4 key numbers with comparison to the previous period", heroes.length === 4 && heroes.every((x) => /الفترة السابقة|جديد|نفس السابق/.test(x)), heroes.join(" | "));
  const engine = await p.evaluate(() => { const F = window.L997Finance, f = document.getElementById("dashFromDate").value, t = document.getElementById("dashToDate").value;
    const E = window.L997Enterprise.data; const d = { orders: JSON.parse(localStorage.getItem("l997_orders")), ledger: [], customers: JSON.parse(localStorage.getItem("l997_customers")), customerPackages: JSON.parse(localStorage.getItem("l997_customer_packages")), expenses: E.expenses, payroll: E.payroll };
    const s = F.summarize(d, f, t); return { sales: s.salesTotal, profit: s.profit, collected: s.collected, f, t }; });
  const num = (x) => Number(String(x).replace(/[^\d.\-]/g, ""));
  check("sales / profit / collected on the home page = the finance engine", Math.abs(num(heroes[0].split("المبيعات")[1].split("د.ب")[0]) - engine.sales) < 0.001 && Math.abs(num(heroes[1].split("صافي الربح")[1].split("د.ب")[0]) - engine.profit) < 0.001 && Math.abs(num(heroes[2].split("المحصّل فعلياً")[1].split("د.ب")[0]) - engine.collected) < 0.001, JSON.stringify(engine));
  const heroSales = heroes[0];
  await p.evaluate(() => document.querySelector('.nav-item[data-page="reports"]').click()); await p.waitForTimeout(200);
  await p.evaluate(([f, t]) => { document.getElementById("reportFromDate").value = f; document.getElementById("reportToDate").value = t; document.getElementById("reportApplyBtn").click(); }, [engine.f, engine.t]); await p.waitForTimeout(200);
  const rep = await p.textContent("#reportMetrics .metric-card .metric-value");
  check("home-page sales = Reports page sales for the same dates", heroSales.includes(rep.trim()), `${rep} in ${heroSales}`);
  await p.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click()); await p.waitForTimeout(300);
  const tips = await p.textContent(".ck-tips");
  check("recommendations: old debts, unclosed days, inactive customers, package running out", /ديون أقدم من 14 يوماً/.test(tips) && /لم يُعتمد إغلاقها/.test(tips) && /لم يطلب منذ أكثر من 30 يوماً/.test(tips) && /باقة قاربت على الانتهاء/.test(tips), tips.replace(/\s+/g, " ").slice(0, 300));
  check("urgent items come first", (await p.$$eval(".ck-tip", (t) => t.map((x) => x.className))).join() .indexOf("l1") === (await p.$$eval(".ck-tip", (t) => t.map((x) => x.className))).join().indexOf("ck-tip l") + 7);
  await p.click('.ck-tip [data-ck-go="balances"]'); await p.waitForTimeout(200);
  check("a recommendation's button opens the right page", await p.evaluate(() => document.getElementById("page-balances").classList.contains("active")));
  await p.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click()); await p.waitForTimeout(200);
  check("operations panel shows in progress / ready counts", /قيد التنظيف/.test(await p.textContent("#dashCockpit")) && /جاهزة للاستلام/.test(await p.textContent("#dashCockpit")));
  check("details (old cards, charts, activity) are kept below", (await p.textContent("#metricsGrid")).length > 0 && !!(await p.$("#dashDetails")));
  await p.selectOption("#langSelect", "en"); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click()); await p.waitForTimeout(300);
  const en = await p.textContent("#dashCockpit");
  const ar = (en.match(/[\u0600-\u06FF]{3,}/g) || []).filter((x) => !/^(ثوب|بنطلون|لحاف|عباية|شرشف|قميص|غترة|تيشيرت|دبل)$/.test(x));
  check("English home page: no Arabic labels", /Today's decisions/.test(en) && ar.length === 0, JSON.stringify(ar.slice(0, 8)));
  for (const [nm, w, h] of [["iPad", 820, 1180], ["iPhone", 390, 844]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${nm}: home page fits the screen`, ov <= 1, ov);
  }
  check("no JavaScript errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL DASHBOARD CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
