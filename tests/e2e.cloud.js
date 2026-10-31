// Cloud sync test: two devices against the local Supabase stand-in (real PostgreSQL + the real security rules).
// Owner device links and uploads → owner adds a worker (cloud account) → a new device joins from the cloud →
// worker changes the temporary password, sees orders but not expenses, creates an order with a server-reserved
// number → owner device receives it while idle → offline work is uploaded when back online → edit conflict is
// resolved in favour of the cloud and logged → password hashes never reach the cloud.
// Usage: node tests/e2e.cloud.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}
const OWNER_PW = "Owner#2026pass", WORKER_NEW_PW = "Worker#2026new";

(async () => {
  const cloud = await startStandin({ latencyMs: Number(process.env.CLOUD_LATENCY_MS || 150) }); // a far-away server, like the real one
  const url = await serve(file);
  const browser = await chromium.launch();
  const errors = [];
  async function device(tag) {
    const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); window.print = () => {}; HTMLAnchorElement.prototype.click = function () {}; },
      { url: cloud.url, key: "sb_publishable_test", pollMs: Number(process.env.CLOUD_POLL_MS || 1200), idleMs: 400 });
    await page.goto(url);
    return page;
  }
  const helpers = (page) => ({
    nav: (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg),
    submit: async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); },
    later: async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); } },
    closeDialogs: () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())),
    // reads retry once when the page is in the middle of its own automatic refresh
    ls: (k) => settled(page, () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k)),
    cloudStatus: () => settled(page, () => page.evaluate(() => window.L997Cloud.status())),
  });
  async function settled(page, fn) {
    try { return await fn(); } catch (e) {
      if (!/context was destroyed|navigation/.test(e.message)) throw e;
      await page.waitForLoadState("load"); await page.waitForTimeout(300);
      return fn();
    }
  }
  const rows = async (collection) => (await cloud.query("select record_id, data, deleted, version from public.records where collection = $1 and not deleted", [collection])).rows;
  // waits for a condition; tolerates the page refreshing itself (devices reload after applying cloud updates)
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) { /* page was refreshing */ } await new Promise((r) => setTimeout(r, 250)); } return false; };

  // ---------------- device A: owner, works locally first ----------------
  const A = await device("A"); const a = helpers(A);
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", OWNER_PW); await A.fill("#au_pw2", OWNER_PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next");
  await A.waitForSelector("body:not(.auth-locked)");
  // this suite covers shifts / cash custody: switch on "staff must start a shift" (off by default)
  await A.evaluate(() => document.querySelector('.nav-item[data-page="settings"]').click()); await A.click('[data-settings-tab="operating"]');
  check("shifts are optional and off by default", !(await A.isChecked("#shiftsRequiredSetting")));
  await A.check("#shiftsRequiredSetting"); await A.click("#saveSettingsBtn"); await A.waitForTimeout(250);
  check("not linked yet: no cloud indicator, nothing sent", !(await A.isVisible("#cloudChip")) && cloud.requests === 0, cloud.requests);
  await a.nav("new-order");
  await A.click("#posCustomerBarBtn"); await A.fill("#orderCustomerPhone", "33001122");
  await A.click("#newCustomerFromNoResultBtn"); await A.fill("#customerName", "Ali"); await A.fill("#customerPhone", "33001122"); await A.click("#saveCustomerBtn");
  await A.click('#posProductGrid [data-cloth="shirt"]'); await A.click("#posSaveOrderMainBtn"); await a.later();
  await a.nav("finance"); await A.click("#addExpenseBtn"); await A.fill("#qf_amount", "5"); await a.submit();

  // a staff member with a local login, created before linking (like raul / amin / Yaseen)
  await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Raul"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "raul");
  await A.click("#quickFormSubmitBtn"); await A.waitForTimeout(300); await a.closeDialogs();

  // link + upload
  await a.nav("profile");
  await A.waitForSelector("#cloudLinkBtn");
  await A.click("#cloudLinkBtn");
  await A.fill("#qf_pw", OWNER_PW); await A.fill("#qf_c", "رفع");
  await A.click("#quickFormSubmitBtn");
  check("owner links and uploads the device's data", await until(async () => (await rows("orders")).length === 1 && (await rows("expenses")).length === 1 && (await rows("customers")).length === 1), JSON.stringify([(await rows("orders")).length, (await rows("expenses")).length]));
  const empRows = await rows("employees");
  const ownerRow = empRows.find((r) => r.data.role === "owner");
  check("password hashes and salts never reach the cloud", empRows.length === 2 && !JSON.stringify(empRows).match(/passHash|"salt"|password/), Object.keys(ownerRow ? ownerRow.data : {}).join(","));
  check("owner's employee record knows its cloud account", !!(ownerRow && ownerRow.data.cloudUserId));
  const sec = await rows("security");
  check("recovery code hash stays on the device", sec.length === 1 && !("recoveryHash" in sec[0].data));
  const set = await rows("settings");
  check("prices uploaded, local order counter not", set.length === 1 && set[0].data.prices && !("orderSeq" in set[0].data));
  await A.waitForTimeout(2500);
  const afterLink = await a.cloudStatus();
  check("no false conflicts right after linking (upload and sync never overlap)", afterLink.conflicts === 0 && afterLink.rejected === 0, JSON.stringify(afterLink.conflictList));
  await A.waitForSelector("#cloudChip");
  check("cloud indicator shows synced", await until(async () => /متزامن/.test(await A.textContent("#cloudChip"))), await A.textContent("#cloudChip"));

  // staff created before linking: one button creates their cloud accounts and lists the temporary passwords
  await a.nav("dashboard"); await a.nav("profile");
  await A.waitForSelector("#cloudStaffBtn");
  await A.click("#cloudStaffBtn"); await A.click("#quickFormSubmitBtn");
  await A.waitForSelector("#qf_s0", { timeout: 15000 });
  const raulLine = await A.inputValue("#qf_s0");
  const raulPw = (/الكلمة المؤقتة: (\S+)/.exec(raulLine) || [])[1];
  check("one button creates cloud accounts for existing staff and shows their passwords", !!raulPw && /raul/.test(raulLine), raulLine);
  check("raul is a cloud member now", (await cloud.query("select m.role from public.shop_members m join auth.users u on u.id = m.user_id where u.email = 'raul@997laundry.app'")).rows[0]?.role === "worker");
  await a.closeDialogs();

  // owner adds a worker → cloud account + membership
  await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Worker One"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "worker1");
  const tempPw = await A.inputValue("#qf_password");
  await A.click("#quickFormSubmitBtn");
  check("worker account created in the cloud with role worker", await until(async () => (await cloud.query("select m.role from public.shop_members m join auth.users u on u.id = m.user_id where u.email = 'worker1@997laundry.app'")).rows[0]?.role === "worker"));
  await a.later(); await a.closeDialogs();
  check("worker's employee record reaches the cloud", await until(async () => (await rows("employees")).some((r) => r.data.username === "worker1" && r.data.cloudUserId)));

  // ---------------- device B: a new device joins from the cloud ----------------
  const B = await device("B"); const b = helpers(B);
  await B.waitForSelector("#au_cloud_join");
  await B.click("#au_cloud_join");
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]).catch(async (e) => {
    console.log("DIAG join screen:", await B.evaluate(() => document.getElementById("au_err")?.textContent).catch(() => "?"), "| tempPw:", tempPw);
    throw e;
  });
  await B.waitForSelector("#au_user");
  check("after joining: login screen (not first-time setup) with a notice", (await B.isVisible("#au_pass")) && /تنزيل بيانات المحل/.test(await B.textContent("#au_err")), await B.textContent("#au_err"));
  check("joined device received orders and customers", (await b.ls("l997_orders")).length === 1 && (await b.ls("l997_customers")).length === 1);
  check("worker device did not receive expenses", ((await b.ls("l997_expenses")) || []).length === 0);
  await B.waitForTimeout(150);
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("#au_pw2"); await B.waitForTimeout(150);
  await B.fill("#au_pw", WORKER_NEW_PW); await B.fill("#au_pw2", WORKER_NEW_PW); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("body:not(.auth-locked)");
  const pwOk = await cloud.query("select encrypted_password = extensions.crypt($1, encrypted_password) as ok from auth.users where email = 'worker1@997laundry.app'", [WORKER_NEW_PW]);
  check("forced password change also changed the cloud password", pwOk.rows[0].ok === true);
  await B.waitForSelector("#qf_opening"); await B.fill("#qf_opening", "0"); await B.click("#quickFormSubmitBtn"); await B.waitForTimeout(300);

  // worker creates an order → number reserved by the server, uploaded
  await b.nav("new-order");
  await B.click("#posCustomerBarBtn"); await B.fill("#orderCustomerPhone", "33001122"); await B.waitForTimeout(150);
  await B.click("#customerResults [data-pick]");
  await B.click('#posProductGrid [data-cloth="shirt"]'); await B.click('#posProductGrid [data-cloth="shirt"]');
  await B.click("#posSaveOrderMainBtn"); await b.later(); await b.closeDialogs();
  const bOrders = await b.ls("l997_orders");
  check("worker's order uploaded", await until(async () => (await rows("orders")).length === 2));
  const nums = (await rows("orders")).map((r) => r.data.number).sort();
  check("order numbers are unique across devices", new Set(nums).size === 2, nums.join(","));
  check("worker's shift uploaded", await until(async () => (await rows("shifts")).length === 1));
  const wUid = (await cloud.query("select id from auth.users where email = 'worker1@997laundry.app'")).rows[0].id;
  check("worker's activity-log entries reach the cloud (add-only)", await until(async () => (await cloud.query("select count(*)::int n from public.records where collection = 'audit' and updated_by = $1", [wUid])).rows[0].n > 0));
  // full worker flow under the server's financial rules: partial payment (debt) → delivery → cancel another order with owner approval
  const myOrderId = (await b.ls("l997_orders")).find((o) => o.createdById && o.status === "received" && o.number === nums.sort().slice(-1)[0])?.id || (await b.ls("l997_orders"))[0].id;
  await b.nav("orders");
  await B.click(`#ordersBody tr:has-text("#${(await b.ls("l997_orders")).find((o) => o.id === myOrderId).number}") [data-view]`);
  await B.click("#advanceStatusBtn"); await B.selectOption("#qf_method", "cash"); await B.fill("#qf_paid", "0.2"); await b.submit(); await b.later();
  await B.click("#advanceStatusBtn"); await B.fill("#qf_count", "2"); await b.submit(); await b.later(); await b.closeDialogs();
  check("worker's payment + delivery accepted by the cloud", await until(async () => { const r = (await rows("orders")).find((x) => x.record_id === myOrderId); return r && r.data.status === "delivered" && r.data.paymentConfirmed; }, 20000));
  // a new order, then cancelled by the worker with the owner's approval
  await b.nav("new-order");
  await B.click("#posCustomerBarBtn"); await B.fill("#orderCustomerPhone", "33001122"); await B.waitForTimeout(150);
  await B.click("#customerResults [data-pick]"); await B.click('#posProductGrid [data-cloth="shirt"]');
  await B.click("#posSaveOrderMainBtn"); await b.later(); await b.closeDialogs();
  const toCancel = (await b.ls("l997_orders"))[0];
  await b.nav("orders"); await B.click(`#ordersBody tr:has-text("#${toCancel.number}") [data-view]`);
  await B.click("#cancelOrderBtn"); await B.waitForTimeout(300);
  await B.fill("#qf_u", "owner"); await B.fill("#qf_p", OWNER_PW); await B.click("#quickFormSubmitBtn"); await B.waitForTimeout(400);
  await B.fill("#qf_reason", "customer changed mind"); await b.submit(); await b.closeDialogs();
  check("worker's approved cancellation accepted by the cloud", await until(async () => (await rows("orders")).find((x) => x.record_id === toCancel.id)?.data.status === "cancelled", 20000));
  check("worker device: nothing rejected by the cloud", (await b.cloudStatus()).rejected === 0, JSON.stringify((await b.cloudStatus()).rejectedList));

  // device A (idle) picks up the worker's order and refreshes itself
  await a.nav("dashboard"); await A.mouse.move(5, 5);
  check("owner device receives the worker's orders while idle", await until(async () => ((await a.ls("l997_orders")) || []).length === 3, 20000));
  await A.waitForSelector("body:not(.auth-locked)");
  check("owner stays signed in after the automatic refresh", !(await A.evaluate(() => document.body.classList.contains("auth-locked"))));

  // speed: a new order from the worker appears on the owner's open Orders screen without reloading the page
  await A.waitForTimeout(3000);
  await a.nav("orders"); await A.evaluate(() => { window.__noReload = true; }); await A.mouse.move(8, 8);
  await b.closeDialogs(); await b.nav("new-order");
  await B.click("#posCustomerBarBtn"); await B.fill("#orderCustomerPhone", "33001122"); await B.waitForTimeout(150);
  await B.click("#customerResults [data-pick]"); await B.click('#posProductGrid [data-cloth="shirt"]');
  await B.click("#posSaveOrderMainBtn"); await b.later(); await b.closeDialogs();
  const liveNum = (await b.ls("l997_orders"))[0].number, t0 = Date.now();
  const shown = await until(async () => (await A.textContent("#ordersBody")).includes("#" + liveNum), 15000);
  const kept = await A.evaluate(() => window.__noReload === true).catch(() => false);
  check("new order shows on the other device's open screen within seconds, without a page reload", shown && kept, `${Date.now() - t0} ms, no reload: ${kept}`);

  // offline on A: work continues, uploads later
  cloud.setOffline(true);
  await a.nav("finance"); await A.click("#addExpenseBtn"); await A.fill("#qf_amount", "2"); await a.submit();
  await A.waitForTimeout(2500);
  // the page reloads before the internet returns (phone restarted / automatic refresh): the change must still upload
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)"); await A.waitForTimeout(2500);
  check("offline: indicator says it will upload later", /بدون إنترنت/.test(await A.textContent("#cloudChip")), await A.textContent("#cloudChip"));
  cloud.setOffline(false);
  check("back online: the offline expense is uploaded", await until(async () => (await rows("expenses")).length === 2, 20000), JSON.stringify([(await rows("expenses")).length, ((await a.ls("l997_expenses")) || []).length, (await a.cloudStatus()).pending]));

  // edit conflict: both devices change the same customer; the first upload wins, the other is logged
  const custId = (await a.ls("l997_customers"))[0].id;
  cloud.setOffline(true);
  // edits written straight into each device's storage; re-written until they stick (a screen may save its
  // in-memory copy over a direct write), then confirmed queued for upload before the internet comes back
  const editOn = async (P, val) => {
    for (let k = 0; k < 10; k++) {
      await P.evaluate(([id, v]) => { const l = JSON.parse(localStorage.getItem("l997_customers")); l.find((c) => c.id === id).notes = v; localStorage.setItem("l997_customers", JSON.stringify(l)); }, [custId, val]).catch(() => {});
      await P.waitForTimeout(700);
      const ok = await P.evaluate(([id, v]) => JSON.parse(localStorage.getItem("l997_customers")).find((c) => c.id === id).notes === v, [custId, val]).catch(() => false);
      if (ok) return true;
    }
    return false;
  };
  check("both offline edits saved on their devices", (await editOn(A, "from A")) && (await editOn(B, "from B")));
  cloud.setOffline(false);
  await B.evaluate(() => window.L997Cloud.syncNow());
  const bWon = await until(async () => (await rows("customers"))[0].data.notes === "from B", 20000);
  check("first upload wins", bWon, bWon ? undefined : JSON.stringify({ cloud: (await rows("customers"))[0].data.notes, bLocal: await B.evaluate((id) => JSON.parse(localStorage.getItem("l997_customers")).find((c) => c.id === id).notes, custId).catch((e) => e.message), bStatus: await b.cloudStatus().catch(() => null), bDebug: await B.evaluate(() => window.L997Cloud._debug()).catch(() => null) }));
  await A.evaluate(() => window.L997Cloud.syncNow());
  check("second device's edit is not silently lost: logged as a conflict", await until(async () => (await a.cloudStatus()).conflicts >= 1));
  await A.waitForLoadState("load");
  check("device A now shows the cloud's value", await until(async () => (await a.ls("l997_customers")).find((c) => c.id === custId).notes === "from B"));
  check("cloud keeps one consistent value", (await rows("customers"))[0].data.notes === "from B");

  // two devices record a payment for the SAME customer while offline (as the app does: balance + ledger entry)
  // → after reconnecting, the balance on every device and in the cloud = the sum of both payments
  const pay = (P, amount, tag) => P.evaluate(([id, amt, tg]) => {
    const cs = JSON.parse(localStorage.getItem("l997_customers")), c = cs.find((x) => x.id === id);
    c.balance = Math.round((c.balance + amt) * 1000) / 1000;
    const lg = JSON.parse(localStorage.getItem("l997_ledger") || "[]");
    lg.unshift({ id: "pay-" + tg, customerId: id, type: "deposit", amount: amt, balanceAfter: c.balance, method: "cash", note: "test " + tg, at: new Date().toISOString() });
    localStorage.setItem("l997_ledger", JSON.stringify(lg)); localStorage.setItem("l997_customers", JSON.stringify(cs));
  }, [custId, amount, tag]);
  await A.waitForLoadState("load"); await B.waitForLoadState("load");
  const before = (await rows("customers"))[0].data.balance;
  cloud.setOffline(true);
  await pay(A, 1.25, "A"); await pay(B, 0.75, "B");
  await A.waitForTimeout(600);
  cloud.setOffline(false);
  await A.evaluate(() => window.L997Cloud.syncNow()).catch(() => {}); await B.evaluate(() => window.L997Cloud.syncNow()).catch(() => {});
  const want = Math.round((before + 2) * 1000) / 1000;
  const ledgerSum = async () => (await cloud.query("select coalesce(sum((data->>'amount')::numeric),0)::float8 s from public.records where collection='ledger' and not deleted and data->>'customerId' = $1", [custId])).rows[0].s;
  check("both offline payments reach the cloud ledger", await until(async () => (await rows("ledger")).some((r) => r.record_id === "pay-A") && (await rows("ledger")).some((r) => r.record_id === "pay-B"), 20000));
  const settle = async (P) => { await P.waitForTimeout(500); return until(async () => { const c = (await helpers(P).ls("l997_customers")).find((x) => x.id === custId); return Math.abs(c.balance - want) < 0.0005; }, 30000); };
  check("device A shows the balance with BOTH payments", await settle(A), JSON.stringify({ want, a: (await a.ls("l997_customers")).find((x) => x.id === custId).balance }));
  check("device B shows the balance with BOTH payments", await settle(B), JSON.stringify({ want, b: (await b.ls("l997_customers")).find((x) => x.id === custId).balance }));
  check("cloud customer balance = cloud ledger sum", await until(async () => Math.abs((await rows("customers"))[0].data.balance - (await ledgerSum()) - ((await rows("customers"))[0].data.openingBalance || 0)) < 0.0005, 30000), JSON.stringify({ bal: (await rows("customers"))[0].data.balance, ledger: await ledgerSum() }));

  // a worker cannot push expenses even if the data is changed on the device
  await B.waitForLoadState("load");
  await until(async () => B.evaluate(() => !!window.L997Cloud));
  await B.evaluate(() => { localStorage.setItem("l997_expenses", JSON.stringify([{ id: "fake-exp", amount: 999, category: "x" }])); });
  await B.evaluate(() => window.L997Cloud.syncNow());
  await B.waitForTimeout(500);
  check("worker device cannot add expenses to the cloud", !(await rows("expenses")).some((r) => r.record_id === "fake-exp"));
  check("change history is kept on the server", (await cloud.query("select count(*)::int as n from public.record_history")).rows[0].n > 10);

  // a device that already has its own (unlinked) data joins from the LOGIN screen
  const C = await device("C");
  await C.fill("#au_name", "Old"); await C.fill("#au_user", "olddevice"); await C.fill("#au_pw", OWNER_PW); await C.fill("#au_pw2", OWNER_PW);
  await C.click("#au_form button[type=submit]"); await C.check("#au_saved"); await C.click("#au_next");
  await C.waitForSelector("body:not(.auth-locked)");
  await C.evaluate(() => document.getElementById("logoutBtn").click());
  await C.waitForSelector("#au_cloud_join_replace");
  check("login screen of an unlinked device offers joining the cloud", true);
  await C.click("#au_cloud_join_replace");
  check("joining from the login screen warns that this device's data is replaced", /استبدال/.test(await C.textContent("#authCard")));
  await C.fill("#au_user", "raul"); await C.fill("#au_pass", raulPw);
  await Promise.all([C.waitForEvent("load"), C.click("#au_form button[type=submit]")]);
  await C.waitForSelector("#au_user"); await C.waitForTimeout(200);
  check("after joining, the login screen says the device is linked", /مربوط بالسحابة/.test(await C.textContent("#authCard")));
  await C.fill("#au_user", "raul"); await C.fill("#au_pass", raulPw); await C.click("#au_form button[type=submit]");
  await C.waitForSelector("#au_pw2"); await C.waitForTimeout(150);
  await C.fill("#au_pw", "Raul#2026new"); await C.fill("#au_pw2", "Raul#2026new"); await C.click("#au_form button[type=submit]");
  await C.waitForSelector("body:not(.auth-locked)");
  const cOrders = await helpers(C).ls("l997_orders");
  check("raul's device now has the shop's orders (old local data replaced)", cOrders.length >= 2 && !(await helpers(C).ls("l997_employees")).some((e) => e.username === "olddevice"), cOrders.length);

  // the reported case: two devices create an order right after signing in → numbers never collide
  await C.waitForSelector("#qf_opening", { timeout: 5000 }).then(async () => { await C.fill("#qf_opening", "0"); await C.click("#quickFormSubmitBtn"); await C.waitForTimeout(300); }).catch(() => {});
  const quickOrder = async (P) => {
    const h = helpers(P);
    await h.nav("new-order");
    await P.click("#posCustomerBarBtn"); await P.fill("#orderCustomerPhone", "33001122"); await P.waitForTimeout(200);
    await P.click("#customerResults [data-pick]");
    await P.click('#posProductGrid [data-cloth="shirt"]');
    await P.click("#posSaveOrderMainBtn"); await h.later(); await h.closeDialogs();
  };
  await Promise.all([quickOrder(A), quickOrder(C)]);
  check("orders saved at the same moment on two devices get different numbers", await until(async () => { const n = (await rows("orders")).map((r) => r.data.number); return n.length >= 4 && new Set(n).size === n.length; }, 20000), (await rows("orders")).map((r) => r.data.number).sort().join(","));
  const allNums = (await rows("orders")).map((r) => Number(r.data.number));
  check("numbering stays compact (no big jumps from page refreshes)", Math.max(...allNums) <= 30, allNums.sort((x, y) => x - y).join(","));

  // an existing duplicate (e.g. made offline) is flagged and can get a new unique number
  await until(async () => (await a.ls("l997_orders")).length >= 4, 20000); // A has received C's order (and refreshed)
  await A.waitForTimeout(1500); await A.waitForSelector("body:not(.auth-locked)");
  await until(async () => { await A.evaluate(() => { const l = JSON.parse(localStorage.getItem("l997_orders")); l[0].number = l[1].number; localStorage.setItem("l997_orders", JSON.stringify(l)); }); return true; });
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)");
  await a.nav("orders");
  check("duplicate number is flagged in the orders list", /رقم مكرر/.test(await A.textContent("#ordersBody")));
  // the row flagged as duplicate (a live refresh may reorder the list)
  await A.click('#ordersBody tr:has-text("رقم مكرر") [data-view]');
  await A.click("#renumberOrderBtn"); await A.waitForTimeout(1500);
  const numsAfter = (await a.ls("l997_orders")).map((o) => o.number);
  check("'new number' button removes the duplicate", new Set(numsAfter).size === numsAfter.length, numsAfter.join(","));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CLOUD CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
