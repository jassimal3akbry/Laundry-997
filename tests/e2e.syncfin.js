// Multi-device financial consistency against the local Supabase stand-in (real PostgreSQL + the real rules).
// Owner device A and worker device B share one shop: orders, payments and arrears appear live on the other
// device's open customer file; the same order paid on both devices at once is recorded once; a save whose reply
// is lost is not duplicated on retry; a payment on one device never lands in another employee's shift.
// Usage: node tests/e2e.syncfin.js [path-to-html]   (needs a local PostgreSQL server, run as root)
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
const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const OWNER_PW = "Owner#2026pass", WORKER_PW = "Worker#2026new";

(async () => {
  const cloud = await startStandin({ latencyMs: 120 });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag) {
    const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); window.print = () => {}; HTMLAnchorElement.prototype.click = function () {}; },
      { url: cloud.url, key: "sb_publishable_test", pollMs: 1200, idleMs: 400 });
    await page.goto(url);
    return page;
  }
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) { /* page refreshing */ } await new Promise((r) => setTimeout(r, 250)); } return false; };
  const H = (page) => {
    const h = {
      wait: (ms) => page.waitForTimeout(ms),
      nav: (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg),
      closeAll: () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())),
      submit: async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); },
      later: async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } },
      ls: (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k),
      status: () => page.evaluate(() => window.L997Cloud.status()),
      summary: (custId) => page.evaluate((id) => {
        const c = JSON.parse(localStorage.getItem("l997_customers")).find((x) => x.id === id);
        const s = window.L997Finance.customerSummary(c, JSON.parse(localStorage.getItem("l997_orders")), JSON.parse(localStorage.getItem("l997_ledger")));
        return { balance: c.balance, debt: s.debt, owed: s.totalOwed };
      }, custId),
      async openOrder(id) {
        await h.closeAll(); const o = (await h.ls("l997_orders")).find((x) => x.id === id);
        await h.nav("orders");
        // by id, so a live redraw of the list (another device's change) cannot swallow the click
        await page.waitForFunction((id) => !!document.querySelector(`#ordersBody [data-view="${id}"]`), o.id);
        await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), o.id); await page.waitForTimeout(150);
      },
      async ready(id, method, paid) {
        await h.openOrder(id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", method);
        if (paid !== undefined) await page.fill("#qf_paid", String(paid));
        await h.submit(); await h.later(); await h.closeAll();
      },
      async order(custId, phone, qty) {
        await h.closeAll(); await h.nav("new-order");
        await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await page.waitForTimeout(200);
        await page.click(`#customerResults [data-pick="${custId}"]`);
        for (let i = 0; i < qty; i++) await page.click('#posProductGrid [data-cloth="bedsheet_single"]');
        const sel = await page.$("[data-service-change]"); if (sel && (await sel.inputValue()) !== "washiron") await page.selectOption("[data-service-change]", "washiron");
        await page.click("#posSaveOrderMainBtn"); await h.later(); await h.closeAll();
        return (await h.ls("l997_orders"))[0];
      },
    };
    return h;
  };
  const cloudRows = async (col) => (await cloud.query("select record_id, data, version from public.records where collection = $1 and not deleted", [col])).rows;
  const cloudBalance = async (custId) => r3((await cloudRows("ledger")).filter((r) => r.data.customerId === custId).reduce((a, r) => a + Number(r.data.amount || 0), 0));

  /* ---------- owner device A: set up, link, add a worker ---------- */
  const A = await device("A"); const a = H(A);
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", OWNER_PW); await A.fill("#au_pw2", OWNER_PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  // this suite covers shifts / cash custody: switch on "staff must start a shift" (off by default)
  await A.evaluate(() => document.querySelector('.nav-item[data-page="settings"]').click()); await A.click('[data-settings-tab="operating"]');
  check("shifts are optional and off by default", !(await A.isChecked("#shiftsRequiredSetting")));
  await A.check("#shiftsRequiredSetting"); await A.click("#saveSettingsBtn"); await A.waitForTimeout(250);
  await a.nav("profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", OWNER_PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  check("A linked to the cloud", await until(async () => (await a.status()).linked && (await a.status()).pending === 0));
  await until(async () => !(await A.evaluate(() => { const b = document.getElementById("quickFormSubmitBtn"); return document.getElementById("quickFormDialog").open && b.disabled; })));
  await a.wait(1500); await a.closeAll(); await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Worker One"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "worker1");
  const tempPw = await A.inputValue("#qf_password"); await A.click("#quickFormSubmitBtn");
  await until(async () => (await cloud.query("select 1 from auth.users where email = 'worker1@997laundry.app'")).rowCount === 1);
  // the credentials notice opens once the cloud account exists — wait for it, then close it
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {});
  await a.wait(1200); await a.closeAll();
  // a shared customer
  await a.nav("customers"); await A.click("#addCustomerBtn"); await A.fill("#customerName", "Shared Customer"); await A.fill("#customerPhone", "33660001"); await A.click("#saveCustomerBtn"); await a.wait(300);
  const cust = (await a.ls("l997_customers")).find((c) => String(c.phone).endsWith("33660001"));
  check("customer reaches the cloud", await until(async () => (await cloudRows("customers")).some((r) => r.record_id === cust.id)));

  /* ---------- worker device B joins ---------- */
  const B = await device("B"); const b = H(B);
  await B.waitForSelector("#au_cloud_join"); await B.click("#au_cloud_join");
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await b.wait(150);
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("#au_pw2"); await b.wait(150);
  await B.fill("#au_pw", WORKER_PW); await B.fill("#au_pw2", WORKER_PW); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("body:not(.auth-locked)");
  await B.waitForSelector("#qf_opening"); await B.fill("#qf_opening", "0"); await B.click("#quickFormSubmitBtn"); await b.wait(300);
  check("B (worker) joined and started a shift", (await b.ls("l997_shifts")).some((s) => !s.endAt));

  /* ---------- 1. order on B → appears on A's OPEN customer file ---------- */
  await a.closeAll(); await a.nav("customers"); await A.evaluate((id) => window.openCustomerProfile997(id), cust.id);
  const o1 = await b.order(cust.id, "33660001", 20); // 20 × 0.500 = 10.000
  check("B's order: 10.000 for the shared customer", o1 && o1.payment.total === 10, o1 && o1.payment.total);
  check("1. A's open customer file shows B's new order live", await until(async () => (await A.textContent("#customerProfileContent")).includes("#" + o1.number)));

  /* ---------- 2. payment on A → B's open customer file shows the arrears ---------- */
  await a.closeAll();
  await until(async () => (await a.ls("l997_orders")).some((o) => o.id === o1.id));
  await a.ready(o1.id, "cash", 4);
  await b.closeAll(); await b.nav("customers"); await B.evaluate((id) => window.openCustomerProfile997(id), cust.id);
  check("2. B's open customer file shows owed 6.000 after A's partial payment", await until(async () => /المستحق عليه الآن ?6\.000/.test((await B.textContent("#customerProfileContent")).replace(/\s+/g, " "))));
  // a later payment on the order recorded on A → B sees 3.000
  await a.openOrder(o1.id); await A.click("#payOrderRemainingBtn"); await A.fill("#qf_amount", "3"); await A.selectOption("#qf_notify", "no"); await a.submit(); await a.closeAll();
  check("2b. B sees the order's remaining drop to 3.000", await until(async () => /المستحق عليه الآن ?3\.000/.test((await B.textContent("#customerProfileContent")).replace(/\s+/g, " "))));
  check("2c. both devices and the cloud agree: owes 3.000", await until(async () => (await a.summary(cust.id)).debt === 3 && (await b.summary(cust.id)).debt === 3 && (await cloudBalance(cust.id)) === -3));

  /* ---------- 3. status change on B → A's orders list shows it ready ---------- */
  await b.closeAll();
  const o2 = await b.order(cust.id, "33660001", 4); // 2.000
  await until(async () => (await a.ls("l997_orders")).some((o) => o.id === o2.id));
  await a.closeAll(); await a.nav("orders");
  await b.ready(o2.id, "later");
  check("3. A's open orders list shows B's order as ready (pay on pickup)", await until(async () => /جاهز/.test(await A.textContent(`#ordersBody tr:has-text("#${o2.number}")`))));

  /* ---------- 4. the same order paid on both devices at the same moment ---------- */
  const o3 = await a.order(cust.id, "33660001", 20); // 10.000
  await until(async () => (await b.ls("l997_orders")).some((o) => o.id === o3.id));
  cloud.setOffline(true); // both pay while neither can see the other
  await a.ready(o3.id, "cash", 4);   // A: partial, 6 on credit
  await b.ready(o3.id, "cash", 10);  // B: paid in full
  cloud.setOffline(false);
  const converged = await until(async () => {
    const [sa, sb] = [await a.status(), await b.status()];
    return sa.pending === 0 && sb.pending === 0 && (await a.summary(cust.id)).balance === (await b.summary(cust.id)).balance;
  }, 40000);
  if (!converged) console.log("DIAG pending:", JSON.stringify(await A.evaluate(() => window.L997Cloud._debug())), JSON.stringify(await B.evaluate(() => window.L997Cloud._debug())));
  const co = (await cloudRows("orders")).find((r) => r.record_id === o3.id).data;
  const charges = (await cloudRows("ledger")).filter((r) => r.data.orderId === o3.id && r.data.type === "order_charge");
  const expectDebt = r3(co.payment.total - co.payment.paid);
  check("4. same order paid on two devices: the cloud keeps ONE payment (the first to arrive)", co.paymentConfirmed && charges.length === (expectDebt > 0 ? 1 : 0) && (expectDebt === 0 || charges[0].data.amount === -expectDebt), JSON.stringify({ paid: co.payment.paid, charges: charges.map((r) => r.data.amount) }));
  check("4b. both devices converge on the same balance as the cloud (no double debt / double payment)", converged && (await a.summary(cust.id)).balance === (await cloudBalance(cust.id)), JSON.stringify([(await a.summary(cust.id)).balance, (await b.summary(cust.id)).balance, await cloudBalance(cust.id)]));
  const lost = [...(await a.status()).conflictList, ...(await b.status()).conflictList].filter((x) => x.collection === "orders" && x.id === o3.id);
  check("4c. the losing device's version is logged as a conflict for the owner to review", lost.length >= 1);

  /* ---------- 4d. forced order: full payment arrives first; the other device's debt entry must be discarded ---------- */
  const o4 = await a.order(cust.id, "33660001", 20); // 10.000
  await until(async () => (await b.ls("l997_orders")).some((o) => o.id === o4.id));
  const balBefore = await cloudBalance(cust.id);
  await A.context().setOffline(true); await B.context().setOffline(true);
  await a.ready(o4.id, "cash", 10);  // A: paid in full
  await b.ready(o4.id, "cash", 3);   // B: partial → B creates a 7.000 debt entry locally
  check("4d. B recorded a local debt entry while offline", (await b.ls("l997_ledger")).some((t) => t.orderId === o4.id && t.type === "order_charge"));
  await A.context().setOffline(false); await A.evaluate(() => window.L997Cloud && window.L997Cloud.syncNow()).catch(() => {});
  const aWon = await until(async () => { await A.evaluate(() => window.L997Cloud && window.L997Cloud.syncNow()).catch(() => {}); return (await a.status()).pending === 0 && (await cloudRows("orders")).find((r) => r.record_id === o4.id).data.paymentConfirmed; }, 60000);
  if (!aWon) console.log("DIAG A:", JSON.stringify({ st: await a.status().catch((e) => e.message), dbg: await A.evaluate(() => window.L997Cloud._debug()).catch((e) => e.message), local: ((await a.ls("l997_orders")) || []).filter((o) => o.id === o4.id).map((o) => [o.status, o.paymentConfirmed, o.payment.paid]), base: await A.evaluate((id) => (JSON.parse(localStorage.getItem("l997_cloud_base")).orders || {})[id], o4.id) }));
  check("4d. A's full payment reached the cloud first (forced order)", aWon);
  await B.context().setOffline(false); await B.evaluate(() => window.L997Cloud && window.L997Cloud.syncNow()).catch(() => {});
  const ok4 = await until(async () => (await b.status()).pending === 0 && !(await b.ls("l997_ledger")).some((t) => t.orderId === o4.id && t.type === "order_charge") && (await b.summary(cust.id)).balance === (await cloudBalance(cust.id)), 40000);
  if (!ok4) {
    const hist = (await cloud.query("select id, record_id, collection, version, changed_by, (data->>'status') st, (data->>'paymentConfirmed') pc, (data->'payment'->>'paid') paid, changed_at from public.record_history where record_id = $1 or (collection = 'ledger' and data->>'orderId' = $1) order by changed_at", [o4.id])).rows;
    console.log("DIAG history:", JSON.stringify(hist));
    console.log("DIAG B conflicts:", JSON.stringify((await b.status()).conflictList.map((x) => [x.collection, x.id, String(x.mine).slice(0, 60)])));
  }
  check("4e. full payment won: no debt entry in the cloud for that order", !(await cloudRows("ledger")).some((r) => r.data.orderId === o4.id && r.data.type === "order_charge"));
  check("4f. B discarded its now-invalid debt entry; B, A and the cloud show the same balance (unchanged by the 10.000 paid)", ok4 && (await cloudBalance(cust.id)) === balBefore && (await a.summary(cust.id)).balance === balBefore, JSON.stringify([balBefore, await cloudBalance(cust.id), (await b.summary(cust.id)).balance]));

  /* ---------- 5. reply lost after the server saved a payment → retry does not duplicate ---------- */
  await a.closeAll();
  const before = (await cloudRows("ledger")).length;
  cloud.loseNextWriteResponse();
  await A.evaluate((id) => window.openCustomerProfile997(id), cust.id); await A.click("#cpSettle");
  await A.fill("#qf_amount", "1"); await A.selectOption("#qf_notify", "no"); await a.submit(); await a.closeAll();
  const settled = await until(async () => (await a.status()).pending === 0 && (await cloudRows("ledger")).length > before, 30000);
  const ones = (await cloudRows("ledger")).filter((r) => r.data.type === "credit" && r.data.amount === 1 && !r.data.orderId);
  check("5. payment saved, reply lost, retried: exactly one entry in the cloud", settled && ones.length === 1, ones.length);
  check("5b. the retry is not reported as a conflict", !(await a.status()).conflictList.some((x) => x.collection === "ledger" && ones[0] && x.id === ones[0].record_id));

  /* ---------- 6. payment on A while B closes the shift: never in B's shift ---------- */
  await A.evaluate((id) => window.openCustomerProfile997(id), cust.id); await A.click("#cpSettle");
  await A.fill("#qf_amount", "2"); await A.selectOption("#qf_notify", "no"); await a.submit(); await a.closeAll();
  await until(async () => (await b.ls("l997_ledger")).some((t) => t.amount === 2 && t.type === "credit"));
  const wShift = (await b.ls("l997_shifts")).find((s) => !s.endAt);
  const sum = await B.evaluate((sh) => window.L997Finance.shiftSummary({ orders: JSON.parse(localStorage.getItem("l997_orders")), ledger: JSON.parse(localStorage.getItem("l997_ledger")), expenses: [] }, sh), wShift);
  check("6. the owner's 2.000 payment is not counted in the worker's shift (worker collected 10.000 cash only if their payment won)", !Object.values(sum.inBy).some((v) => v === 2) && sum.deposits === 0, JSON.stringify(sum.inBy));

  /* ---------- 7. order numbers: strictly in sequence across devices; fixing old scrambled numbers ---------- */
  const seqRows = async () => (await cloudRows("orders")).map((r) => r.data).sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt)));
  await until(async () => (await a.status()).pending === 0 && (await b.status()).pending === 0);
  const seq1 = (await seqRows()).map((o) => Number(o.number));
  check("7. orders made alternately on two devices are numbered 1, 2, 3… with no gaps", seq1.every((n, i) => n === i + 1), seq1.join(","));
  // old version: each device used its own block of 10 → scramble the numbers as they were (11, 2, 21, 3, …)
  const legacy = ["00011", "00002", "00021", "00003", "00012"];
  await A.evaluate((nums) => { const l = JSON.parse(localStorage.getItem("l997_orders")); l.sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt))).forEach((o, i) => { if (nums[i]) o.number = nums[i]; }); localStorage.setItem("l997_orders", JSON.stringify(l)); }, legacy);
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)");
  await until(async () => (await a.status()).pending === 0 && (await seqRows()).slice(0, 5).map((o) => o.number).join() === legacy.join());
  await a.closeAll(); await a.nav("orders");
  await A.click("#renumberAllBtn"); await A.fill("#qf_c", "ترتيب"); await a.submit();
  const fixed = await until(async () => { const r = await seqRows(); return (await a.status()).pending === 0 && r.every((o, i) => Number(o.number) === i + 1); }, 30000);
  const after = await seqRows();
  check("7b. 'renumber' puts every order in creation order 1…N (in the cloud)", fixed, after.map((o) => o.number).join(","));
  check("7c. each renumbered order keeps its old number (for receipts customers hold)", after[0].prevNumber === "00011" && after[2].prevNumber === "00021", JSON.stringify(after.slice(0, 3).map((o) => [o.number, o.prevNumber])));
  check("7d. amounts and payments unchanged by renumbering", after.every((o) => typeof o.payment.total === "number") && (await cloudBalance(cust.id)) === (await a.summary(cust.id)).balance);
  await A.fill("#orderSearch", "21"); await a.wait(300);
  check("7e. searching the old number finds the order", (await A.textContent("#ordersBody")).includes("#" + after[2].number));
  await A.fill("#orderSearch", "");
  check("7f. the other device receives the new numbers", await until(async () => { const l = await b.ls("l997_orders"); return l.length === after.length && l.every((o) => after.find((x) => x.id === o.id).number === o.number); }));
  const oNext = await b.order(cust.id, "33660001", 2);
  check("7g. the next order continues the sequence (N + 1)", Number(oNext.number) === after.length + 1, `${oNext.number} after ${after.length}`);

  check("nothing rejected by the cloud on either device", (await a.status()).rejected === 0 && (await b.status()).rejected === 0, JSON.stringify([(await a.status()).rejectedList, (await b.status()).rejectedList]));
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL SYNC-FINANCE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
