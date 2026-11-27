// Live updates from other devices must not disturb the person working: no full page reload when another device
// only logs in, the scroll position stays where it was, and the new-order product search / category stay as typed.
// Usage: node tests/e2e.nojump.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
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

(async () => {
  const cloud = await startStandin({ latencyMs: 60 });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag, height) {
    const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: height || 900 } })).newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); window.print = () => {}; }, { url: cloud.url, key: "k" });
    await page.goto(url);
    return page;
  }
  const nav = (p, pg) => p.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = (p) => p.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));

  // A: owner creates the shop and links it to the cloud
  const A = await device("A", 500);
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", PW); await A.fill("#au_pw2", PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  await nav(A, "profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  await A.waitForFunction(() => window.L997Cloud && window.L997Cloud.status().linked, null, { timeout: 30000 });
  await A.waitForTimeout(3000); await closeAll(A);
  await nav(A, "dashboard"); await A.waitForTimeout(500);
  // marker that disappears if the page reloads; scroll timeline sampled every 100 ms
  const arm = () => A.evaluate(() => { window.__mark = 1; window.__ys = []; window.__refreshes = 0; const h = window.L997CloudHost, o = h.refresh; h.refresh = () => { window.__refreshes++; o(); }; window.scrollTo(0, 400); clearInterval(window.__iv); window.__iv = setInterval(() => window.__ys.push(Math.round(window.scrollY)), 100); });
  const state = () => A.evaluate(() => ({ mark: window.__mark, refreshes: window.__refreshes, minY: window.__ys && window.__ys.length ? Math.min(...window.__ys.slice(2)) : null, y: Math.round(window.scrollY) }));
  await arm();

  // B: a second owner device (laptop + phone) joins — this writes "last login" for the owner account
  const B = await device("B");
  await B.click("#au_cloud_join"); await B.fill("#au_user", "owner"); await B.fill("#au_pass", PW);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await B.waitForTimeout(300); await B.fill("#au_user", "owner"); await B.fill("#au_pass", PW); await B.click("#au_form button[type=submit]");
  await B.waitForTimeout(1500); if (await B.isVisible("#au_saved")) { await B.check("#au_saved"); await B.click("#au_next"); }
  await B.waitForSelector("body:not(.auth-locked)");
  await A.waitForTimeout(9000);
  let s = await state();
  check("another device logging in does not reload this screen", s.mark === 1, JSON.stringify(s));
  check("…and the scroll position is kept", s.mark === 1 && s.minY >= 380, JSON.stringify(s));

  // B creates an order → A shows it live without jumping to the top
  if (s.mark !== 1) await arm();
  const later = async () => { await B.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await B.isVisible("#quickFormCancelBtn")) await B.click("#quickFormCancelBtn"); };
  const newOrder = async (phone) => {
    await closeAll(B); await nav(B, "new-order");
    await B.click("#posCustomerBarBtn"); await B.fill("#orderCustomerPhone", phone); await B.waitForTimeout(150);
    await B.click("#newCustomerFromNoResultBtn"); await B.fill("#customerName", "Cust " + phone); await B.fill("#customerPhone", phone); await B.click("#saveCustomerBtn");
    await B.click('#posProductGrid [data-cloth="shirt"]'); await B.click("#posSaveOrderMainBtn"); await B.waitForTimeout(400); await later(); await closeAll(B);
  };
  await newOrder("33001122");
  await A.waitForFunction(() => JSON.parse(localStorage.getItem("l997_orders") || "[]").length === 1, null, { timeout: 20000 });
  await A.waitForTimeout(2500);
  s = await state();
  check("order from the other device arrives with a quiet update (no reload)", s.mark === 1 && s.refreshes >= 1, JSON.stringify(s));
  check("dashboard did not jump back to the top", s.minY >= 380 && s.y >= 380, JSON.stringify(s));
  check("dashboard shows the new order", /1/.test(await A.textContent("#metricsGrid")));

  // while scrolling, the update waits — it is applied after the user stops
  await A.evaluate(() => { window.__refreshes = 0; window.__wheel = setInterval(() => { window.scrollBy(0, 1); window.scrollBy(0, -1); document.dispatchEvent(new WheelEvent("wheel")); }, 300); });
  await newOrder("33001133");
  await A.waitForFunction(() => window.L997Cloud.status && true);
  await A.waitForTimeout(6000);
  const during = await A.evaluate(() => window.__refreshes);
  await A.evaluate(() => clearInterval(window.__wheel));
  await A.waitForTimeout(6000);
  const after = await A.evaluate(() => ({ r: window.__refreshes, n: JSON.parse(localStorage.getItem("l997_orders") || "[]").length }));
  check("no screen update while the user is scrolling; applied once they stop", during === 0 && after.r >= 1 && after.n === 2, JSON.stringify({ during, after }));

  // A on the new-order screen: typed product search and chosen category survive a live update
  await nav(A, "new-order"); await A.waitForTimeout(300);
  const cat = await A.evaluate(() => { const b = [...document.querySelectorAll(".pos-cat-tab")].find((x) => x.dataset.cat !== "all"); b.click(); return b.dataset.cat; });
  await A.fill("#posProductSearch", "sh"); await A.evaluate(() => document.activeElement.blur());
  await A.evaluate(() => { window.__mark = 1; window.__refreshes = 0; });
  await newOrder("33001144");
  await A.waitForFunction(() => JSON.parse(localStorage.getItem("l997_orders") || "[]").length === 3, null, { timeout: 20000 });
  await A.waitForTimeout(2500);
  const ns = await A.evaluate(() => ({ mark: window.__mark, r: window.__refreshes, q: document.getElementById("posProductSearch").value, cat: (document.querySelector(".pos-cat-tab.active") || {}).dataset?.cat, page: document.getElementById("page-new-order").classList.contains("active") }));
  check("new-order screen keeps the product search text and category after a live update", ns.mark === 1 && ns.r >= 1 && ns.q === "sh" && ns.cat === cat && ns.page, JSON.stringify({ ...ns, want: cat }));

  // a real settings change still applies everywhere (full refresh), and returns to the same page and scroll
  await nav(A, "dashboard"); await A.waitForTimeout(300); await A.evaluate(() => window.scrollTo(0, 400));
  await B.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.shopName = "997 Laundry Riffa"; localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await A.waitForFunction(() => !window.__mark, null, { timeout: 30000 }).catch(() => {});
  await A.waitForSelector("body:not(.auth-locked)"); await A.waitForTimeout(800);
  const fr = await A.evaluate(() => ({ name: JSON.parse(localStorage.getItem("l997_settings")).shopName, dash: document.getElementById("page-dashboard").classList.contains("active"), y: Math.round(window.scrollY) }));
  check("settings change from another device still reaches this screen, same page and scroll", fr.name === "997 Laundry Riffa" && fr.dash && fr.y >= 380, JSON.stringify(fr));

  // a device running an older copy of the system must not push the price list back to an older version (reload ping-pong)
  const cv = async () => (await cloud.query("select data->>'catalogVersion' v from public.records where collection='settings' and not deleted")).rows[0].v;
  await B.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.catalogVersion = 99; localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await A.waitForTimeout(15000); await A.waitForSelector("body:not(.auth-locked)");
  const h1 = (await cloud.query("select max(id)::int m from public.record_history where collection='settings'")).rows[0].m;
  await A.waitForTimeout(12000);
  const h2 = (await cloud.query("select max(id)::int m from public.record_history where collection='settings'")).rows[0].m;
  check("older system copy leaves a newer price list alone and the devices settle (no settings ping-pong)", (await cv()) === "99" && h1 === h2, JSON.stringify({ v: await cv(), h1, h2 }));
  await B.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.catalogVersion = 4; localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await A.waitForTimeout(12000); await A.waitForSelector("body:not(.auth-locked)");

  // safety net: if full reloads ever repeat (3 within 2 minutes), stop reloading by itself and show the update button
  await nav(A, "dashboard"); await A.waitForTimeout(300);
  await A.evaluate(() => { window.__mark = 1; const n = Date.now(); sessionStorage.setItem("l997_cloud_reloads", JSON.stringify([n - 30000, n - 20000, n - 10000])); });
  await B.evaluate(() => { const s = JSON.parse(localStorage.getItem("l997_settings")); s.shopName = "997 Laundry"; localStorage.setItem("l997_settings", JSON.stringify(s)); });
  await A.waitForTimeout(12000);
  const storm = await A.evaluate(() => ({ mark: window.__mark, chip: !!document.getElementById("cloudUpdateChip") && document.getElementById("cloudUpdateChip").style.display !== "none" }));
  check("repeated reloads are stopped: no 4th automatic reload, the update button is shown instead", storm.mark === 1 && storm.chip, JSON.stringify(storm));
  await A.click("#cloudUpdateChip"); await A.waitForSelector("body:not(.auth-locked)"); await A.waitForTimeout(800);
  check("pressing the update button applies the change", (await A.evaluate(() => JSON.parse(localStorage.getItem("l997_settings")).shopName)) === "997 Laundry");

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL NO-JUMP CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
