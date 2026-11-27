// WhatsApp AI assistant — the system side (cloud): chats list with "needs a person" badges, open a chat, reply as
// staff (the assistant pauses), hand back to the assistant, mark done (real RLS / column grants on wa_threads),
// assistant settings, WhatsApp pickup requests confirmed from the delivery page, English and phone layout.
// The whatsapp-bot Edge Function itself is unit-tested in tests/wa-bot.test.js; here its endpoint is simulated.
// Usage: node tests/e2e.wabot.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");
const { psql } = require("./local-postgres");
const DB = "l997_wabot_" + process.pid;
// writes as the database owner — what the whatsapp-bot function does with the service role
const adm = (sql) => psql(DB, ["-q"], sql).stdout;
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`); if (!cond) failures++; }
const PW = "Owner#2026pass";

(async () => {
  const cloud = await startStandin({ latencyMs: 30, database: DB });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [], botCalls = [];
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const A = await ctx.newPage();
  A.on("pageerror", (e) => errors.push(e.message));
  await A.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await A.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); window.print = () => {}; }, { url: cloud.url, key: "k" });
  // the whatsapp-bot function (simulated): ping + staff reply (stores the message like the real function)
  await A.route(/\/functions\/v1\/whatsapp-bot$/, async (route) => {
    const body = JSON.parse(route.request().postData() || "{}"); botCalls.push(body);
    if (body.action === "ping") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, whatsapp: true, signature: true, verify: true, ai: true, model: "claude-sonnet-5-5" }) });
    if (body.action === "reply") {
      const shop = (await cloud.query("select id from public.shops limit 1")).rows[0].id;
      adm(`insert into public.wa_messages (shop_id, phone, dir, who, body) values (${lit(shop)}, ${lit(body.to)}, 'out', 'Owner', ${lit(body.text)});`);
      if (!body.keepBot) adm(`update public.wa_threads set mode='human', human_at=now(), waiting=false, unread=0 where shop_id=${lit(shop)} and phone=${lit(body.to)};`);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "wamid.x" }) });
    }
    return route.fulfill({ status: 400, body: "{}" });
  });
  await A.goto(url);
  const nav = (pg) => A.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => A.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const wait = (ms) => A.waitForTimeout(ms);

  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", PW); await A.fill("#au_pw2", PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  await nav("profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  await A.waitForFunction(() => window.L997Cloud && window.L997Cloud.status().linked, null, { timeout: 30000 });
  await wait(2000); await closeAll();

  // conversations as the function would have stored them
  const shop = (await cloud.query("select id from public.shops limit 1")).rows[0].id;
  const S = lit(shop);
  adm(`insert into public.wa_threads (shop_id, phone, name, mode, waiting, flag, unread, last_text, last_at) values
    (${S}, '97333111111', 'Ali WA', 'bot', true, 'human', 2, 'ابي اكلم الموظف', now()),
    (${S}, '97333222222', 'Mona', 'bot', false, null, 0, 'بكم الثوب؟', now() - interval '1 hour'),
    (${S}, '97333333333', 'Huda', 'bot', true, 'complaint', 1, 'الثوب فيه بقعة', now() - interval '2 hour');
  insert into public.wa_messages (shop_id, phone, dir, who, body, at) values
    (${S}, '97333111111', 'in', 'customer', 'هلا، بكم الثوب؟', now() - interval '5 min'),
    (${S}, '97333111111', 'out', 'bot', 'هلا والله 🌸 غسيل وكي الثوب 0.500 د.ب', now() - interval '4 min'),
    (${S}, '97333111111', 'in', 'customer', 'ابي اكلم الموظف', now() - interval '3 min'),
    (${S}, '97333111111', 'note', 'system', '🙋 طلب التحدث مع موظف: يبي يكلم موظف', now() - interval '3 min');`);

  // members cannot write messages or delete through the API (server rules)
  const forged = await A.evaluate(async (u) => {
    const tok = Object.values(JSON.parse(localStorage.getItem("l997_cloud_tokens") || "{}"))[0].a;
    const h = { apikey: "k", Authorization: "Bearer " + tok, "Content-Type": "application/json" };
    const ins = await fetch(u + "/rest/v1/wa_messages", { method: "POST", headers: h, body: JSON.stringify({ shop_id: "x", phone: "97333111111", dir: "out", body: "forged" }) });
    return ins.status;
  }, cloud.url);
  check("server: a signed-in member cannot write chat messages directly (only the function can)", forged >= 400, forged);

  await nav("whatsapp"); await wait(800);
  const listTxt = await A.textContent("#waRoot");
  check("WhatsApp page lists the chats with «needs a person» and «complaint» badges", /Ali WA/.test(listTxt) && /يطلب موظف/.test(listTxt) && /شكوى/.test(listTxt) && /Mona/.test(listTxt), listTxt.replace(/\s+/g, " ").slice(0, 300));
  const badge = await A.textContent('.nav-item[data-page="whatsapp"] .nav-count');
  check("menu badge = chats that need a person (2)", badge.trim() === "2", badge);
  await A.click('[data-wa-filter="staff"]'); await wait(200);
  check("filter «needs a person» shows only those chats", (await A.$$(".wa-thread")).length === 2);
  await A.click('[data-wa-open="97333111111"]'); await wait(600);
  const chat = await A.textContent("#waMsgs");
  check("opening a chat shows the conversation: customer, assistant and the hand-off note", /بكم الثوب/.test(chat) && /0\.500/.test(chat) && /طلب التحدث مع موظف/.test(chat) && (await A.$$(".wa-bubble.bot")).length === 1, chat.slice(0, 200));
  check("…and clears its unread count on the server", (await cloud.query("select unread from public.wa_threads where phone='97333111111'")).rows[0].unread === 0);

  await A.click('[data-wa-quick]'); await A.fill("#waText", "هلا Ali، معك الموظف 👋 شلون أقدر أساعدك؟"); await A.click("#waSend"); await wait(800);
  const rep = botCalls.find((c) => c.action === "reply");
  check("staff reply goes through the function to the customer's number", rep && rep.to === "97333111111" && /معك الموظف/.test(rep.text) && !rep.keepBot);
  check("…the chat is now handled by a person (assistant paused) and shows the reply", (await cloud.query("select mode from public.wa_threads where phone='97333111111'")).rows[0].mode === "human" && /معك الموظف/.test(await A.textContent("#waMsgs")));
  await A.click('[data-wa-mode="bot"]'); await wait(500);
  const t1 = (await cloud.query("select mode, waiting, flag from public.wa_threads where phone='97333111111'")).rows[0];
  check("«back to assistant» works with the real server permissions (mode bot, no longer waiting)", t1.mode === "bot" && t1.waiting === false && t1.flag === null, JSON.stringify(t1));
  await A.click('[data-wa-open="97333333333"]').catch(async () => { await A.click('[data-wa-filter="all"]'); await wait(200); await A.click('[data-wa-open="97333333333"]'); }); await wait(500);
  await A.click("[data-wa-done]"); await wait(500);
  check("«done» clears the complaint flag", (await cloud.query("select waiting, flag from public.wa_threads where phone='97333333333'")).rows[0].flag === null);

  await A.click("#waPing"); await wait(400);
  check("connection check lists the 4 parts (WhatsApp, Meta signature, verify token, AI)", /WA_APP_SECRET/.test(await A.textContent("#waPingOut")) && /claude-sonnet-5-5/.test(await A.textContent("#waPingOut")));

  // assistant settings (Settings → Operating)
  await nav("settings"); await A.evaluate(() => document.querySelector('[data-settings-tab="operating"]').click()); await wait(200);
  await A.check("#waBotOn"); await A.fill("#waBotFrom", "09:00"); await A.fill("#waBotTo", "22:00"); await A.fill("#waBotAreas", "الرفاع، عسكر");
  await A.fill("#waBotExtra", "الغسيل بالبخار للبدلات فقط 2.000 د.ب"); await A.click("#saveSettingsBtn"); await wait(300);
  const wb = (await A.evaluate(() => JSON.parse(localStorage.getItem("l997_settings")))).waBot;
  check("assistant settings saved (on, staff 09:00–22:00, areas, extra info)", wb.enabled && wb.staffFrom === "09:00" && wb.staffTo === "22:00" && /عسكر/.test(wb.areas) && /بالبخار/.test(wb.extra), JSON.stringify(wb));
  await A.waitForTimeout(3500);
  const srv = (await cloud.query("select data->'waBot' w from public.records where collection='settings' and not deleted")).rows[0].w;
  check("…and synced to the cloud, where the assistant reads them", srv && srv.enabled === true && srv.staffFrom === "09:00", JSON.stringify(srv));

  // a pickup request booked by the assistant appears on the delivery page, staff confirm it to the customer
  await A.evaluate(() => {
    const cs = JSON.parse(localStorage.getItem("l997_customers") || "[]"); cs.unshift({ id: "cw1", name: "Sara", phone: "97333444444", balance: 0, createdAt: new Date().toISOString() }); localStorage.setItem("l997_customers", JSON.stringify(cs));
    const s = JSON.parse(localStorage.getItem("l997_suspended_orders") || "[]"); const now = new Date().toISOString();
    s.unshift({ id: "wreq1", kind: "pickup", source: "whatsapp", needsConfirm: true, customerId: "cw1", customerName: "Sara", address: "الرفاع — مجمع 905", date: window.L997Finance.todayStr(), slot: "evening", drop: true, notes: "", status: "new", items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: "WhatsApp" });
    localStorage.setItem("l997_suspended_orders", JSON.stringify(s));
  });
  await A.reload(); await A.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await A.isVisible("#au_user")) { await A.fill("#au_user", "owner"); await A.fill("#au_pass", PW); await A.click("#au_form button[type=submit]"); await A.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("delivery"); await wait(400);
  check("delivery page: the WhatsApp request says it waits for confirmation", /بانتظار تأكيدك/.test(await A.textContent("#deliveryRoot")) && await A.isVisible('[data-req-confirm="wreq1"]'));
  const n0 = botCalls.length;
  await A.click('[data-req-confirm="wreq1"]'); await wait(600);
  const conf = botCalls.slice(n0).find((c) => c.action === "reply");
  const req = (await A.evaluate(() => JSON.parse(localStorage.getItem("l997_suspended_orders")))).find((x) => x.id === "wreq1");
  check("«confirm» sends the confirmation on WhatsApp (assistant stays on) and the request becomes a normal booking", conf && conf.to === "97333444444" && conf.keepBot === true && /تم تأكيد موعد استلام/.test(conf.text) && req.needsConfirm === false && await A.isVisible('[data-req-onway="wreq1"]'), JSON.stringify(conf));

  // English + phone layout
  await A.selectOption("#langSelect", "en"); await wait(900); await A.waitForSelector("body:not(.auth-locked)").catch(() => {});
  if (await A.isVisible("#au_user").catch(() => false)) { await A.fill("#au_user", "owner"); await A.fill("#au_pass", PW); await A.click("#au_form button[type=submit]"); await A.waitForSelector("body:not(.auth-locked)"); }
  await nav("whatsapp"); await wait(800);
  const en = await A.textContent("#waRoot");
  const custText = await A.$$eval(".wa-t-last, .wa-t-top b", (els) => els.map((e) => e.textContent).join(" "));
  const ar = (en.match(/[\u0600-\u06FF]{3,}/g) || []).filter((x) => !custText.includes(x));
  check("English chats page: labels in English (customer text aside)", /WhatsApp chats/.test(en) && /Needs a person/.test(en) && ar.length === 0, JSON.stringify(ar.slice(0, 6)));
  await A.setViewportSize({ width: 390, height: 844 }); await wait(300);
  await A.click('[data-wa-open="97333222222"]'); await wait(500);
  const ph = await A.evaluate(() => ({ ov: document.documentElement.scrollWidth - window.innerWidth, list: getComputedStyle(document.querySelector(".wa-list")).display, back: !!document.querySelector("#waBack") && getComputedStyle(document.querySelector("#waBack")).display !== "none" }));
  check("iPhone: chat opens full-screen with a back button, no sideways scrolling", ph.ov <= 1 && ph.list === "none" && ph.back, JSON.stringify(ph));
  // shop tablet (8", portrait and landscape): the reply box is on screen without scrolling the page, and only the messages scroll
  const tab = async (w, h) => { await A.setViewportSize({ width: w, height: h }); await wait(400); await A.evaluate(() => window.scrollTo(0, 0)); await wait(100);
    return A.evaluate(() => { const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }; const send = r("#waSend"), msgs = r("#waMsgs");
      return { ov: document.documentElement.scrollWidth - window.innerWidth, sendVisible: !!send && send.bottom <= window.innerHeight + 1 && send.top >= 0, msgsH: msgs ? Math.round(msgs.height) : 0, list: getComputedStyle(document.querySelector(".wa-list")).display }; }); };
  const tp = await tab(800, 1280);
  check("tablet portrait: chat full width, reply box on screen, messages area tall", tp.ov <= 1 && tp.sendVisible && tp.list === "none" && tp.msgsH >= 500, JSON.stringify(tp));
  const tl = await tab(1280, 800);
  check("tablet landscape: reply box on screen, messages area usable", tl.ov <= 1 && tl.sendVisible && tl.msgsH >= 250, JSON.stringify(tl));
  // the 6-second refresh with nothing new does not redraw (no jumps, taps not lost)
  await A.evaluate(() => { const m = document.getElementById("waMsgs"); m.dataset.mark = "x"; });
  await wait(6800);
  check("auto-refresh with nothing new leaves the screen alone", await A.evaluate(() => (document.getElementById("waMsgs") || {}).dataset?.mark === "x"));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL WHATSAPP-ASSISTANT CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
