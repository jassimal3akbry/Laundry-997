// Package piece weights: big items use more of a package (abaya = 2, comforter = 5, double bedsheet = 4,
// iron-only = 2, jalabiya = 2), curtains and shoes are outside packages, and the balance stays right through
// save, edit, cancel and reload. The owner can change the weights in Settings → Packages.
// Usage: node tests/e2e.pkgweights.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {}; window.open = (url) => { if (/whatsapp/.test(url || "")) sessionStorage.setItem("__wa", decodeURIComponent(String(url).split("text=")[1] || "")); return { closed: false }; };
    if (localStorage.getItem("l997_customers")) return;
    const now = new Date().toISOString();
    localStorage.setItem("l997_customers", JSON.stringify([{ id: "c1", name: "Pkg Cust", phone: "97333990011", balance: 0, createdAt: now }, { id: "c2", name: "Iron Cust", phone: "97333990022", balance: 0, createdAt: now }, { id: "c3", name: "Abaya Cust", phone: "97333990033", balance: 0, createdAt: now }]));
    localStorage.setItem("l997_customer_packages", JSON.stringify([
      { id: "cp1", customerId: "c1", defId: "pd_wi", name: "باقة 20", serviceType: "washiron", garments: [], totalPieces: 20, remainingPieces: 20, price: 5, purchasedAt: now },
      { id: "cp2", customerId: "c2", defId: "pd_ir", name: "باقة كوي 10", serviceType: "iron", garments: [], totalPieces: 10, remainingPieces: 10, price: 2, purchasedAt: now },
      { id: "cp3", customerId: "c3", defId: "pd_ab", name: "باقة العبايات", serviceType: "washiron", garments: ["abaya_plain"], totalPieces: 25, remainingPieces: 25, price: 20, purchasedAt: now }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const pkg = async (id) => (await ls("l997_customer_packages")).find((p) => p.id === id);
  const tap = (id) => page.click(`#posProductGrid [data-cloth="${id}"]`);
  const pick = async (phone) => { await closeAll(); await nav("new-order"); await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(200); await page.click("#customerResults [data-pick]"); await wait(150); };
  const saveOrder = async () => { await page.click("#posSaveOrderMainBtn"); await wait(400); await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); await closeAll(); return (await ls("l997_orders"))[0]; };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  const st = await ls("l997_settings");
  check("default weights saved: abaya 2, comforter 5, double bedsheet 4, iron-only 2, jalabiya 2, curtain/shoes out",
    st.packageWeights && st.packageWeights.abaya_plain.washiron === 2 && st.packageWeights.duvet.washiron === 5 && st.packageWeights.bedsheet_double.washiron === 4 && st.packageWeights.bedsheet_double.iron === 2 && st.packageWeights.jalabiya.washiron === 2 && st.packageWeights.curtain_per_m.washiron === 0 && st.packageWeights.shoes.washiron === 0, JSON.stringify(st.packageWeights));

  /* wash & iron package of 20: abaya (2) + comforter (5) + double bedsheet (4) + jalabiya (2) + shirt (1) = 14 */
  await pick("33990011");
  for (const g of ["abaya_plain", "duvet", "bedsheet_double", "jalabiya", "shirt"]) await tap(g);
  const cartTxt = await page.textContent("#orderItemsBody");
  check("cart shows the weight on big items and 6 left", /القطعة = 5/.test(cartTxt) && /القطعة = 2/.test(cartTxt) && /متبقي 6/.test(cartTxt), cartTxt.replace(/\s+/g, " ").slice(0, 300));
  // shoes are outside packages → normal price
  await tap("shoes");
  let draft = await page.evaluate(() => [...document.querySelectorAll("#orderItemsBody .pos-cart-row")].map((r) => r.textContent.replace(/\s+/g, " ")));
  check("shoes are outside packages: charged at the normal price", draft.some((r) => /حذاء/.test(r) && !/من الباقة/.test(r) && /1\.500/.test(r)), draft.join(" | "));
  // a second comforter (5) doesn't fit in the 6 left after one more double bedsheet (4)? 6 left: add bedsheet (4) → 2 left; comforter (5) → normal price
  await tap("bedsheet_double"); await tap("duvet");
  draft = await page.evaluate(() => [...document.querySelectorAll("#orderItemsBody .pos-cart-row")].map((r) => r.textContent.replace(/\s+/g, " ")));
  check("when the package balance is less than the item weight, the item is charged normally", draft.filter((r) => /لحاف/.test(r) && !/من الباقة/.test(r)).length === 1, draft.join(" | "));
  const o1 = await saveOrder();
  let p1 = await pkg("cp1");
  check("saving the order takes 18 pieces from the package (2+5+4+4+2+1), 2 left", p1.remainingPieces === 2, p1.remainingPieces);
  check("order total = shoes 1.500 + extra comforter 1.500 = 3.000", Math.abs(o1.payment.total - 3) < 0.001, o1.payment.total);
  check("order items keep their weight (old orders stay right if weights change later)", o1.items.some((it) => it.clothingId === "duvet" && it.pkgW === 5 && it.fromPackageId === "cp1"));

  // reload: the balance is recomputed from orders and must stay 2 (not reset by counting pieces)
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await wait(500);
  p1 = await pkg("cp1");
  check("after reload the package still shows 2 left (usage recomputed with weights)", p1.remainingPieces === 2, p1.remainingPieces);

  // last 2 pieces: an abaya (2) fits exactly; a shirt after it goes normal price
  await pick("33990011"); await tap("abaya_plain"); await tap("shirt");
  const o2 = await saveOrder();
  p1 = await pkg("cp1");
  check("abaya uses the last 2 pieces exactly; the next shirt is charged", p1.remainingPieces === 0 && o2.items.some((it) => it.clothingId === "shirt" && !it.fromPackageId && it.total > 0), JSON.stringify({ left: p1.remainingPieces, items: o2.items.map((i) => [i.clothingId, i.fromPackageId, i.total]) }));

  // cancelling the first order gives back 18 pieces
  await closeAll(); await nav("orders"); await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), o1.id); await wait(200);
  const cancelBtn = await page.$("#cancelOrderBtn");
  if (cancelBtn) {
    await cancelBtn.click(); await wait(200);
    await page.waitForSelector("#qf_reason", { timeout: 3000 }).catch(() => {});
    if (await page.isVisible("#qf_reason").catch(() => false)) await page.fill("#qf_reason", "test");
    if (await page.isVisible("#quickFormSubmitBtn")) await page.click("#quickFormSubmitBtn");
    await wait(200); if (await page.isVisible("#confirmOkBtn").catch(() => false)) await page.click("#confirmOkBtn");
    await wait(400);
    p1 = await pkg("cp1");
    check("cancelling the order returns its 18 package pieces", p1.remainingPieces === 18, p1.remainingPieces);
  } else check("cancel button found", false);

  /* iron-only package: double bedsheet = 2 per piece, abaya = 2 */
  await pick("33990022"); await tap("bedsheet_double"); await tap("abaya_plain"); await tap("shirt");
  const o3 = await saveOrder();
  const p2 = await pkg("cp2");
  check("iron-only package: double bedsheet 2 + abaya 2 + shirt 1 = 5 pieces, 5 left, nothing charged", p2.remainingPieces === 5 && o3.payment.total === 0 && o3.items.every((i) => i.serviceId === "iron"), JSON.stringify({ left: p2.remainingPieces, total: o3.payment.total }));

  /* owner changes weights in Settings → Packages */
  await closeAll(); await nav("settings"); await page.evaluate(() => document.querySelector('[data-settings-tab="packages"]')?.click()); await wait(300);
  const rows = await page.$$eval("#packageWeightsBody tr", (r) => r.length);
  check("Settings → Packages shows the weights table", rows > 10, rows);
  await page.fill('#packageWeightsBody [data-pkgw="duvet"][data-svc="washiron"]', "6");
  await page.click("#savePackageWeightsBtn"); await wait(200);
  check("owner can change a weight (comforter → 6)", (await ls("l997_settings")).packageWeights.duvet.washiron === 6);

  /* selling a package: the WhatsApp confirmation tells the customer how big items count */
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.packageDefs = [{ id: "pd_wi", name: "باقة 20", serviceType: "washiron", pieceCount: 20, price: 5, garments: [] }]; s.prices.cg_curt_washiron = 3; localStorage.setItem("l997_settings", JSON.stringify(s));
    localStorage.setItem("l997_custom_garments", JSON.stringify([{ id: "cg_curt", name: "ستائر", cat: "home", icon: "🧺" }])); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await page.evaluate(() => window.openCustomerProfile997("c2")); await wait(200);
  await page.click("#cpSellPkg"); await page.waitForSelector("#qf_defId"); await page.click("#quickFormSubmitBtn"); await wait(300);
  await page.waitForSelector("#quickFormSubmitBtn", { state: "visible", timeout: 3000 }); await page.click("#quickFormSubmitBtn"); await wait(300);
  const wa = await page.evaluate(() => sessionStorage.getItem("__wa") || "");
  check("package WhatsApp confirmation explains the counts (comforter 6 after the change, abaya 2, double bedsheet 4) and what is not included",
    /لحاف = 6 قطع/.test(wa) && /عباية.*= قطعتين/.test(wa) && /شرشف دبل = 4 قطع/.test(wa) && /خارج الباقة:.*ستائر/.test(wa) && /حذاء/.test(wa), wa);
  // a curtain item the owner added by hand is recognised by its name and charged normally even for a package customer
  await pick("33990022"); await page.click('#posProductGrid [data-cloth="cg_curt"]'); await wait(150);
  const curt = await page.evaluate(() => document.getElementById("orderItemsBody").textContent.replace(/\s+/g, " "));
  check("owner-added «ستائر» item is outside packages (normal price 3.000)", /ستائر/.test(curt) && !/من الباقة/.test(curt) && /3\.000/.test(curt), curt.slice(0, 200));

  // a package made for one item (abayas only): each abaya uses 1 piece of it, not the open-package weight of 2
  await pick("97333990033"); await tap("abaya_plain"); await tap("abaya_plain"); await tap("abaya_plain");
  const oAb = await saveOrder();
  const abLine = oAb.items.find((i) => i.clothingId === "abaya_plain");
  check("abaya-only package: 3 abayas use 3 pieces (25 → 22), no charge for them", (await pkg("cp3")).remainingPieces === 22 && abLine && abLine.qty === 3 && abLine.unit === 0 && abLine.pkgW === 1, JSON.stringify({ left: (await pkg("cp3")).remainingPieces, abLine }));
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PACKAGE-WEIGHT CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
