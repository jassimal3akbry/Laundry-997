// Services test: dry cleaning (priced per item in Settings), order add-ons (perfume per order, wrapping per piece),
// totals / urgent fee / editing with add-ons, itemized WhatsApp receipt, empty starting inventory.
// Usage: node tests/e2e.services.js [path-to-html]
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
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const waUrls = [];
  await page.exposeFunction("__waOpened", (u) => waUrls.push(u));
  await page.addInitScript(() => { window.open = (u) => { window.__waOpened(String(u)); return { closed: false }; }; window.print = () => {}; });
  await require("./fixed-prices")(page); // flow test: fixed test prices, independent of the shop's price list
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const later = async () => { await page.waitForTimeout(250); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); } };
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const lastOrder = () => page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0]);

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  // fresh install: no invented stock or suppliers
  const inv = await page.evaluate(() => window.L997Enterprise.data.inventory.length);
  check("fresh install starts with an empty inventory (no invented quantities)", inv === 0, inv);

  // POS before pricing: no add-on toggles, no dry-clean option
  await nav("new-order");
  check("add-ons hidden while their price is zero", !(await page.isVisible("#posExtras")));

  // Settings: dry clean for shirt 0.800; perfume 0.100 per order; wrapping 0.050 per piece
  await nav("settings");
  await page.click('[data-settings-tab="pricing"]');
  await page.fill('[data-price="shirt_dryclean"]', "0.8");
  await page.fill('[data-extra-price="perfume"]', "0.1");
  await page.fill('[data-extra-price="wrap"]', "0.05");
  await page.selectOption('[data-extra-per="wrap"]', "piece");
  await page.click("#savePricesBtn");
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_settings")));
  check("dry-clean and add-on prices saved", st.prices.shirt_dryclean === 0.8 && st.extras.perfume.price === 0.1 && st.extras.wrap.per === "piece", JSON.stringify(st.extras));
  check("existing official prices untouched", st.prices.shirt_washiron === 0.2 && st.prices.thob_cotton_washiron === 0.3);

  // Order: 2 shirts switched to dry clean (1.600) + perfume 0.100 + wrapping 2 × 0.050 → subtotal 1.800;
  // urgent 100% applies to garments only (1.600) → total 3.400
  await nav("new-order");
  await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122");
  await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Ali"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn");
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="shirt"]');
  const opts = await page.$$eval("[data-service-change] option", (os) => os.map((o) => o.value));
  check("dry clean offered for a priced item", opts.includes("dryclean"), opts.join(","));
  await page.selectOption("[data-service-change]", "dryclean");
  check("add-on toggles visible once priced", await page.isVisible("#posExtras"));
  await page.check('[data-extra="perfume"]'); await page.check('[data-extra="wrap"]');
  await page.check("#orderPriorityToggle");
  const shown = await page.textContent("#summaryTotal");
  check("POS total shows 3.400", /3\.400/.test(shown), shown);
  await page.click("#posSaveOrderMainBtn"); await later();
  let o = await lastOrder();
  check("order stores add-on lines", o.extras.length === 2 && o.extras.find((l) => l.id === "wrap").qty === 2 && o.extras.find((l) => l.id === "perfume").qty === 1, JSON.stringify(o.extras));
  check("order totals: subtotal 1.800, urgent 1.600 (garments only), total 3.400", o.payment.subtotal === 1.8 && o.payment.urgentFee === 1.6 && o.payment.total === 3.4, JSON.stringify([o.payment.subtotal, o.payment.urgentFee, o.payment.total]));

  // Edit: 2 → 1 shirt → wrapping follows piece count → 0.800 + 0.100 + 0.050 = 0.950, urgent 0.800 → 1.750
  await nav("orders");
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await page.click("#editOrderBtn");
  await page.fill("#qf_q0", "1"); await page.fill("#qf_reason", "customer took one back");
  await submit(); await page.waitForTimeout(200);
  o = await lastOrder();
  check("edit recalculates add-ons and total (1.750)", o.payment.total === 1.75 && o.extras.find((l) => l.id === "wrap").qty === 1, JSON.stringify([o.payment.total, o.extras]));

  // Itemized WhatsApp receipt (unpaid)
  await page.click("#dialogReceiptWaBtn");
  let msg = decodeURIComponent((waUrls[waUrls.length - 1] || "").split("text=")[1] || "");
  check("receipt lists items, add-ons and total", /غسيل جاف/.test(msg) && /تعطير/.test(msg) && /تغليف/.test(msg) && /1\.750/.test(msg) && /#\d{5}/.test(msg), msg.split("\n").slice(0, 8).join(" | "));
  check("unpaid receipt says amount due on pickup", /المستحق عند الاستلام/.test(msg));

  // PDF receipt: shared as a file through the device's share sheet (WhatsApp attaches it)
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { const f = d.files[0]; const head = new TextDecoder().decode(new Uint8Array(await f.slice(0, 8).arrayBuffer())); window.__shared = { name: f.name, type: f.type, size: f.size, head }; }; });
  await page.click("#dialogReceiptPdfBtn"); await page.waitForTimeout(800);
  const shared = await page.evaluate(() => window.__shared);
  check("PDF receipt goes to the share sheet as a real PDF file", shared && shared.type === "application/pdf" && /^%PDF-1\.4/.test(shared.head) && shared.size > 20000 && /receipt-\d{5}\.pdf$/.test(shared.name), JSON.stringify(shared));
  await page.click("#dialogReceiptImgBtn"); await page.waitForTimeout(800);
  const sharedImg = await page.evaluate(() => window.__shared);
  check("receipt image goes to the share sheet as PNG", sharedImg && sharedImg.type === "image/png", JSON.stringify(sharedImg));
  // a device without file sharing: the PDF downloads and WhatsApp opens on the customer's chat
  await page.evaluate(() => { navigator.canShare = () => false; });
  waUrls.length = 0;
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#dialogReceiptPdfBtn")]);
  await page.waitForTimeout(900);
  await page.click("#rpWa"); await page.waitForTimeout(200); // the preview's "open customer's chat" button
  await page.evaluate(() => { const d = document.getElementById("receiptPreviewDialog"); if (d && d.open) d.close(); });
  check("without file sharing: PDF downloaded + customer's WhatsApp chat opened", /receipt-\d{5}\.pdf$/.test(dl.suggestedFilename()) && waUrls.some((u) => /api\.whatsapp\.com\/send\?phone=97333001122/.test(u)), dl.suggestedFilename());

  // Pay cash, deliver: piece count is 1 (add-ons are not pieces)
  await page.click("#advanceStatusBtn");
  await page.selectOption("#qf_method", "cash"); await page.fill("#qf_paid", "1.75");
  await submit(); await later();
  await page.click("#dialogReceiptWaBtn");
  msg = decodeURIComponent((waUrls[waUrls.length - 1] || "").split("text=")[1] || "");
  check("paid receipt shows method and fully paid", /نقد/.test(msg) && /مدفوع بالكامل/.test(msg), msg.split("\n").slice(-6).join(" | "));
  await page.click("#advanceStatusBtn");
  await page.fill("#qf_count", "1");
  await submit(); await later();
  o = await lastOrder();
  check("delivery accepts 1 piece (add-ons not counted as pieces)", o.status === "delivered", o.status);

  // Dashboard sales include the add-ons
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  await nav("dashboard");
  const dash = await page.textContent("#metricsGrid");
  check("dashboard sales 1.750", /1\.750/.test(dash), dash.replace(/\s+/g, " ").slice(0, 160));

  // English mode: receipt in English
  await page.selectOption("#langSelectTop", "en"); await page.waitForTimeout(300);
  const en = await page.evaluate(() => { const o2 = JSON.parse(localStorage.getItem("l997_orders"))[0]; return window.receiptText997(o2.id); });
  check("English receipt", /Receipt — Order/.test(en) && /Dry Clean/.test(en) && /Fully paid/.test(en), en.split("\n").slice(0, 3).join(" | "));

  // Last-backup date is read correctly (it used to show "Invalid Date" and stop the 7-day backup reminder)
  await page.selectOption("#langSelectTop", "ar").catch(() => {});
  await page.waitForLoadState("load"); await page.waitForSelector("body:not(.auth-locked)");
  await nav("profile");
  await page.click("#exportBackupBtn").catch(() => {});
  await page.waitForTimeout(300);
  await nav("dashboard"); await nav("profile");
  const note = await page.textContent("#lastBackupNote");
  check("last backup date shown correctly after export", /آخر نسخة احتياطية/.test(note) && !/Invalid/.test(note), note);

  // Storage blocked (in-app browser / private mode): a clear warning instead of a silent "first-time setup"
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p2.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("blocked", "SecurityError"); }; });
  await p2.goto(await serve(file));
  const warn = await p2.textContent("#authMemWarn").catch(() => "");
  check("blocked storage shows a clear 'nothing will be saved' warning on the first screen", /الحفظ غير متاح/.test(warn) && /nothing will be saved/.test(warn), warn.slice(0, 60));
  await ctx2.close();

  // Browsers that wipe the tab's session storage on every load (owner report: signed out after each order / refresh)
  const ctx3 = await browser.newContext({ timezoneId: "Asia/Bahrain" });
  const p3 = await ctx3.newPage();
  await p3.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p3.addInitScript(() => { try { sessionStorage.clear(); } catch (e) { /* ignore */ } });
  await p3.goto(await serve(file));
  await p3.fill("#au_name", "Owner"); await p3.fill("#au_user", "owner"); await p3.fill("#au_pw", PW); await p3.fill("#au_pw2", PW);
  await p3.click("#au_form button[type=submit]"); await p3.check("#au_saved"); await p3.click("#au_next");
  await p3.waitForSelector("body:not(.auth-locked)");
  await p3.reload(); await p3.waitForTimeout(800);
  check("stays signed in after a page refresh even when the browser wipes tab storage", !(await p3.evaluate(() => document.body.classList.contains("auth-locked"))));
  check("no false 'nothing will be saved' warning", !(await p3.isVisible("#authMemWarn")) && !(await p3.isVisible("#memStorageBanner")));
  await p3.click("#logoutBtn"); await p3.waitForTimeout(300);
  await p3.reload(); await p3.waitForTimeout(800);
  check("after signing out, a refresh shows the sign-in screen", await p3.evaluate(() => document.body.classList.contains("auth-locked")));
  await ctx3.close();

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL SERVICE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
