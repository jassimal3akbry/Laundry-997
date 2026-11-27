// Delivery receipt on WhatsApp (cloud):
//  • without WhatsApp Business API: "confirm delivery" copies the receipt IMAGE and opens WhatsApp on the customer's
//    chat (paste → send) — owner and worker;  • the optional receipt link (order screen) opens on any phone, no login;
//  • with WhatsApp Business API switched on: the receipt image is sent automatically through the whatsapp-send
//    function (mocked here) — no tap; if it fails, the manual way is offered.
// Runs against the local Supabase stand-in (real PostgreSQL + setup.sql).
// Usage: node tests/e2e.receiptlink.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const { launchBrowser } = require("./browser");
const { psql } = require("./local-postgres");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 300) : ""}`);
  if (!cond) failures++;
}
const OWNER_PW = "Owner#2026pass", WORKER_PW = "Worker#2026new";

(async () => {
  const cloud = await startStandin({ latencyMs: 60 });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag, ua) {
    const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"], ...(ua ? { userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => {
      window.__L997_CLOUD_CONFIG = cfg; window.print = () => {};
      window.open = (u) => { const a = JSON.parse(sessionStorage.getItem("__wa") || "[]"); a.push(u); sessionStorage.setItem("__wa", JSON.stringify(a)); return { closed: false }; };
    }, { url: cloud.url, key: "k" });
    return page;
  }
  const H = (P) => ({
    wait: (ms) => P.waitForTimeout(ms),
    nav: (pg) => P.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg),
    closeAll: () => P.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())),
    ls: (k) => P.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k),
    wa: async () => { const a = await P.evaluate(() => JSON.parse(sessionStorage.getItem("__wa") || "[]")); return a.map((u) => decodeURIComponent(u.split("text=")[1] || "")); },
    status: () => P.evaluate(() => window.L997Cloud.status()),
    clip: () => P.evaluate(async () => { try { const it = (await navigator.clipboard.read()).find((x) => x.types.includes("image/png")); if (!it) return null; const img = await createImageBitmap(await it.getType("image/png")); return { w: img.width, h: img.height }; } catch (e) { return null; } }),
  });
  const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 300)); } return false; };
  async function order(P, h, name, phone, shirts, existing) {
    await h.closeAll(); await h.nav("new-order");
    await P.click("#posCustomerBarBtn"); await P.fill("#orderCustomerPhone", phone); await h.wait(250);
    if (existing) await P.click("#customerResults [data-pick]");
    else { await P.click("#newCustomerFromNoResultBtn"); await P.fill("#customerName", name); await P.fill("#customerPhone", phone); await P.click("#saveCustomerBtn"); }
    for (let i = 0; i < shirts; i++) await P.click('#posProductGrid [data-cloth="shirt"]');
    await P.click("#posSaveOrderMainBtn"); await h.wait(600);
    if (await P.isVisible("#quickFormSubmitBtn")) { await P.click("#quickFormSubmitBtn"); await h.wait(200); } // order confirmation
    await h.closeAll();
    return (await h.ls("l997_orders"))[0];
  }
  async function openOrder(P, h, id) { await h.closeAll(); await h.nav("orders"); await until(() => P.evaluate((id) => !!document.querySelector(`#ordersBody [data-view="${id}"]`), id), 15000); await P.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id); await h.wait(200); }
  async function readyCash(P, h, id, paid) { await openOrder(P, h, id); await P.click("#advanceStatusBtn"); await P.selectOption("#qf_method", "cash"); await P.fill("#qf_paid", String(paid)); await P.click("#quickFormSubmitBtn"); await h.wait(400); if (await P.isVisible("#quickFormCancelBtn")) await P.click("#quickFormCancelBtn"); await h.closeAll(); }
  async function deliver(P, h, id, pieces) { await openOrder(P, h, id); await P.click("#advanceStatusBtn"); await P.fill("#qf_count", String(pieces)); await P.click("#quickFormSubmitBtn"); await h.wait(500); }
  const linkOf = (text) => (/(https?:\/\/\S+r\.html\?t=[\w-]+)/.exec(text) || [])[1];

  /* owner device A: shop + cloud + a worker */
  const A = await device("A"); const a = H(A);
  await A.goto(url);
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", OWNER_PW); await A.fill("#au_pw2", OWNER_PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  await a.nav("profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", OWNER_PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  check("A linked to the cloud", await until(async () => (await a.status()).linked && (await a.status()).pending === 0));
  await until(async () => !(await A.evaluate(() => { const b = document.getElementById("quickFormSubmitBtn"); return document.getElementById("quickFormDialog").open && b.disabled; })));
  await a.wait(1200); await a.closeAll();

  /* 1) owner: order 5 shirts (0.400 each), paid 0.400 of 2.000, delivered → receipt image copied + WhatsApp opens on the chat */
  const o1 = await order(A, a, "Ali Link", "33445566", 5);
  await readyCash(A, a, o1.id, 0.4);
  const before = (await a.wa()).length;
  await deliver(A, a, o1.id, 5);
  const msgs = await a.wa();
  const m1 = msgs[msgs.length - 1] || "";
  check("confirm delivery → WhatsApp opens straight away (no second 'send?' question)", msgs.length === before + 1 && !(await A.isVisible("#quickFormSubmitBtn")), msgs.length - before);
  check("…to the customer's chat with the thank-you message and remaining 1.600", /تم تسليم طلبك/.test(m1) && /المتبقي على هذا الطلب 1\.600/.test(m1), m1);
  check("…no link in the message — the receipt goes as an image", !linkOf(m1), m1);
  const c1 = await a.clip();
  check("…the receipt image is on the clipboard (paste it in the chat)", c1 && c1.w === 760, JSON.stringify(c1));
  // the optional receipt link from the order screen
  await openOrder(A, a, o1.id); await A.click("#dialogReceiptLinkBtn"); await a.wait(200);
  const mL = (await a.wa()).pop() || "";
  const link1 = linkOf(mL);
  check("order screen 'receipt link on WhatsApp': link with a long random code", !!link1 && /t=[\w-]{20,}$/.test(link1) && /هذا إيصال طلبك رقم/.test(mL), mL);
  check("the receipt reaches the cloud with the order", await until(async () => (await cloud.query("select 1 from public.records where collection='orders' and data->'receiptPub'->>'token' is not null")).rowCount >= 1));

  /* 2) the customer opens the link on an iPhone — no login, nothing installed */
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const C = await device("customer", iphone);
  await C.goto(link1); await C.waitForSelector("#rImg", { timeout: 15000 }).catch(() => {});
  const view = await C.evaluate(() => { const i = document.getElementById("rImg"); return i ? { w: i.naturalWidth, h: i.naturalHeight, save: !!document.getElementById("rSave"), auth: !!document.getElementById("au_form") } : null; });
  check("customer's phone shows the receipt image (Save button, no login screen)", view && view.w === 760 && view.h > 600 && view.save && !view.auth, JSON.stringify(view));
  if (process.env.SHOT) await C.screenshot({ path: process.env.SHOT, fullPage: true });
  const model = await C.evaluate((t) => window.L997Cloud.publicReceipt(t), new URL(link1).searchParams.get("t"));
  const mm = model.model || {};
  check("receipt shows order #, total 2.000, paid 0.400 and balance due 1.600", mm.number === o1.number && /2\.000/.test(mm.total) && JSON.stringify(mm.paidRows).includes("0.400") && /1\.600/.test(mm.status.text), JSON.stringify({ n: mm.number, total: mm.total, st: mm.status }));
  check("the customer's phone number is partly hidden on the shared receipt", /33••••66/.test(mm.custPhone || ""), mm.custPhone);
  const [dl] = await Promise.all([C.waitForEvent("download", { timeout: 5000 }).catch(() => null), C.click("#rSave")]);
  check("'Save image' downloads the receipt PNG", dl && /997-laundry-receipt-\d+\.png$/.test(dl.suggestedFilename()), dl && dl.suggestedFilename());

  /* 3) privacy: a wrong code shows nothing; the public key cannot read the shop's records */
  await C.goto(link1.replace(/t=[\w-]+/, "t=wrongwrongwrongwrongwrong")); await C.waitForTimeout(1500);
  check("a wrong / old link shows 'receipt not available' (no data)", /الإيصال غير متوفر/.test(await C.textContent("body")));
  await C.goto(link1.replace(/t=[\w-]+/, "t=abc")); await C.waitForTimeout(500);
  check("an incomplete link says so", /الرابط غير مكتمل/.test(await C.textContent("body")));
  const leak = await C.evaluate(async (u) => { try { const r = await fetch(u + "/rest/v1/records?select=data", { headers: { apikey: "k" } }); return { s: r.status, t: (await r.text()).slice(0, 80) }; } catch (e) { return { s: 0 }; } }, cloud.url);
  check("without logging in nobody can list the shop's records", leak.s >= 400 || leak.t === "[]", JSON.stringify(leak));
  await C.context().close();

  /* 4) sending the link again reuses the same link (updated content) */
  await openOrder(A, a, o1.id); await A.click("#dialogReceiptLinkBtn"); await a.wait(200);
  const m2 = (await a.wa()).pop();
  check("sending the receipt link again gives the same link", linkOf(m2) === link1, m2);

  /* 5) a worker delivers on their own device → same image + chat; the worker can send the link too */
  await a.closeAll(); await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Worker One"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "worker1");
  const tempPw = await A.inputValue("#qf_password"); await A.click("#quickFormSubmitBtn");
  await until(async () => (await cloud.query("select 1 from auth.users where email = 'worker1@997laundry.app'")).rowCount === 1);
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {});
  await a.wait(1200); await a.closeAll();
  const B = await device("B"); const b = H(B);
  await B.goto(url); await B.waitForSelector("#au_cloud_join"); await B.click("#au_cloud_join");
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await b.wait(150);
  await B.fill("#au_user", "worker1"); await B.fill("#au_pass", tempPw); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("#au_pw2"); await b.wait(150);
  await B.fill("#au_pw", WORKER_PW); await B.fill("#au_pw2", WORKER_PW); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("body:not(.auth-locked)"); await b.wait(800); await b.closeAll();
  const o2 = await order(B, b, "", "33445566", 2, true); // 0.800
  await readyCash(B, b, o2.id, 0.8);
  await deliver(B, b, o2.id, 2);
  const mw = (await b.wa()).pop() || "";
  const cw = await b.clip();
  check("worker delivery: WhatsApp opens with thanks, receipt image copied", /تم تسليم طلبك/.test(mw) && cw && cw.w === 760, mw);
  await openOrder(B, b, o2.id); await B.click("#dialogReceiptLinkBtn"); await b.wait(200);
  const link2 = linkOf((await b.wa()).pop() || "");
  check("worker can send the receipt link too", !!link2 && link2 !== link1, link2);
  check("worker's receipt is saved in the cloud (allowed for workers)", await until(async () => (await cloud.query("select 1 from public.records where collection='orders' and record_id=$1 and data->'receiptPub'->>'token' is not null", [o2.id])).rowCount === 1));
  const C2 = await device("customer2", iphone);
  await C2.goto(link2); await C2.waitForSelector("#rImg", { timeout: 15000 }).catch(() => {});
  const m3 = await C2.evaluate((t) => window.L997Cloud.publicReceipt(t), new URL(link2).searchParams.get("t"));
  check("…customer opens it: fully paid 0.800", m3.model && /مدفوع بالكامل/.test(m3.model.status.text) && /0\.800/.test(m3.model.total), JSON.stringify(m3.model && m3.model.status));

  /* 5b) owner deletes a duplicate customer → removed in the cloud and on the worker's device */
  await a.closeAll(); await a.nav("customers"); await A.click("#addCustomerBtn");
  await A.fill("#customerName", "Boss duplicate"); await A.fill("#customerPhone", "37663707"); await A.click("#saveCustomerBtn"); await a.wait(300);
  const dupC = (await a.ls("l997_customers")).find((c) => c.name === "Boss duplicate");
  await until(async () => (await cloud.query("select 1 from public.records where collection='customers' and record_id=$1 and not deleted", [dupC.id])).rowCount === 1);
  await until(async () => (await b.ls("l997_customers")).some((c) => c.id === dupC.id), 20000);
  await A.evaluate((id) => window.openCustomerProfile997(id), dupC.id); await a.wait(200);
  await A.click("#cpDelete"); await A.click("#quickFormSubmitBtn"); await a.wait(300);
  check("deleted customer is marked deleted in the cloud", await until(async () => (await cloud.query("select 1 from public.records where collection='customers' and record_id=$1 and deleted", [dupC.id])).rowCount === 1));
  check("…and disappears from the worker's device", await until(async () => !(await b.ls("l997_customers")).some((c) => c.id === dupC.id), 25000));

  /* 6) receipt-link SQL not run on the server → no link button (no broken links); delivery image still works */
  psql(cloud.db, ["-q", "-c", "drop function public.public_receipt(text)"]);
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)"); await a.wait(2500); await a.closeAll();
  const o3 = await order(A, a, "", "33445566", 1, true);
  await readyCash(A, a, o3.id, 0.4);
  const n3 = (await a.wa()).length;
  await deliver(A, a, o3.id, 1);
  const m4 = (await a.wa()).pop() || "";
  check("without the link function: delivery still copies the image and opens the chat", (await a.wa()).length === n3 + 1 && /تم تسليم طلبك/.test(m4) && !linkOf(m4), m4);
  await openOrder(A, a, o3.id);
  check("…and the 'receipt link' button is hidden", !(await A.isVisible("#dialogReceiptLinkBtn")));
  await a.closeAll(); await a.nav("profile"); await a.wait(300);
  check("profile → cloud panel tells the owner to run supabase/receipt_link.sql", /receipt_link\.sql/.test(await A.textContent("#cloudPanel")));

  /* 7) WhatsApp Business API switched on → the receipt image is sent automatically (function mocked) */
  const calls = []; let mode = "ok"; let graphCalls = 0;
  A.on("request", (r) => { if (/graph\.facebook\.com/.test(r.url())) graphCalls++; });
  await A.route(/\/functions\/v1\/whatsapp-send$/, async (route) => {
    const r = route.request(); const body = JSON.parse(r.postData() || "{}");
    calls.push({ auth: r.headers().authorization || "", body });
    if (body.ping) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, configured: true, template: "order_delivered", lang: "ar" }) });
    if (mode === "fail") return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "send failed", detail: "Template name does not exist" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "wamid.X" }) });
  });
  await a.closeAll(); await a.nav("settings"); await A.click('[data-settings-tab="operating"]');
  await A.click("#waApiCheckBtn"); await until(async () => /الربط جاهز/.test(await A.textContent("#waApiStatus")), 8000);
  check("settings → 'check connection' reports the API is ready", /الربط جاهز/.test(await A.textContent("#waApiStatus")), await A.textContent("#waApiStatus"));
  await A.click("#waApiTestBtn");
  await A.fill("#qf_phone", "33556677");
  await A.click("#quickFormSubmitBtn");
  check("test send uses a synthetic receipt and the entered destination", await until(() =>
    calls.some(({ body }) => body.orderNo === "TEST" && body.to === "97333556677"
      && body.name === "إيصال تجريبي" && Buffer.from(body.image, "base64")[0] === 0x89), 8000));
  await A.check("#waApiSetting"); await A.click("#saveSettingsBtn"); await a.wait(300);
  check("automatic sending switched on and saved", (await a.ls("l997_settings")).waApi.enabled === true);
  const o4 = await order(A, a, "", "33445566", 3, true); // 1.200
  await readyCash(A, a, o4.id, 0.5);
  const n4 = (await a.wa()).length;
  await deliver(A, a, o4.id, 3); await a.wait(800);
  const sent = calls.filter((c) => !c.body.ping).pop();
  check("delivery → receipt sent automatically: no WhatsApp window, nothing to tap", (await a.wa()).length === n4 && !!sent && !(await A.isVisible("#quickFormSubmitBtn")), (await a.wa()).length - n4);
  const png = sent ? Buffer.from(sent.body.image, "base64") : Buffer.alloc(0);
  check("…to the customer's number with name, order no., 'remaining 0.700' and a real PNG", sent && sent.body.to === "97333445566" && sent.body.orderNo === o4.number && /المتبقي: 0\.700/.test(sent.body.line) && png[0] === 0x89 && png[1] === 0x50 && png.length > 20000, sent && JSON.stringify({ to: sent.body.to, n: sent.body.orderNo, line: sent.body.line, bytes: png.length }));
  check("…as the signed-in member (bearer token — the Meta token is never in the app)", sent && /^Bearer \S+/.test(sent.auth) && !Object.keys(sent.body).some((k) => /token|secret/i.test(k)) && !graphCalls, sent && sent.auth.slice(0, 12));
  check("…and recorded on the order + activity log", !!(await a.ls("l997_orders")).find((o) => o.id === o4.id).waReceiptAt && (await a.ls("l997_audit")).some((x) => /تلقائياً على واتساب/.test(x.action || "")));
  // API error → manual fallback offered
  mode = "fail";
  const o5 = await order(A, a, "", "33445566", 1, true);
  await readyCash(A, a, o5.id, 0.4);
  await deliver(A, a, o5.id, 1); await a.wait(800);
  const fb = await A.isVisible("#quickFormSubmitBtn");
  check("API error → the manual way is offered at once (copy image + open chat)", fb && /يدوياً/.test(await A.textContent("#quickFormDialog")), fb);
  const n5 = (await a.wa()).length;
  if (fb) { await A.click("#quickFormSubmitBtn"); await a.wait(600); }
  check("…pressing it copies the image and opens the customer's chat", (await a.wa()).length === n5 + 1 && (await a.clip()) !== null);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL RECEIPT-LINK CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
