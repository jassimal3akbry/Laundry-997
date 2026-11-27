// Go-live reset drill against the local Supabase stand-in (real PostgreSQL + the real rules):
// two devices produce test data → supabase/golive_reset.sql → owner device is clean but keeps prices, settings and
// the owner login; staff logins are gone → golive_restore.sql brings everything back → reset again → first real
// order is #00001 and a staff member can be created again with the same username.
// Usage: node tests/e2e.golive.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const fs = require("fs");
const { psql } = require("./local-postgres");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}
const OWNER_PW = "Owner#2026pass", WORKER_PW = "Worker#2026new";
// admin read (like the Supabase SQL editor): one value
const adminVal = (db, sql) => psql(db, ["-At", "-c", sql]).stdout.trim();
function runSql(db, name) {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", name), "utf8");
  const { stdout, stderr } = psql(db, [], sql);
  return stdout + stderr;
}

(async () => {
  const cloud = await startStandin({ latencyMs: 60 });
  // like the real Supabase login table: a computed column (inserting into it directly fails)
  adminVal(cloud.db, "alter table auth.users add column if not exists confirmed_at timestamptz generated always as (updated_at) stored");
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag) {
    const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); window.print = () => {}; HTMLAnchorElement.prototype.click = function () {}; },
      { url: cloud.url, key: "sb_publishable_test", pollMs: 1000, idleMs: 400 });
    await page.goto(url);
    return page;
  }
  const until = async (fn, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) { /* refreshing */ } await new Promise((r) => setTimeout(r, 300)); } return false; };
  const H = (page) => ({
    wait: (ms) => page.waitForTimeout(ms),
    nav: (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg),
    closeAll: () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())),
    submit: async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); },
    later: async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2500 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); },
    ls: (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k),
    status: () => page.evaluate(() => window.L997Cloud.status()),
    async order(phone, name) {
      await this.closeAll(); await this.nav("new-order");
      await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await page.waitForTimeout(250);
      if (await page.isVisible("#newCustomerFromNoResultBtn")) { await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", name); await page.fill("#customerPhone", phone); await page.click("#saveCustomerBtn"); }
      else await page.click("#customerResults [data-pick]");
      await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="thob_cotton"]');
      await page.click("#posSaveOrderMainBtn"); await this.later(); await this.closeAll();
      return (await this.ls("l997_orders"))[0];
    },
  });
  const live = async (col) => (await cloud.query("select record_id, data from public.records where collection = $1 and not deleted", [col])).rows;

  /* ---------- owner device A: real setup + test data ---------- */
  const A = await device("A"); const a = H(A);
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", OWNER_PW); await A.fill("#au_pw2", OWNER_PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  await a.nav("profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", OWNER_PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  await until(async () => (await a.status()).linked && (await a.status()).pending === 0);
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {}); await a.wait(1200); await a.closeAll();
  // a configuration change that must survive the reset
  await a.nav("settings"); await A.click('[data-settings-tab="pricing"]'); await A.fill('[data-price="shirt_iron"]', "0.25"); await A.click("#savePricesBtn"); await a.wait(300);
  // staff + test work
  await a.closeAll(); await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Worker One"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "worker1");
  const tempPw = await A.inputValue("#qf_password"); await A.click("#quickFormSubmitBtn");
  await until(async () => (await cloud.query("select 1 from auth.users where email = 'worker1@997laundry.app'")).rowCount === 1);
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {}); await a.wait(1200); await a.closeAll();
  const o1 = await a.order("33880001", "Test Customer");
  await a.nav("orders"); await A.click(`#ordersBody [data-view="${o1.id}"]`); await A.click("#advanceStatusBtn"); await A.selectOption("#qf_method", "cash"); await A.fill("#qf_paid", "0.1"); await a.submit(); await a.later(); await a.closeAll();
  await a.nav("finance"); await A.click("#addExpenseBtn"); await A.fill("#qf_amount", "3"); await a.submit(); await a.closeAll();

  /* ---------- worker device B ---------- */
  const B = await device("B"); const b = H(B);
  await B.waitForSelector("#au_cloud_join"); await B.click("#au_cloud_join");
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await b.wait(200);
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("#au_pw2"); await b.wait(150);
  await B.fill("#au_pw", WORKER_PW); await B.fill("#au_pw2", WORKER_PW); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("body:not(.auth-locked)");
  await B.waitForSelector("#qf_opening", { timeout: 3000 }).then(async () => { await B.fill("#qf_opening", "0"); await B.click("#quickFormSubmitBtn"); await B.waitForTimeout(300); }).catch(() => {}); // shifts are optional
  await b.order("33880002", "Walk-in");
  check("test data exists in the cloud (orders, customers, payments, expenses, staff)", await until(async () => (await live("orders")).length === 2 && (await live("customers")).length === 2 && (await live("ledger")).length >= 1 && (await live("expenses")).length === 1 && (await a.status()).pending === 0 && (await b.status()).pending === 0));
  await B.context().close(); // staff device closed before the reset (as instructed)

  /* ---------- GO-LIVE RESET ---------- */
  const out1 = runSql(cloud.db, "golive_reset.sql");
  check("reset script runs without error and reports what it did", /GO-LIVE RESET DONE/.test(out1) && !/ERROR/.test(out1), (out1.match(/GO-LIVE RESET DONE[^\n]*/) || [""])[0]);
  check("cloud: no orders, customers, payments, expenses, shifts, audit left", (await live("orders")).length === 0 && (await live("customers")).length === 0 && (await live("ledger")).length === 0 && (await live("expenses")).length === 0 && (await live("shifts")).length === 0 && (await live("audit")).length === 0);
  check("cloud: removed records keep no customer data (names/phones cleared)", (await cloud.query("select count(*)::int n from public.records where deleted and data::text like '%Test Customer%'")).rows[0].n === 0);
  check("cloud: only the owner account remains", (await cloud.query("select count(*)::int n from public.shop_members")).rows[0].n === 1 && (await cloud.query("select count(*)::int n from auth.users where email like '%@997laundry.app'")).rows[0].n === 1);
  check("cloud: prices / settings kept (shirt iron 0.250)", (await live("settings"))[0].data.prices.shirt_iron === 0.25);
  check("cloud: owner's employee record kept", (await live("employees")).length === 1 && (await live("employees"))[0].data.role === "owner");
  check("cloud: next order number is 1", adminVal(cloud.db, "select next_order from public.shop_counters") === "1");
  check("backup taken in a private schema", adminVal(cloud.db, "select count(*) from information_schema.tables where table_schema = 'backup_997' and table_name like 'records_%'") === "1");
  check("backup cannot be read from the website (no access for anon / signed-in users)", adminVal(cloud.db, "select has_schema_privilege('anon', 'backup_997', 'USAGE') or has_schema_privilege('authenticated', 'backup_997', 'USAGE')") === "f");

  check("owner device clears itself on the next sync (orders, customers, payments, expenses gone)", await until(async () => ((await a.ls("l997_orders")) || []).length === 0 && ((await a.ls("l997_customers")) || []).length === 0 && ((await a.ls("l997_ledger")) || []).length === 0 && ((await a.ls("l997_expenses")) || []).length === 0, 30000));
  await A.waitForSelector("body:not(.auth-locked)");
  check("owner still signed in, prices kept on the device", !(await A.evaluate(() => document.body.classList.contains("auth-locked"))) && (await a.ls("l997_settings")).prices.shirt_iron === 0.25);
  check("owner device: only the owner in the staff list", await until(async () => (await a.ls("l997_employees")).length === 1));
  const oldWorker = await cloud.query("select 1 from auth.users where email = 'worker1@997laundry.app'");
  check("old staff login no longer exists", oldWorker.rowCount === 0);

  /* ---------- undo drill: restore, then reset again ---------- */
  const out2 = runSql(cloud.db, "golive_restore.sql");
  check("restore script puts everything back", /RESTORED from backup/.test(out2) && (await live("orders")).length === 2 && (await live("customers")).length === 2 && (await cloud.query("select count(*)::int n from public.shop_members")).rows[0].n === 2, (out2.match(/RESTORED[^\n]*/) || [""])[0]);
  check("restored data reaches the owner device", await until(async () => ((await a.ls("l997_orders")) || []).length === 2, 30000));
  await new Promise((r) => setTimeout(r, 1500)); // a second backup gets its own timestamp
  const out3 = runSql(cloud.db, "golive_reset.sql");
  check("reset again (second backup kept separately)", /GO-LIVE RESET DONE/.test(out3) && adminVal(cloud.db, "select count(*) from information_schema.tables where table_schema = 'backup_997' and table_name like 'records_%'") === "2");
  check("owner device clean again", await until(async () => ((await a.ls("l997_orders")) || []).length === 0 && (await a.ls("l997_employees")).length === 1, 30000));

  /* ---------- first real day ---------- */
  await A.waitForSelector("body:not(.auth-locked)"); await a.wait(1500);
  const first = await a.order("33990001", "First Real Customer");
  check("first real order is #00001", first && first.number === "00001", first && first.number);
  check("…and reaches the cloud", await until(async () => (await live("orders")).some((r) => r.data.number === "00001")));
  await a.closeAll(); await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Worker One"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "worker1"); await A.click("#quickFormSubmitBtn");
  check("a staff member can be created again with the same username", await until(async () => (await cloud.query("select m.role from public.shop_members m join auth.users u on u.id = m.user_id where u.email = 'worker1@997laundry.app'")).rows[0]?.role === "worker"));
  // a brand-new device joining now gets only the clean data
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {}); await a.wait(1200); await a.closeAll();
  const C = await device("C"); const c = H(C);
  await C.waitForSelector("#au_cloud_join"); await C.click("#au_cloud_join");
  await C.fill("#au_user", "owner"); await C.fill("#au_pass", OWNER_PW);
  await Promise.all([C.waitForEvent("load", { timeout: 40000 }), C.click("#au_form button[type=submit]")]);
  await C.waitForSelector("#au_user");
  check("a device joining after the reset receives only the clean data (1 order, prices kept)", ((await c.ls("l997_orders")) || []).length === 1 && (await c.ls("l997_settings")).prices.shirt_iron === 0.25);

  check("nothing rejected by the cloud", (await a.status()).rejected === 0, JSON.stringify((await a.status()).rejectedList));
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL GO-LIVE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
