// Settings → prices: switching a product off/on must never lose prices; the wash-only service can be switched off.
// Usage: node tests/e2e.pricing.js [path-to-html]
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
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("l997_settings")));
  const toPricing = async () => { await nav("dashboard"); await nav("settings"); await page.click('[data-settings-tab="pricing"]'); };

  await toPricing();
  // 1) edit prices, then switch the product off and on before pressing Save
  await page.fill('[data-price="shirt_iron"]', "0.444"); await page.fill('[data-price="shirt_dryclean"]', "0.9");
  await page.uncheck('[data-garment-active="shirt"]'); await page.check('[data-garment-active="shirt"]');
  const shown = [await page.inputValue('[data-price="shirt_iron"]'), await page.inputValue('[data-price="shirt_dryclean"]')];
  check("typed prices stay on screen after switching the product off and on", shown[0] === "0.444" && shown[1] === "0.9", shown.join(" / "));
  await page.click("#savePricesBtn"); await page.waitForTimeout(250);
  let s = await saved();
  check("…and are saved", s.prices.shirt_iron === 0.444 && s.prices.shirt_dryclean === 0.9, JSON.stringify([s.prices.shirt_iron, s.prices.shirt_dryclean]));
  // 2) saved prices survive switching off, refresh, switching on
  await page.uncheck('[data-garment-active="shirt"]'); await page.waitForTimeout(150);
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)"); await toPricing();
  check("switched-off product stays off after refresh, prices kept", (await saved()).garmentActive.shirt === false && (await saved()).prices.shirt_iron === 0.444);
  await page.check('[data-garment-active="shirt"]'); await page.waitForTimeout(150);
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)"); await toPricing();
  s = await saved();
  check("switched back on: same prices as before (nothing reset to the default list)", s.garmentActive.shirt !== false && s.prices.shirt_iron === 0.444 && s.prices.shirt_dryclean === 0.9 && (await page.inputValue('[data-price="shirt_iron"]')) === "0.444", JSON.stringify([s.prices.shirt_iron, s.prices.shirt_dryclean]));

  if (process.env.SKIP_WASH !== "1") {
    // 3) wash-only service switched off; iron, wash & iron and dry clean stay
    await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122");
    await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Ali"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn");
    await page.click('#posProductGrid [data-cloth="thob_cotton"]');
    const opts = await page.$$eval("[data-service-change] option", (os) => os.map((o) => o.value));
    check("order screen: wash-only is not offered; iron, wash & iron available (and dry clean when priced)", !opts.includes("wash") && opts.includes("iron") && opts.includes("washiron"), opts.join(","));
    const def = await page.$eval("[data-service-change]", (el) => el.value);
    check("tapping a garment never picks wash-only", def !== "wash", def);
    await page.click('#posProductGrid [data-cloth="shirt"]');
    const shirtOpts = await page.$$eval("[data-service-change]", (els) => [...els[els.length - 1].options].map((o) => o.value));
    check("dry clean offered where it has a price", shirtOpts.includes("dryclean"), shirtOpts.join(","));
    // the setting itself can switch wash back on
    await toPricing();
    const washToggle = await page.$('[data-service-active="wash"]');
    check("Settings show an on/off switch per service (wash is off)", !!washToggle && !(await washToggle.isChecked()));
    const before = JSON.stringify((await saved()).prices);
    await washToggle.check(); await page.waitForTimeout(150); await washToggle.uncheck(); await page.waitForTimeout(150);
    check("switching a service on/off never changes any price", JSON.stringify((await saved()).prices) === before);
  }
  // 4) the shop's own price list (26 items, iron / wash & iron)
  // [iron, wash & iron, dry clean] — 997 Laundry printed price list
  const LIST = { abaya_plain: [0.5, 1], bisht: [1, 2.5], thob_cotton: [0.2, 0.5], ghatra: [0.3, 0.6], gahfiya: [0, 0.2], shaila: [0, 0.2], dupatta: [0.2, 0.3],
    kurta_pyjama: [0.2, 0.5], jalabiya: [0, 1], dress: [0, 1], bdf_uniform: [0.4, 0.8], skirtlong: [0.2, 0.3], shirt: [0.2, 0.4], tshirt: [0.2, 0.4], pants_long: [0.2, 0.4],
    suit2pcs: [1, 1.5], overcoat: [0.8, 1.2, 1.5], overcoat_long: [0, 1.5, 2], jacket: [0, 1, 2], hoodie_jacket: [0, 0.5], cap: [0, 0.5], socks: [0, 0.2],
    underwear: [0.1, 0.2], shoes: [0, 1.5], small_towel: [0, 0.3], bathtowel: [0, 0.5], bedsheet_single: [0.3, 0.5], bedsheet_double: [0.5, 1], pillowcase: [0.4, 0.8],
    tablecloth: [0.3, 0.5], blanket_single: [0, 1.5], blanket_double: [0, 2], duvet: [0, 1.5], carpet_m2: [0, 1.5] };
  const fresh = await browser.newContext({ timezoneId: "Asia/Bahrain" });
  const F = await fresh.newPage(); F.on("pageerror", (e) => errors.push(e.message));
  await F.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await F.goto(await serve(file));
  await F.fill("#au_name", "Owner"); await F.fill("#au_user", "owner"); await F.fill("#au_pw", PW); await F.fill("#au_pw2", PW);
  await F.click("#au_form button[type=submit]"); await F.check("#au_saved"); await F.click("#au_next"); await F.waitForSelector("body:not(.auth-locked)");
  const fs = await F.evaluate(() => JSON.parse(localStorage.getItem("l997_settings")));
  const wrong = Object.entries(LIST).filter(([id, [ir, wi, dc]]) => (fs.prices[id + "_iron"] || 0) !== ir || (fs.prices[id + "_washiron"] || 0) !== wi || (fs.prices[id + "_dryclean"] || 0) !== (dc || 0)).map(([id]) => id);
  check("every item of the price list has exactly its iron / wash & iron / dry-clean price", wrong.length === 0, wrong.join(","));
  const extraDry = Object.keys(fs.prices).filter((k) => /_dryclean$/.test(k) && fs.prices[k] > 0 && !LIST[k.replace(/_dryclean$/, "")][2]);
  check("dry clean only where the list has it (coat, overcoat, jacket)", extraDry.length === 0, extraDry.join(","));
  await F.evaluate(() => document.querySelector('.nav-item[data-page="new-order"]').click());
  const tiles = await F.$$eval("#posProductGrid [data-cloth]", (b) => b.map((x) => x.dataset.cloth));
  check("order screen shows exactly the 34 listed products", tiles.length === 34 && tiles.every((id) => LIST[id]), `${tiles.length}: ${tiles.filter((id) => !LIST[id]).join(",")}`);
  const names = await F.$$eval("#posProductGrid .pos-tile-name", (els) => els.map((e) => e.textContent.trim()));
  check("names as on the list (شيلة, جلابية, بدلة قوة الدفاع, جاكيت هودي, حذاء, منشفة صغيرة, معطف, كوت)", ["شيلة", "جلابية", "بدلة قوة الدفاع", "جاكيت هودي", "حذاء", "منشفة صغيرة", "معطف", "كوت"].every((n) => names.some((x) => x.includes(n))), names.slice(0, 6).join(" | "));
  // urgent: per-item urgent price from the list
  const urgentTotal = async (cloth, qty) => {
    await F.evaluate(() => document.querySelector('.nav-item[data-page="new-order"]').click());
    if (!(await F.isVisible("#posCustomerBarBtn:has-text('Ali')"))) {
      await F.click("#posCustomerBarBtn"); await F.fill("#orderCustomerPhone", "33001122"); await F.waitForTimeout(150);
      if (await F.isVisible("#newCustomerFromNoResultBtn")) { await F.click("#newCustomerFromNoResultBtn"); await F.fill("#customerName", "Ali"); await F.fill("#customerPhone", "33001122"); await F.click("#saveCustomerBtn"); }
      else await F.click("#customerResults [data-pick]");
    }
    for (let i = 0; i < qty; i++) await F.click(`#posProductGrid [data-cloth="${cloth}"]`);
    await F.check("#orderPriorityToggle");
    const t = await F.textContent("#summaryTotal");
    return t;
  };
  const clearCart = async () => { await F.evaluate(() => document.querySelectorAll("[data-remove]").forEach((b) => b.click())); await F.uncheck("#orderPriorityToggle").catch(() => {}); };
  let tt = await urgentTotal("abaya_plain", 2); await clearCart();
  check("urgent abaya (wash & iron) = 1.500 each (list correction): 2 → 3.000", /3\.000/.test(tt), tt);
  tt = await urgentTotal("ghatra", 1); await clearCart();
  check("urgent ghutra = 1.000", /1\.000/.test(tt), tt);
  tt = await urgentTotal("overcoat", 1); await clearCart();
  check("urgent coat = 2.000", /2\.000/.test(tt), tt);
  tt = await urgentTotal("shirt", 3); await clearCart();
  check("urgent shirt = double (0.800 each): 3 → 2.400", /2\.400/.test(tt), tt);
  tt = await urgentTotal("bisht", 1); await clearCart();
  check("urgent bisht = 5.000", /5\.000/.test(tt), tt);
  const nOrders = ((await F.evaluate(() => JSON.parse(localStorage.getItem("l997_orders") || "[]")))).length;
  await F.evaluate(() => document.querySelector('.nav-item[data-page="new-order"]').click());
  await F.click(`#posProductGrid [data-cloth="shoes"]`);
  await F.click("#orderPriorityToggle"); await F.waitForTimeout(200);
  const shoeUrgent = await F.evaluate(() => ({ on: document.getElementById("orderPriorityToggle").checked, chip: document.querySelector("#orderItemsBody [data-urgent-line]").disabled, fee: document.getElementById("summaryUrgent").textContent }));
  check("shoes cannot be urgent (crossed out on the list): the switch does not stay on, ⚡ is disabled, no fee", !shoeUrgent.on && shoeUrgent.chip && /^0\.000/.test(shoeUrgent.fee.trim()) && ((await F.evaluate(() => JSON.parse(localStorage.getItem("l997_orders") || "[]")))).length === nOrders, JSON.stringify(shoeUrgent));
  await F.click("#posSaveOrderMainBtn"); await F.waitForTimeout(400);
  check("…as a normal order it is accepted (1.500)", ((await F.evaluate(() => JSON.parse(localStorage.getItem("l997_orders") || "[]"))))[0]?.payment.total === 1.5);
  // one order with every product of the list (wash & iron): each line and the total exactly as the list
  await F.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  await F.evaluate(() => document.querySelector('.nav-item[data-page="new-order"]').click());
  await F.click("#posCustomerBarBtn"); await F.fill("#orderCustomerPhone", "33001122"); await F.waitForTimeout(150); await F.click("#customerResults [data-pick]");
  for (const id of Object.keys(LIST)) await F.click(`#posProductGrid [data-cloth="${id}"]`);
  const shownAll = await F.textContent("#summaryTotal");
  await F.click("#posSaveOrderMainBtn"); await F.waitForTimeout(500);
  const big = (await F.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))))[0];
  const expectAll = Math.round(Object.values(LIST).reduce((a, [, wi]) => a + wi, 0) * 1000) / 1000;
  const badLines = big.items.filter((it) => it.serviceId !== "washiron" || it.unit !== LIST[it.clothingId][1] || it.total !== it.unit * it.qty).map((it) => `${it.clothingId}:${it.serviceId}:${it.unit}`);
  check("order with all 34 products: every line uses the list price (wash & iron)", big.items.length === 34 && badLines.length === 0, badLines.join(","));
  check(`order total = sum of the list (${expectAll.toFixed(3)}), same on screen and stored`, big.payment.total === expectAll && shownAll.includes(expectAll.toFixed(3)), `${big.payment.total} / ${shownAll}`);
  const rec = await F.evaluate((id) => window.receiptText997(id), big.id);
  check("receipt shows the same total", rec.includes(expectAll.toFixed(3)));
  await fresh.close();
  // 5) upgrade of an existing shop: old prices replaced, own dry-clean prices and urgent % kept, old products only switched off
  const up = await browser.newContext({ timezoneId: "Asia/Bahrain" });
  const U = await up.newPage(); U.on("pageerror", (e) => errors.push(e.message));
  await U.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await U.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("l997_settings", JSON.stringify({ urgentPercent: 50, normalHours: 24, urgentHours: 6, catalogVersion: 2, orderSeq: 7, packageDefs: [], garmentActive: { shirt: false }, prices: { shirt_iron: 0.35, shirt_washiron: 0.2, shirt_dryclean: 0.9, thob_wool_iron: 0.65 } })); localStorage.setItem("l997_orders", JSON.stringify([{ id: "o1", number: "00001", customerId: "c", items: [{ clothingId: "thob_wool", serviceId: "iron", qty: 1, unit: 0.65, total: 0.65 }], status: "delivered", payment: { total: 0.65, paid: 0.65, method: "cash" }, paymentConfirmed: true, createdAt: "2026-10-01T10:00:00Z" }])); } });
  await U.goto(await serve(file));
  const us = await U.evaluate(() => JSON.parse(localStorage.getItem("l997_settings")));
  check("upgrade: new list prices applied (shirt iron 0.200, wash & iron 0.400)", us.prices.shirt_iron === 0.2 && us.prices.shirt_washiron === 0.4, JSON.stringify([us.prices.shirt_iron, us.prices.shirt_washiron]));
  check("upgrade: dry-clean prices exactly as the list (shirt none, coat 1.500)", !us.prices.shirt_dryclean && us.prices.overcoat_dryclean === 1.5);
  check("upgrade: urgent prices from the list (abaya 1.500, ghutra 1.000)", us.urgentPrices.abaya_plain === 1.5 && us.urgentPrices.ghatra === 1);
  check("upgrade: urgent percentage and order counter untouched", us.urgentPercent === 50 && us.orderSeq === 7, JSON.stringify([us.urgentPercent, us.orderSeq]));
  check("upgrade: products not on the list switched off (not deleted); listed ones on", us.garmentActive.thob_wool === false && us.garmentActive.shirt === true && us.garmentActive.bisht === true);
  const oldOrder = await U.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0]);
  check("upgrade: old orders keep their items and amounts", oldOrder.items[0].clothingId === "thob_wool" && oldOrder.payment.total === 0.65);
  await up.close();

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PRICING CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
