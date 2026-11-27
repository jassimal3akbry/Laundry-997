// Sweep test: seeds a realistic shop, then visits every page in every language,
// clicks every non-destructive button, closes any dialog it opens, and reports JS errors.
// Usage: node tests/e2e.sweep.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
const PAGES = ["dashboard", "new-order", "orders", "customers", "balances", "reports", "finance", "inventory", "employees", "closures", "audit", "profile", "access", "settings"];
// Buttons whose click is destructive, navigates away, or downloads — skipped in the sweep
const SKIP = /logout|خروج|حذف|delete|del-|void|reset|restore|استعادة|print|طباعة|export|تصدير|wa\b|whatsapp|واتساب|lock|تعطيل|disable|ألغ|cancel-order|cancelOrder|revert/i;

(async () => {
  const browser = await launchBrowser();
  const errors = [];
  let clicks = 0;
  for (const [vw, vh, tag] of [[1280, 900, "desktop"], [390, 844, "phone"]]) {
    const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: vw, height: vh } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/fonts\.|ERR_FAILED/.test(m.text())) errors.push(`[${tag}] console: ${m.text()}`); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; HTMLAnchorElement.prototype.click = function () {}; });
    await page.goto(await serve(file));
    await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner");
    await page.fill("#au_pw", "Owner#2026pass"); await page.fill("#au_pw2", "Owner#2026pass");
    await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
    await page.waitForSelector("body:not(.auth-locked)");

    // Seed one customer + one order so lists are not empty
    await page.evaluate(() => document.querySelector('.nav-item[data-page="new-order"]').click());
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122");
    await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Test <b>X</b>"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn");
    await page.click('#posProductGrid [data-cloth="shirt"]');
    await page.evaluate(() => document.getElementById("posSaveOrderMainBtn").click());
    await page.waitForTimeout(300);

    const closeDialogs = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    for (const lang of ["ar", "en", "ur"]) {
      await closeDialogs();
      await page.selectOption("#langSelectTop", lang).catch(() => {});
      for (const pg of PAGES) {
        await closeDialogs();
        await page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
        await page.waitForTimeout(80);
        // collect visible buttons in the active page (tabs, add buttons, filters)
        const ids = await page.evaluate((skipSrc) => {
          const skip = new RegExp(skipSrc, "i");
          const root = document.querySelector(".page.active");
          if (!root) return [];
          return [...root.querySelectorAll("button")].filter((b) => b.offsetParent !== null && !b.disabled)
            .filter((b) => !skip.test((b.id || "") + " " + (b.className || "") + " " + Object.keys(b.dataset).join(" ") + " " + (b.textContent || "")))
            .slice(0, 40).map((b, i) => { b.setAttribute("data-sweep", String(i)); return String(i); });
        }, SKIP.source);
        for (const i of ids) {
          const sel = `.page.active [data-sweep="${i}"]`;
          if (!(await page.isVisible(sel).catch(() => false))) continue;
          await page.click(sel, { timeout: 1500 }).catch(() => {});
          clicks++;
          await page.waitForTimeout(40);
          await closeDialogs();
        }
      }
    }
    // XSS canary: the customer name contains <b> — it must never render as a real <b> element
    const injected = await page.evaluate(() => [...document.querySelectorAll("b")].some((b) => b.textContent === "X" && b.closest(".page, dialog")));
    if (injected) errors.push(`[${tag}] customer name rendered as HTML (XSS risk)`);
    await ctx.close();
  }
  await browser.close();
  console.log(`clicked ${clicks} buttons across ${PAGES.length} pages × 3 languages × 2 screen sizes`);
  const uniq = [...new Set(errors)];
  uniq.forEach((e) => console.log("ERROR " + e));
  console.log(uniq.length ? `\n${uniq.length} problem(s) found` : "\nSWEEP CLEAN");
  process.exit(uniq.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
