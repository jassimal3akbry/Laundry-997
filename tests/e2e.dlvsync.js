// Delivery across devices (cloud): a pickup booked on the shop computer shows on the tablet, the driver status
// syncs back, the order made from the pickup reaches the computer with its delivery trips, and a package
// customer's free trips are counted the same on both devices.
// Usage: node tests/e2e.dlvsync.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`); if (!cond) failures++; }
const PW = "Owner#2026pass";

(async () => {
  const cloud = await startStandin({ latencyMs: 40 });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag, vp) {
    const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: vp || { width: 1280, height: 900 } })).newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); window.print = () => {}; }, { url: cloud.url, key: "k" });
    await page.goto(url);
    return page;
  }
  const nav = (p, pg) => p.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = (p) => p.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (p, k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const later = async (p) => { await p.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 1500 }).catch(() => {}); if (await p.isVisible("#quickFormCancelBtn")) await p.click("#quickFormCancelBtn"); await p.waitForTimeout(150); };

  // A: shop computer — owner creates the shop, links the cloud
  const A = await device("A");
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", PW); await A.fill("#au_pw2", PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  await nav(A, "profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  await A.waitForFunction(() => window.L997Cloud && window.L997Cloud.status().linked, null, { timeout: 30000 });
  await A.waitForTimeout(2500); await closeAll(A);
  // a package customer
  await nav(A, "new-order"); await A.click("#posCustomerBarBtn"); await A.fill("#orderCustomerPhone", "33550001"); await A.waitForTimeout(150);
  await A.click("#newCustomerFromNoResultBtn"); await A.fill("#customerName", "Sara Pkg"); await A.fill("#customerPhone", "33550001"); await A.fill("#customerAddress", "الرفاع مجمع 905"); await A.click("#saveCustomerBtn");
  await closeAll(A);
  const sara = (await ls(A, "l997_customers")).find((c) => c.name === "Sara Pkg");
  await A.evaluate((cid) => { const a = JSON.parse(localStorage.getItem("l997_customer_packages") || "[]"); a.unshift({ id: "cpS", customerId: cid, defId: "d", name: "باقة 30", serviceType: "washiron", garments: [], totalPieces: 30, remainingPieces: 30, price: 6, purchasedAt: new Date().toISOString() }); localStorage.setItem("l997_customer_packages", JSON.stringify(a)); }, sara.id);
  await A.waitForTimeout(3000);

  // B: tablet (iPad size) joins the same shop
  const B = await device("B", { width: 820, height: 1180 });
  await B.click("#au_cloud_join");
  // a new device does not know employee numbers yet → clear message instead of "wrong username or password"
  await B.fill("#au_user", "0001"); await B.fill("#au_pass", PW); await B.click("#au_form button[type=submit]");
  await B.waitForFunction(() => /رقم وظيفي/.test(document.getElementById("au_err").textContent), null, { timeout: 15000 }).catch(() => {});
  check("new device + employee number: tells the worker to use the username", /رقم وظيفي/.test(await B.textContent("#au_err")) && /اسم الدخول/.test(await B.textContent("#au_err")), await B.textContent("#au_err"));
  await B.fill("#au_user", "owner"); await B.fill("#au_pass", PW);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await B.waitForTimeout(300); await B.fill("#au_user", "owner"); await B.fill("#au_pass", PW); await B.click("#au_form button[type=submit]");
  await B.waitForTimeout(1500); if (await B.isVisible("#au_saved")) { await B.check("#au_saved"); await B.click("#au_next"); }
  await B.waitForSelector("body:not(.auth-locked)");
  await B.waitForFunction(() => JSON.parse(localStorage.getItem("l997_customer_packages") || "[]").some((p) => p.id === "cpS"), null, { timeout: 20000 });

  // 1) A books a pickup for Sara → B sees it on its delivery page
  await closeAll(A); await nav(A, "delivery"); await A.waitForTimeout(200);
  await A.click("#newPickupBtn"); await A.fill("#qf_cust", "Sara"); await A.waitForTimeout(150); await A.click(".dlv-suggest [data-cid]"); await A.waitForTimeout(100);
  await A.click("#quickFormSubmitBtn"); await A.waitForTimeout(300); await later(A); await closeAll(A);
  await B.waitForFunction(() => JSON.parse(localStorage.getItem("l997_suspended_orders") || "[]").some((x) => x.kind === "pickup"), null, { timeout: 20000 });
  await B.waitForTimeout(2500); await closeAll(B); await nav(B, "delivery"); await B.waitForTimeout(300);
  const req = (await ls(B, "l997_suspended_orders")).find((x) => x.kind === "pickup");
  check("pickup booked on the computer appears on the tablet's delivery page", await B.isVisible(`[data-req-onway="${req.id}"]`) && /Sara Pkg/.test(await B.textContent("#deliveryRoot")));
  check("…with the package badge (4 free trips left)", /4 مشاوير مجانية متبقية/.test(await B.textContent("#deliveryRoot")));

  // 2) tablet: driver leaving → computer sees «on the way»
  await B.click(`[data-req-onway="${req.id}"]`); await B.waitForTimeout(300);
  await A.waitForFunction((id) => (JSON.parse(localStorage.getItem("l997_suspended_orders") || "[]").find((x) => x.id === id) || {}).status === "onway", req.id, { timeout: 20000 });
  check("driver status from the tablet reaches the computer", true);

  // 3) tablet: clothes collected → order with 2 items, pickup + delivery free (package) → computer gets it
  await B.waitForTimeout(500); await closeAll(B); await nav(B, "delivery"); await B.waitForTimeout(300);
  await B.click(`[data-req-done="${req.id}"]`); await B.waitForTimeout(400);
  await B.click('#posProductGrid [data-cloth="shirt"]'); await B.click('#posProductGrid [data-cloth="shirt"]');
  await B.click("#posSaveOrderMainBtn"); await B.waitForTimeout(500); await later(B); await closeAll(B);
  const ob = (await ls(B, "l997_orders"))[0];
  check("tablet order from the pickup: both trips free for the package customer", ob && ob.delivery && ob.delivery.pickup && ob.delivery.drop && ob.extras.filter((l) => l.free === "package").length === 2, JSON.stringify(ob && ob.extras));
  await A.waitForFunction((id) => JSON.parse(localStorage.getItem("l997_orders") || "[]").some((o) => o.id === id), ob.id, { timeout: 20000 });
  await A.waitForFunction((id) => !JSON.parse(localStorage.getItem("l997_suspended_orders") || "[]").some((x) => x.id === id), req.id, { timeout: 20000 });
  check("the order reaches the computer and the booking is cleared there too", true);

  // 4) computer: a second order for Sara counts the free trips already used on the tablet (2 of 4 used)
  await A.waitForTimeout(2500); await closeAll(A); await nav(A, "new-order"); await A.waitForTimeout(200);
  await A.click("#posCustomerBarBtn"); await A.fill("#orderCustomerPhone", "33550001"); await A.waitForTimeout(200); await A.click("#customerResults [data-pick]"); await A.waitForTimeout(150);
  await A.click('#posProductGrid [data-cloth="shirt"]'); await A.check("#dlvDrop"); await A.waitForTimeout(150);
  const q = (await A.textContent("#dlvQuote")).replace(/\s+/g, " ");
  check("computer sees Sara's free trips used on the tablet: 2 of 4", /2 من 4/.test(q), q);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL DELIVERY-SYNC CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
