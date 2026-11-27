// Package terms: validity (days / expiry date or none), free delivery trips per package (monthly or for the
// whole package, or the default from Settings), a weekly regular pickup that shows on the delivery page, and
// discount codes with an expiry date and a maximum number of uses (or none).
// Usage: node tests/e2e.pkgterms.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 300) : ""}`); if (!cond) failures++; }

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {};
    window.open = (url) => { if (/api\.whatsapp\.com\/send/.test(url || "")) { const a = JSON.parse(sessionStorage.getItem("__wa") || "[]"); a.push(decodeURIComponent(String(url).split("text=")[1] || "")); sessionStorage.setItem("__wa", JSON.stringify(a)); } return { closed: false }; };
    if (localStorage.getItem("l997_customers")) return;
    const now = new Date().toISOString();
    localStorage.setItem("l997_customers", JSON.stringify([
      { id: "c1", name: "Huda", phone: "97333660001", balance: 0, area: "الرفاع", address: "مجمع 909", createdAt: now },
      { id: "c2", name: "Mona", phone: "97333660002", balance: 0, area: "سند", address: "مجمع 743", createdAt: now }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const later = async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 1500 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); await wait(150); };
  const lastWa = async () => { const a = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__wa") || "[]")); return a[a.length - 1] || ""; };
  const pick = async (phone) => { await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(200); await page.click("#customerResults [data-pick]"); await wait(150); };
  const fresh = async () => { await closeAll(); await nav("new-order"); await wait(150); while (await page.$("#orderItemsBody [data-remove]")) { await page.click("#orderItemsBody [data-remove]"); await wait(40); } };
  const saveOrder = async () => { await page.click("#posSaveOrderMainBtn"); await wait(400); await later(); await closeAll(); return (await ls("l997_orders"))[0]; };
  const today = await page.evaluate(() => window.L997Finance.todayStr());
  const addDays = (n) => page.evaluate((n) => window.L997Finance.addDays(window.L997Finance.todayStr(), n), n);

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  /* 1) package definitions: one with 30 days + 2 trips for the whole package, one permanent with the default trips */
  const defPkg = async (name, days, trips, period) => {
    await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(150);
    await page.click("#addPackageDefBtn"); await page.fill("#qf_name", name); await page.fill("#qf_pieceCount", "20"); await page.fill("#qf_price", "5");
    await page.fill("#qf_validDays", String(days)); await page.fill("#qf_dlvTrips", trips); await page.selectOption("#qf_dlvPeriod", period);
    await submit();
  };
  await defPkg("شهرية 30 يوم", 30, "2", "total");
  await defPkg("دائمة", 0, "", "month");
  const defs = (await ls("l997_settings")).packageDefs;
  check("package definitions keep validity and trips (30 days + 2 for the whole package; permanent + default)", defs[0].validDays === 30 && defs[0].dlvTrips === 2 && defs[0].dlvPeriod === "total" && defs[1].validDays === 0 && defs[1].dlvTrips === undefined, JSON.stringify(defs.map((d) => [d.name, d.validDays, d.dlvTrips, d.dlvPeriod])));
  const tbl = await page.textContent("#packageDefsBody");
  check("packages table shows validity and free trips", /30 يوم/.test(tbl) && /♾ دائمة/.test(tbl) && /2 طوال الباقة/.test(tbl) && /4 شهرياً/.test(tbl), tbl.replace(/\s+/g, " ").slice(0, 200));

  /* 2) sell the 30-day package to Huda with a weekly pickup today (evening) */
  const wd = await page.evaluate(() => new Date(window.L997Finance.todayStr() + "T12:00:00").getDay());
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c1")); await wait(200);
  await page.click("#cpSellPkg"); await page.waitForSelector("#qf_defId");
  const exp30 = await addDays(30);
  check("sale form fills the expiry date from the package (today + 30)", (await page.inputValue("#qf_expiresAt")) === exp30 && (await page.inputValue("#qf_dlvTrips")) === "2", await page.inputValue("#qf_expiresAt"));
  await page.selectOption("#qf_schedDay", String(wd)); await page.selectOption("#qf_schedSlot", "evening");
  await submit(); await page.waitForSelector("#quickFormSubmitBtn", { state: "visible" }); await submit();
  const m1 = await lastWa();
  check("package WhatsApp: valid until, 2 free trips for the whole package, the regular weekly pickup", m1.includes(`صالحة حتى ${exp30}`) && /2 مشاوير استلام\/توصيل مجانية طوال مدة الباقة/.test(m1) && /موعد استلامك الثابت: كل/.test(m1), m1);
  const cp1 = (await ls("l997_customer_packages")).find((p) => p.customerId === "c1");
  check("sold package stores expiry, trips and schedule", cp1.expiresAt === exp30 && cp1.dlvTrips === 2 && cp1.dlvPeriod === "total" && cp1.schedule.day === wd, JSON.stringify(cp1));
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c1")); await wait(200);
  const prof = await page.textContent("#customerProfileContent");
  check("customer file shows the package terms (valid until, trips, weekly pickup)", /صالحة حتى/.test(prof) && /متبقي 30 يوم/.test(prof) && /2 مشاوير مجانية طوال الباقة/.test(prof), prof.replace(/\s+/g, " ").slice(0, 500));

  /* 3) the regular pickup appears on the delivery page and books in one tap */
  await closeAll(); await nav("delivery"); await wait(250);
  check("delivery page lists Huda's regular pickup for today", await page.isVisible(`[data-reg-book="${cp1.id}|${today}"]`));
  await page.click(`[data-reg-book="${cp1.id}|${today}"]`); await wait(200); await page.waitForSelector("#quickFormSubmitBtn", { state: "visible" }); await submit();
  const req = (await ls("l997_suspended_orders")).find((x) => x.kind === "pickup" && x.customerId === "c1");
  check("one tap books it (today, evening, address from the file) and sends the reminder", req && req.date === today && req.slot === "evening" && req.regular && /مجمع 909/.test(req.address) && /تم تأكيد موعد استلام/.test(await lastWa()), JSON.stringify(req));
  await closeAll(); await nav("delivery"); await wait(200);
  check("…and the regular card for today is gone (no double booking)", !(await page.isVisible(`[data-reg-book="${cp1.id}|${today}"]`)));

  /* 4) trips for the whole package: 2 free, then charged */
  await page.click(`[data-req-onway="${req.id}"]`); await wait(200); await closeAll(); await nav("delivery"); await wait(200);
  await page.click(`[data-req-done="${req.id}"]`); await wait(300);
  await page.click('#posProductGrid [data-cloth="shirt"]');
  const o1 = await saveOrder();
  check("pickup + delivery use the package's 2 free trips (linked to that package)", o1.extras.filter((l) => l.free === "package" && l.pkgId === cp1.id).length === 2, JSON.stringify(o1.extras));
  await fresh(); await pick("33660001"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(150);
  const q2 = (await page.textContent("#dlvQuote")).replace(/\s+/g, " ");
  check("the 3rd trip is charged — the quote says «free trips in the package: 2 of 2»", /المشاوير المجانية في الباقة: 2 من 2/.test(q2) && /0\.500/.test(q2), q2);

  /* 5) permanent package with default trips (4 a month) */
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c2")); await wait(200);
  await page.click("#cpSellPkg"); await page.waitForSelector("#qf_defId"); await page.selectOption("#qf_defId", defs[1].id);
  // the form refills its terms after the choice — wait for that instead of a fixed delay
  await page.waitForFunction(() => document.getElementById("qf_expiresAt").value === "" && document.getElementById("qf_dlvTrips").value === "", null, { timeout: 3000 }).catch(() => {});
  check("choosing the permanent package clears the expiry date", (await page.inputValue("#qf_expiresAt")) === "" && (await page.inputValue("#qf_dlvTrips")) === "");
  await submit(); await later();
  await fresh(); await pick("33660002"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(150);
  const q3 = (await page.textContent("#dlvQuote")).replace(/\s+/g, " ");
  check("permanent package uses the default 4 free trips a month", /المشاوير المجانية هذا الشهر: 0 من 4/.test(q3) && /مجاني ✓/.test(q3), q3);

  /* 6) owner sets an expiry in the past → package stops working (items + trips charged), file says expired */
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c2")); await wait(200);
  await page.click("[data-pkg-edit]"); await page.waitForSelector("#qf_expiresAt");
  await page.fill("#qf_expiresAt", await addDays(-1)); await submit(); await wait(300);
  check("customer file shows the package as expired", /انتهت صلاحيتها/.test(await page.textContent("#customerProfileContent")));
  await fresh(); await pick("33660002"); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.check("#dlvDrop"); await wait(150);
  const t6 = await page.textContent("#summaryTotal");
  check("expired package: the shirt and the delivery are charged normally (0.400 + 0.500)", /0\.900/.test(t6), t6);
  await page.click("#orderItemsBody [data-remove]"); await page.uncheck("#dlvDrop");
  // extend it again: no expiry → works again
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c2")); await wait(200);
  await page.click("[data-pkg-edit]"); await page.waitForSelector("#qf_expiresAt"); await page.fill("#qf_expiresAt", ""); await submit(); await wait(300);
  check("clearing the date makes the package permanent again", /دائمة بدون تاريخ انتهاء/.test(await page.textContent("#customerProfileContent")));

  /* 7) codes: expiry date and maximum uses */
  const addCode = async (code, pct, exp, max) => {
    await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(150);
    await page.click("#addDiscountCodeBtn"); await page.fill("#qf_code", code); await page.fill("#qf_percent", String(pct));
    if (exp) await page.fill("#qf_expiresAt", exp); if (max) await page.fill("#qf_maxUses", String(max)); await page.selectOption("#qf_scope", "all"); await submit();
  };
  await addCode("OLD10", 10, await addDays(-1));
  await addCode("ONCE20", 20, "", 1);
  const codeTbl = await page.textContent("#discountCodesBody");
  check("codes table shows expiry/limits (expired, 0/1 uses, permanent ones)", /منتهي/.test(codeTbl) && /0\/1 استخدام/.test(codeTbl) && /♾ دائم/.test(codeTbl), codeTbl.replace(/\s+/g, " ").slice(0, 300));
  await fresh(); await pick("33660001"); await page.click('#posProductGrid [data-cloth="shoes"]');
  await page.fill("#discountCode", "old10"); await page.click("#applyCodeBtn"); await wait(150);
  check("an expired code is refused", !(await page.isVisible("#removeCodeBtn")));
  await page.fill("#discountCode", "once20"); await page.click("#applyCodeBtn"); await wait(150);
  check("a code with 1 use left works", await page.isVisible("#removeCodeBtn"));
  const oc = await saveOrder();
  check("…order saved with the code", oc.discountCode === "ONCE20" && oc.payment.discount > 0, JSON.stringify({ c: oc.discountCode, d: oc.payment.discount }));
  await fresh(); await pick("33660001"); await page.click('#posProductGrid [data-cloth="shoes"]');
  await page.fill("#discountCode", "once20"); await page.click("#applyCodeBtn"); await wait(150);
  check("…and is refused after its last use", !(await page.isVisible("#removeCodeBtn")));
  const st = (await ls("l997_settings")).discountCodes.filter((c) => c.createdBy === "system");
  check("the 8 customer codes stay permanent with no use limit", st.length === 8 && st.every((c) => !c.expiresAt && !c.maxUses));

  /* ✨ apply recommendations: validity + trips by size, lahaf gift only from 100 pieces, heavy-item weights */
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.packageDefs = [50, 80, 100, 120, 150].map((n) => ({ id: "pk" + n, name: "Package " + n, serviceType: "washiron", pieceCount: n, price: n * 0.3, bonus: "لحاف مجاني", garments: [] })); localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  const soldBefore = JSON.stringify((await ls("l997_customer_packages")).map((p) => [p.expiresAt, p.dlvTrips]));
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(150);
  await page.click("#applyPkgTipsBtn"); await page.waitForSelector("#quickFormSubmitBtn", { state: "visible" });
  check("recommendations dialog lists the changes before applying", /60 يوم/.test(await page.textContent("#quickFormSub")) && /120 يوم/.test(await page.textContent("#quickFormSub")));
  await submit();
  const st2 = await ls("l997_settings");
  const got = st2.packageDefs.map((p) => [p.pieceCount, p.validDays, p.dlvTrips, p.dlvPeriod, p.bonus]);
  check("packages: 50→60d/4, 80→75d/6, 100→90d/8, 120→105d/10, 150→120d/12 (whole package); lahaf gift only from 100",
    JSON.stringify(got) === JSON.stringify([[50, 60, 4, "total", ""], [80, 75, 6, "total", ""], [100, 90, 8, "total", "لحاف مجاني"], [120, 105, 10, "total", "لحاف مجاني"], [150, 120, 12, "total", "لحاف مجاني"]]), JSON.stringify(got));
  check("weights: comforter 4, double bedsheet 3", st2.packageWeights.duvet.washiron === 4 && st2.packageWeights.bedsheet_double.washiron === 3, JSON.stringify(st2.packageWeights.duvet));
  check("packages already sold to customers are not changed", JSON.stringify((await ls("l997_customer_packages")).map((p) => [p.expiresAt, p.dlvTrips])) === soldBefore);

  /* published package list (both flyers): one tap updates matching sizes, adds the rest, removes general sizes not on the list */
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.packageDefs.push({ id: "ir80", name: "كوي 80 قطعة", serviceType: "iron", pieceCount: 80, price: 13.5, bonus: "", garments: [], validDays: 0 }, { id: "abOnly", name: "عبايات 20", serviceType: "washiron", pieceCount: 20, price: 9, bonus: "", garments: ["abaya_plain"], validDays: 0 }); localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  const soldBefore2 = JSON.stringify(await ls("l997_customer_packages"));
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(150);
  await page.click("#addIronPkgsBtn"); await page.waitForSelector("#quickFormSubmitBtn", { state: "visible" });
  check("the dialog lists every change before applying", /استلام من المحل/.test(await page.textContent("#quickFormSub")) && /حذف «كوي 80 قطعة»/.test(await page.textContent("#quickFormSub")));
  await submit();
  const st3 = await ls("l997_settings");
  const got3 = st3.packageDefs.filter((p) => p.catalogKey).map((p) => [p.serviceType, p.pieceCount, p.price, p.validDays, p.dlvTrips, p.bonus]);
  check("12 packages exactly as published",
    JSON.stringify(got3) === JSON.stringify([["iron", 50, 8.5, 60, 0, ""], ["iron", 100, 15.9, 90, 0, ""], ["iron", 150, 22.5, 120, 0, ""], ["iron", 50, 10.9, 60, 4, ""], ["iron", 100, 19.9, 90, 6, ""], ["iron", 150, 27.9, 120, 8, ""],
      ["washiron", 50, 16.9, 60, 4, ""], ["washiron", 80, 25, 75, 6, ""], ["washiron", 100, 30, 90, 8, "لحاف مجاني"], ["washiron", 120, 35, 105, 8, "لحاف مجاني"], ["washiron", 150, 42, 120, 10, "لحاف مجاني"], ["washiron", 200, 54, 150, 12, "لحافان مجاناً"]]), JSON.stringify(got3));
  check("existing sizes keep their id (updated, not duplicated)", ["pk50", "pk80", "pk100", "pk120", "pk150"].every((id) => st3.packageDefs.some((p) => p.id === id && p.catalogKey)));
  check("general sizes not on the list are removed; item-specific packages stay", !st3.packageDefs.some((p) => p.id === "ir80") && st3.packageDefs.some((p) => p.id === "abOnly") && st3.packageDefs.length === 13);
  const W = st3.packageWeights;
  check("weights: abaya/jalabiya 2, comforter & double sheet 2 when ironing, shoes outside", W.abaya_plain.iron === 2 && W.jalabiya.washiron === 2 && W.duvet.iron === 2 && W.bedsheet_double.iron === 2 && W.shoes.washiron === 0 && W.duvet.washiron === 4);
  check("packages already sold are not changed", JSON.stringify(await ls("l997_customer_packages")) === soldBefore2);
  await page.click("#addIronPkgsBtn"); await wait(200);
  check("…pressing again changes nothing", !(await page.isVisible("#quickFormSubmitBtn")) && (await ls("l997_settings")).packageDefs.length === 13);
  await page.click("#applyPkgTipsBtn"); await wait(200);
  check("✨ recommendations leave the published packages alone", JSON.stringify((await ls("l997_settings")).packageDefs.filter((p) => p.catalogKey).map((p) => [p.validDays, p.dlvTrips])) === JSON.stringify(got3.map((r) => [r[3], r[4]])));

  /* the shop's real list: a wide 50-piece package (56 items), iron 50–150 with delivery, item-only packages and a special one */
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("l997_settings"));
    const wide = Array.from({ length: 56 }, (_, i) => "g" + i), D = (id, name, st, n, pr, d, t, extra) => ({ id, name, serviceType: st, pieceCount: n, price: pr, validDays: d, dlvTrips: t, dlvPeriod: "total", bonus: "", garments: [], ...extra });
    s.packageDefs = [D("w50", "Package 50ps", "washiron", 50, 16.9, 30, 4, { garments: wide }), D("w80", "Package 80ps", "washiron", 80, 25, 75, 6), D("w100", "Package 100ps", "washiron", 100, 30, 90, 8, { bonus: "لحاف مجاني" }),
      D("w120", "Package - 120", "washiron", 120, 35, 105, 10), D("w150", "Package - 150", "washiron", 150, 42, 120, 12),
      D("i50", "كوي 50 قطعة", "iron", 50, 10.9, 60, 4), D("i80", "كوي 80 قطعة", "iron", 80, 16.9, 75, 6), D("i100", "كوي 100 قطعة", "iron", 100, 21.9, 90, 8), D("i120", "كوي 120 قطعة", "iron", 120, 23.9, 105, 10), D("i150", "كوي 150 قطعة", "iron", 150, 31.9, 120, 12),
      D("ab", "باقة العبايات", "washiron", 25, 20, 30, null, { garments: ["abaya_plain"], dlvPeriod: "month" }), D("th", "باقة الثوب", "washiron", 25, 9.9, 30, null, { garments: ["thob_cotton"], dlvPeriod: "month" }),
      D("bs", "B-spc", "iron", 150, 30, 0, 4, { dlvPeriod: "month" })];
    localStorage.setItem("l997_settings", JSON.stringify(s));
  });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]').click()); await wait(150);
  await page.click("#addIronPkgsBtn"); await page.waitForSelector("#quickFormSubmitBtn", { state: "visible" });
  check("dialog names the special packages that stay", /B-spc/.test(await page.textContent("#quickFormSub")) && /باقة العبايات/.test(await page.textContent("#quickFormSub")));
  await submit();
  const st4 = await ls("l997_settings"), byId = (id) => st4.packageDefs.find((p) => p.id === id);
  check("wide 50-piece package becomes «wash & iron 50» (all items, 60 days) — no duplicate", byId("w50") && byId("w50").catalogKey === "wi_50" && byId("w50").validDays === 60 && byId("w50").garments.length === 0 && st4.packageDefs.filter((p) => p.catalogKey === "wi_50").length === 1);
  check("wash & iron 120 → 8 deliveries, 150 → 10", byId("w120").dlvTrips === 8 && byId("w150").dlvTrips === 10);
  check("iron 50/100/150 with delivery keep their ids at 10.9/19.9/27.9", byId("i50").catalogKey === "iron_dlv_50" && byId("i100").price === 19.9 && byId("i150").price === 27.9 && byId("i150").dlvTrips === 8);
  check("pick-up iron packages are new (8.5/15.9/22.5, no deliveries)", JSON.stringify(st4.packageDefs.filter((p) => /iron_pick/.test(p.catalogKey || "")).map((p) => [p.price, p.dlvTrips])) === JSON.stringify([[8.5, 0], [15.9, 0], [22.5, 0]]));
  check("iron 80 and 120 removed; abaya/thobe/B-spc untouched", !byId("i80") && !byId("i120") && byId("ab").price === 20 && byId("th").price === 9.9 && byId("bs").name === "B-spc" && byId("bs").price === 30);
  check("B-spc becomes private (hidden from customers); abaya/thobe packages stay public", byId("bs").private === true && !byId("ab").private && !byId("th").private);
  check("12 published + 3 special = 15 packages", st4.packageDefs.length === 15, st4.packageDefs.length);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PACKAGE-TERMS CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
