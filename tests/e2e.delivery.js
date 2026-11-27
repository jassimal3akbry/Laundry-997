// 🚚 Home pickup & delivery: package customers get N free trips a month (then a reduced fee), others pay a small
// fee per trip (free over a set order value). Pickup bookings → driver on the way → clothes arrive → order;
// ready orders → out for delivery → delivered. WhatsApp at each step; fees on the receipt; works on a phone.
// Usage: node tests/e2e.delivery.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 320) : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {};
    window.open = (url) => { if (/api\.whatsapp\.com\/send/.test(url || "")) { const a = JSON.parse(sessionStorage.getItem("__wa") || "[]"); a.push(decodeURIComponent(String(url).split("text=")[1] || "")); sessionStorage.setItem("__wa", JSON.stringify(a)); } return { closed: false }; };
    if (localStorage.getItem("l997_customers")) return;
    const now = new Date().toISOString();
    localStorage.setItem("l997_customers", JSON.stringify([
      { id: "c_pkg", name: "Pkg Lady", phone: "97333220001", balance: 0, area: "الرفاع", address: "مجمع 901 طريق 12 منزل 5", createdAt: now },
      { id: "c_reg", name: "Regular Guy", phone: "97333220002", balance: 0, createdAt: now }]));
    localStorage.setItem("l997_customer_packages", JSON.stringify([{ id: "cp1", customerId: "c_pkg", defId: "d", name: "باقة 50", serviceType: "washiron", garments: [], totalPieces: 50, remainingPieces: 50, price: 10, purchasedAt: now }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const lastWa = async () => { const a = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__wa") || "[]")); return a[a.length - 1] || ""; };
  const waCount = async () => (await page.evaluate(() => JSON.parse(sessionStorage.getItem("__wa") || "[]"))).length;
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const later = async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 1500 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); await wait(150); };
  const pick = async (phone) => { await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(200); await page.click("#customerResults [data-pick]"); await wait(150); };
  const fresh = async () => { await closeAll(); await nav("new-order"); await wait(150); while (await page.$("#orderItemsBody [data-remove]")) { await page.click("#orderItemsBody [data-remove]"); await wait(40); } };
  const saveOrder = async () => { await page.click("#posSaveOrderMainBtn"); await wait(400); await later(); await closeAll(); return (await ls("l997_orders"))[0]; };
  const openOrder = async (id) => { await closeAll(); await nav("orders"); await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id); await wait(150); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  const st = (await ls("l997_settings")).delivery;
  check("delivery is on by default: 0.500 per trip, 4 free trips/month for package customers, then 0.500", st && st.on && st.fee === 0.5 && st.pkgFree === 4 && st.pkgFee === 0.5 && st.freeOver === 0, JSON.stringify(st));
  check("🚚 Delivery appears in the menu", await page.isVisible('.nav-item[data-page="delivery"]'));

  /* package customer: pickup + delivery = 2 free trips; address pre-filled from the customer file */
  await fresh(); await pick("33220001"); await page.click('#posProductGrid [data-cloth="shirt"]');
  await page.check("#dlvPickup"); await page.check("#dlvDrop"); await wait(150);
  const addr = await page.inputValue("#dlvAddress");
  const quote = await page.textContent("#dlvQuote");
  check("address is filled from the customer file", /مجمع 901/.test(addr) && /الرفاع/.test(addr), addr);
  check("package customer sees free trips 0 of 4 and both trips free", /0<\/b> من <b>4|0 من 4/.test(quote.replace(/\s+/g, " ")) || (/عميل باقة/.test(quote) && (quote.match(/مجاني ✓/g) || []).length === 2), quote);
  await page.fill("#dlvDate", "2026-11-06"); await page.selectOption("#dlvSlot", "evening");
  await page.click("#posSaveOrderMainBtn"); await wait(400);
  await page.waitForSelector("#quickFormSubmitBtn", { state: "visible", timeout: 3000 }); await submit(); await closeAll();
  const o1 = (await ls("l997_orders"))[0];
  const dl1 = o1.extras.filter((l) => l.id.startsWith("dlv_"));
  check("order saved with 2 free trips (package) and total = shirt only 0.400", dl1.length === 2 && dl1.every((l) => l.free === "package" && l.total === 0) && Math.abs(o1.payment.total - 0.4) < 0.001 || (o1.items.every((i) => i.fromPackageId) && o1.payment.total === 0 && dl1.every((l) => l.free === "package")), JSON.stringify({ dl1, t: o1.payment.total }));
  check("order keeps delivery details (pickup, drop, address, time, pending)", o1.delivery && o1.delivery.pickup && o1.delivery.drop && o1.delivery.slot === "evening" && o1.delivery.dropStatus === "pending");
  let m = await lastWa();
  check("order confirmation on WhatsApp mentions home delivery (free)", /بنوصل طلبك لبيتك/.test(m) && /مجاني/.test(m), m);

  /* two more package trips use the quota (3,4); the 5th trip is charged 0.500 */
  await fresh(); await pick("33220001"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvPickup"); await page.check("#dlvDrop"); await wait(100);
  const o2 = await saveOrder();
  await fresh(); await pick("33220001"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(100);
  const q5 = await page.textContent("#dlvQuote");
  const o3 = await saveOrder();
  const l3 = o3.extras.find((l) => l.id === "dlv_drop");
  check("after 4 free trips this month, the next package trip costs 0.500", o2.extras.filter((l) => l.free === "package").length === 2 && l3 && !l3.free && l3.total === 0.5 && /4<\/b> من <b>4|4 من 4|بعدها/.test(q5), JSON.stringify({ l3, q5 }));

  /* customer without a package pays 0.500 per trip */
  await fresh(); await pick("33220002"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(100);
  check("regular customer: 0.500 delivery added to the total (0.400 + 0.500 = 0.900)", /0\.900/.test(await page.textContent("#summaryTotal")), await page.textContent("#summaryTotal"));
  await page.fill("#dlvAddress", "https://maps.app.goo.gl/abc123");
  const o4 = await saveOrder();
  check("regular customer order saved with 0.500 trip and a map link address", Math.abs(o4.payment.total - 0.9) < 0.001 && o4.delivery.address.startsWith("https://"), JSON.stringify({ t: o4.payment.total, a: o4.delivery.address }));

  /* receipt text shows free trips as "مجاني" */
  await openOrder(o1.id);
  const det = await page.textContent("#orderDialog, dialog[open]");
  check("order details show the trips (free) and the delivery status", /توصيل للبيت/.test(det) && /مجاني|ضمن الباقة/.test(det) && /بالانتظار/.test(det), det.replace(/\s+/g, " ").slice(0, 300));

  /* order ready → appears in "ready for delivery"; ready message says we'll deliver */
  await page.click("#advanceStatusBtn"); await wait(200);
  if (await page.isVisible("#qf_method")) { await page.selectOption("#qf_method", "later").catch(() => {}); }
  await submit(); await wait(200);
  if (await page.isVisible("#quickFormSubmitBtn")) await submit();
  m = await lastWa();
  check("ready WhatsApp says the order will be delivered home (not 'come by')", /بنوصله لبيتك/.test(m) && !/نتشرف بزيارتك/.test(m), m);
  await closeAll(); await nav("delivery"); await wait(250);
  let board = await page.textContent("#deliveryRoot");
  check("delivery page: the ready order is in «للتوصيل للبيوت» with its address", /للتوصيل للبيوت/.test(board) && /Pkg Lady/.test(board) && await page.isVisible(`[data-drop-onway="${o1.id}"]`), board.replace(/\s+/g, " ").slice(0, 200));
  const badge = await page.textContent('.nav-item[data-page="delivery"] .nav-count');
  check("menu badge counts work waiting (1 ready)", badge.trim() === "1", badge);
  const n0 = await waCount();
  await page.click(`[data-drop-onway="${o1.id}"]`); await wait(250);
  m = await lastWa();
  check("«خرج للتوصيل» sends the customer 'on the way' with the amount due", (await waCount()) === n0 + 1 && /في الطريق لبيتك/.test(m) && /#0+1/.test(m), m);
  check("…and moves the order to «في الطريق»", await page.isVisible(`[data-drop-done="${o1.id}"]`));
  await page.click(`[data-drop-done="${o1.id}"]`); await wait(400);
  if (await page.isVisible("#qf_count")) { await page.fill("#qf_count", String(o1.items.reduce((a, i) => a + i.qty, 0))); await submit(); await wait(400); await later(); }
  const d1 = (await ls("l997_orders")).find((o) => o.id === o1.id);
  check("«تم التوصيل» runs the normal hand-over: order delivered and delivery marked done", d1.status === "delivered" && d1.delivery.dropStatus === "done", JSON.stringify({ s: d1.status, d: d1.delivery.dropStatus }));

  /* pickup booking from the delivery page → driver on the way → clothes arrive → order */
  await closeAll(); await nav("delivery"); await wait(200);
  await page.click("#newPickupBtn"); await page.fill("#qf_cust", "Regular"); await wait(150);
  check("pickup form finds the customer by name as you type", await page.isVisible('.dlv-suggest [data-cid="c_reg"]'));
  if (process.env.SHOTS) await (await page.$("#quickFormDialog")).screenshot({ path: process.env.SHOTS + "/dlv-form.png" });
  await page.click('.dlv-suggest [data-cid="c_reg"]'); await wait(100);
  check("…picking shows the customer confirmed", /Regular Guy/.test(await page.textContent(".dlv-picked")));
  await page.fill("#qf_address", "سند، مجمع 743"); await page.selectOption("#qf_slot", "morning");
  await submit(); await wait(250);
  if (await page.isVisible("#quickFormSubmitBtn")) await submit();
  m = await lastWa();
  check("pickup booking saved and the customer gets a confirmation with the fee 0.500", /تم تأكيد موعد استلام/.test(m) && /0\.500/.test(m) && /سند/.test(m), m);
  const reqs = (await ls("l997_suspended_orders")).filter((x) => x.kind === "pickup");
  check("booking stored (synced with the other devices) and not mixed with suspended carts", reqs.length === 1 && reqs[0].customerId === "c_reg");
  await closeAll(); await nav("delivery"); await wait(200);
  await page.click(`[data-req-onway="${reqs[0].id}"]`); await wait(200);
  m = await lastWa();
  check("«في الطريق» tells the customer the driver is coming to collect", /المندوب في الطريق لك الحين لاستلام/.test(m), m);
  await page.click(`[data-req-done="${reqs[0].id}"]`); await wait(300);
  check("«استلمنا الملابس» opens a new order for that customer with pickup + delivery ticked and the address",
    await page.isChecked("#dlvPickup") && await page.isChecked("#dlvDrop") && /سند/.test(await page.inputValue("#dlvAddress")) && /Regular Guy/.test(await page.textContent("#posCustomerBarText")));
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="shirt"]');
  const o5 = await saveOrder();
  check("order from the pickup: 2 trips × 0.500 + 0.800 = 1.800, booking cleared", Math.abs(o5.payment.total - 1.8) < 0.001 && (await ls("l997_suspended_orders")).filter((x) => x.kind === "pickup").length === 0, o5.payment.total);

  /* a brand-new customer can be booked straight from the pickup form (number + name) */
  await closeAll(); await nav("delivery"); await wait(200);
  await page.click("#newPickupBtn"); await page.fill("#qf_cust", "33229999"); await wait(150);
  check("new number → the form asks for the name (no need to leave the screen)", await page.isVisible("#qf_newname") && /رقم جديد/.test(await page.textContent(".dlv-suggest")));
  await page.fill("#qf_newname", "New Neighbour"); await page.fill("#qf_address", "عسكر"); await submit(); await wait(250);
  if (await page.isVisible("#quickFormSubmitBtn")) await later();
  const nc = (await ls("l997_customers")).find((c) => c.name === "New Neighbour");
  check("…the customer is created and the booking saved", !!nc && (await ls("l997_suspended_orders")).some((x) => x.kind === "pickup" && x.customerId === nc.id));
  await page.evaluate(() => { const a = JSON.parse(localStorage.getItem("l997_suspended_orders")).filter((x) => x.kind !== "pickup"); localStorage.setItem("l997_suspended_orders", JSON.stringify(a)); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }

  /* owner sets "free delivery over 1.000" → a regular order of 1.200 gets free delivery */
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="operating"]').click()); await wait(200);
  await page.fill("#dlvFreeOverSetting", "1"); await page.click("#saveSettingsBtn"); await wait(200);
  await fresh(); await pick("33220002"); for (let i = 0; i < 3; i++) await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(100);
  const o6 = await saveOrder();
  check("free delivery over the owner's limit (1.200 ≥ 1.000 → trip free)", (await ls("l997_settings")).delivery.freeOver === 1 && o6.extras.find((l) => l.id === "dlv_drop").free === "threshold" && Math.abs(o6.payment.total - 1.2) < 0.001, JSON.stringify(o6.extras));

  /* discount codes take off the laundry, not the delivery fee (0.400 shirt −50% = 0.200, + 0.500 trip = 0.700) */
  await closeAll(); await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.delivery.freeOver = 0; s.discountCodes = (s.discountCodes || []).concat([{ code: "HALF50", type: "percent", percent: 50, scope: "all", customerIds: [], active: true }]); localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await fresh(); await pick("33220002"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(100);
  await page.fill("#discountCode", "half50"); await page.click("#applyCodeBtn"); await wait(150);
  check("a 50% code discounts the laundry only: 0.200 + 0.500 delivery = 0.700", /0\.700/.test(await page.textContent("#summaryTotal")), await page.textContent("#summaryTotal"));
  const o7 = await saveOrder();
  check("…saved the same way (discount 0.200, total 0.700)", Math.abs(o7.payment.discount - 0.2) < 0.001 && Math.abs(o7.payment.total - 0.7) < 0.001, JSON.stringify(o7.payment));

  /* money: a delivery order paid in cash counts in sales/collections with its delivery fee, and Reports show delivery */
  for (let step = 0; step < 3; step++) {
    const st0 = (await ls("l997_orders")).find((o) => o.id === o4.id).status;
    if (st0 === "delivered") break;
    await openOrder(o4.id); await page.click("#advanceStatusBtn"); await wait(250);
    if (await page.isVisible("#qf_count")) await page.fill("#qf_count", "1");
    if (await page.isVisible("#qf_method")) { await page.selectOption("#qf_method", "cash").catch(() => {}); if (await page.isVisible("#qf_paid")) await page.fill("#qf_paid", "0.9"); }
    if (await page.isVisible("#quickFormSubmitBtn")) { await submit(); await wait(400); }
    await later(); await closeAll();
  }
  const d4 = (await ls("l997_orders")).find((o) => o.id === o4.id);
  check("delivered with cash: paid 0.900 (0.400 + 0.500 delivery)", d4.status === "delivered" && Math.abs((d4.payment.paid || 0) - 0.9) < 0.001, JSON.stringify(d4.payment));
  const fin = await page.evaluate(() => { const F = window.L997Finance, d = { orders: JSON.parse(localStorage.getItem("l997_orders")), ledger: JSON.parse(localStorage.getItem("l997_ledger") || "[]"), customers: JSON.parse(localStorage.getItem("l997_customers")), customerPackages: [], expenses: [], payroll: [] }; const t = F.todayStr(); const s = F.summarize(d, t, t); return { sales: s.salesTotal, collected: s.collected }; });
  const expSales = (await ls("l997_orders")).filter((o) => o.status === "delivered" && o.paymentConfirmed).reduce((a, o) => a + o.payment.total, 0);
  check("finance: today's sales include the delivery fees (equal to the delivered orders' totals)", Math.abs(fin.sales - expSales) < 0.001 && fin.collected >= 0.9 - 0.001, JSON.stringify({ fin, expSales }));
  await closeAll(); await nav("reports"); await wait(300);
  const rep = await page.textContent("#reportContent");
  check("Reports overview shows a 🚚 Delivery card with trips and income", /التوصيل: \d+ مشوار/.test(rep), (rep.match(/🚚[^د]*د\.ب|🚚.{0,60}/) || [""])[0]);

  /* customer file shows the month's free trips */
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c_pkg")); await wait(200);
  const prof = await page.textContent("#customerProfileContent");
  check("package customer's file: free trips this month 4/4", /المشاوير المجانية هذا الشهر: 4\/4/.test(prof.replace(/\s+/g, " ")), prof.replace(/\s+/g, " ").slice(0, 400));
  check("customer file has «طلب استلام من البيت»", await page.isVisible("#cpPickup"));

  /* phone layout: delivery board fits the screen */
  if (process.env.SHOTS) {
    // a booking + a ready order for the screenshots
    await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c_pkg")); await wait(200); await page.click("#cpPickup"); await wait(150); await submit(); if (await page.isVisible("#quickFormSubmitBtn")) await later();
    await openOrder(o4.id); await page.click("#advanceStatusBtn"); await wait(200); if (await page.isVisible("#qf_method")) await page.selectOption("#qf_method", "later").catch(() => {}); await submit(); if (await page.isVisible("#quickFormSubmitBtn")) await later();
    await closeAll(); await nav("delivery"); await wait(400);
    await page.screenshot({ path: process.env.SHOTS + "/dlv-desktop.png", fullPage: true });
    await fresh(); await pick("33220001"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvPickup"); await page.check("#dlvDrop"); await wait(200);
    await (await page.$("#posDelivery")).screenshot({ path: process.env.SHOTS + "/dlv-pos.png" });
  }
  await closeAll(); await page.setViewportSize({ width: 390, height: 844 }); await nav("delivery"); await wait(400);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("delivery page at phone width: no sideways scrolling", ov <= 1, ov);
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/dlv-phone.png", fullPage: true });

  /* English interface: the delivery page, the pickup form and the order box have no Arabic */
  await page.setViewportSize({ width: 1280, height: 900 });
  await closeAll(); await page.evaluate(() => { const s = document.getElementById("langSelect") || document.querySelector("select[data-lang], #languageSelect"); if (s) { s.value = "en"; s.dispatchEvent(new Event("change", { bubbles: true })); } });
  await wait(600); await page.waitForSelector("body:not(.auth-locked)").catch(() => {});
  if (await page.isVisible("#au_user").catch(() => false)) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  const isEn = await page.evaluate(() => document.documentElement.lang === "en" || document.documentElement.dir === "ltr");
  await nav("delivery"); await wait(300);
  const arab = (t) => (t.match(/[\u0600-\u06FF]{3,}(?:\s+[\u0600-\u06FF]{2,})*/g) || []).filter((x) => !/الرفاع|مجمع|طريق|منزل|سند|عسكر|باقة 50/.test(x));
  const enPage = await page.textContent("#deliveryRoot");
  check("English: delivery page has no Arabic labels (customer addresses aside)", isEn && arab(enPage).length === 0, JSON.stringify(arab(enPage).slice(0, 8)));
  await page.click("#newPickupBtn"); await wait(150);
  const enForm = await page.textContent("#quickFormDialog");
  check("English: pickup form is in English", /Book a home pickup/.test(enForm) && arab(enForm).length === 0, JSON.stringify(arab(enForm).slice(0, 8)));
  await page.click("#quickFormCancelBtn");
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/dlv-en.png", fullPage: true });
  /* iPad and iPhone: no sideways scrolling, buttons big enough to tap */
  for (const [nm, w, h] of [["iPad", 820, 1180], ["iPhone", 390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await nav("delivery"); await wait(300);
    const r = await page.evaluate(() => ({ ov: document.documentElement.scrollWidth - window.innerWidth, small: [...document.querySelectorAll("#deliveryRoot .dlv-main, #deliveryRoot .dlv-ic, #newPickupBtn")].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length }));
    check(`${nm}: delivery page fits the screen and every button is ≥ 44px tall`, r.ov <= 1 && r.small === 0, JSON.stringify(r));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dlv-${nm}.png`, fullPage: true });
  }

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL DELIVERY CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
