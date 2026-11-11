// Unit tests for supabase/functions/whatsapp-bot (WhatsApp AI assistant), with Supabase REST, Meta and Claude mocked.
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "whatsapp-bot", "index.ts"), "utf8");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wab-")), "index.mjs");
fs.writeFileSync(tmp, src);
const load = () => import(tmp).then((m) => m.handle);

const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc", WA_TOKEN: "tok", WA_PHONE_ID: "123", WA_APP_SECRET: "appsecret", WA_VERIFY_TOKEN: "verify-me" };
const SHOP = "shop-1";

// ---------- in-memory Supabase REST + Meta Graph ----------
function world(opts = {}) {
  const settings = { prices: { thob_cotton_washiron: 0.5, thob_cotton_iron: 0.2, shirt_washiron: 0.4, abaya_plain_washiron: 1 }, garmentActive: {}, serviceActive: {},
    packageDefs: [{ id: "p50", name: "Package 50ps", serviceType: "washiron", pieceCount: 50, price: 16.9, bonus: "لحاف مجاني", garments: [] }],
    delivery: { on: true, fee: 0.5, pkgFree: 4, pkgFee: 0.5, freeOver: 0 }, waBot: { enabled: true, staffOn: true, staffFrom: "00:00", staffTo: "23:59", ...(opts.bot || {}) },
    discountCodes: [{ code: "NAWAF", percent: 45 }] };
  const recs = [
    { collection: "settings", record_id: "_", data: settings },
    { collection: "profile", record_id: "_", data: { nameAr: "مغسلة 997", nameEn: "997 Laundry", region: "الرفاع" } },
    { collection: "customers", record_id: "c1", data: { id: "c1", name: "Ali", phone: "97333111111" } },
    { collection: "customers", record_id: "c2", data: { id: "c2", name: "Other", phone: "97333222222" } },
    { collection: "orders", record_id: "o1", data: { id: "o1", number: "00007", customerId: "c1", status: "ready", items: [{ qty: 3 }], payment: { total: 1.5, paid: 0 }, paymentConfirmed: false, createdAt: "2026-11-01T10:00:00Z" } },
    { collection: "orders", record_id: "o2", data: { id: "o2", number: "00008", customerId: "c2", status: "received", items: [{ qty: 9 }], payment: { total: 9.9, paid: 0 }, createdAt: "2026-11-02T10:00:00Z" } },
  ].map((r) => ({ shop_id: SHOP, deleted: false, ...r }));
  const threads = [], msgs = [], sent = [], reads = [], buttons = [];
  let mid = 1;
  const q = (url) => { const u = new URL(url); const o = {}; u.searchParams.forEach((v, k) => { o[k] = v; }); return { table: u.pathname.split("/rest/v1/")[1], o }; };
  const match = (row, o) => Object.entries(o).every(([k, v]) => {
    if (["select", "limit", "order", "on_conflict"].includes(k)) return true;
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    const cur = k.startsWith("data->>") ? (row.data || {})[k.slice(7)] : row[k];
    if (op === "eq") return String(cur) === val;
    if (op === "neq") return String(cur) !== val;
    return true;
  });
  const res = (body, status = 200) => new Response(body === undefined ? "" : JSON.stringify(body), { status });
  const f = async (url, opt = {}) => {
    const method = opt.method || "GET";
    if (url.includes("graph.facebook.com")) {
      const b = JSON.parse(opt.body);
      if (b.status === "read") { reads.push(b.message_id); return res({ success: true }); }
      if (opts.sendFails) return res({ error: { message: "(#131047) Re-engagement message" } }, 400);
      if (b.type === "interactive") { buttons.push(b); return res({ messages: [{ id: "wamid.btn" + buttons.length }] }); }
      sent.push(b); return res({ messages: [{ id: "wamid.out" + sent.length }] });
    }
    if (url.endsWith("/auth/v1/user")) return opt.headers.Authorization === "Bearer staff-jwt" ? res({ id: "u1" }) : res({}, 401);
    const { table, o } = q(url);
    if (table === "shops") return res([{ id: SHOP }]);
    if (table === "shop_members") return res(o.user_id === "eq.u1" ? [{ shop_id: SHOP, role: "worker", display_name: "Yaseen" }] : []);
    const store = table === "records" ? recs : table === "wa_threads" ? threads : table === "wa_messages" ? msgs : null;
    if (!store) return res({}, 404);
    if (method === "GET") {
      let rows = store.filter((r) => match(r, o));
      if (o.order && o.order.startsWith("at.desc")) rows = rows.slice().sort((a, b) => b.id - a.id);
      if (o.limit) rows = rows.slice(0, Number(o.limit));
      return res(rows.map((r) => ({ ...r })));
    }
    if (method === "POST") {
      const b = JSON.parse(opt.body);
      if (table === "wa_messages" && b.wa_id && msgs.some((m) => m.wa_id === b.wa_id)) return res({ code: "23505" }, 409);
      const row = { ...b, ...(table === "wa_messages" ? { id: mid++, at: new Date().toISOString() } : {}), ...(table === "wa_threads" ? { mode: b.mode || "bot", waiting: !!b.waiting, unread: b.unread || 0 } : {}) };
      store.push(row); return res([row], 201);
    }
    if (method === "PATCH") {
      const b = JSON.parse(opt.body); const rows = store.filter((r) => match(r, o)); rows.forEach((r) => Object.assign(r, b)); return res(rows);
    }
    return res({}, 405);
  };
  return { f, recs, threads, msgs, sent, reads, buttons, settings };
}

// ---------- fake Claude: a script of turns ----------
function fakeAI(script) {
  const calls = [];
  return { calls, beta: { messages: { create: async (p) => {
    calls.push(JSON.parse(JSON.stringify(p)));
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    return typeof step === "function" ? step(p) : step;
  } } } };
}
const text = (t) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });
const tool = (name, input, id = "t1") => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }] });

// ---------- webhook helpers ----------
function hook(body, secret = ENV.WA_APP_SECRET) {
  const raw = JSON.stringify(body);
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return new Request("https://x.supabase.co/functions/v1/whatsapp-bot", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body: raw });
}
let n = 0;
const inbound = (from, body, extra) => ({ entry: [{ changes: [{ value: { contacts: [{ profile: { name: "WA Name" }, wa_id: from }], messages: [{ from, id: "wamid.in" + (++n), type: "text", text: { body }, ...(extra || {}) }] } }] }] });

test("Meta webhook verification: right token echoes the challenge, wrong token is refused", async () => {
  const handle = await load(), w = world();
  const ok = await handle(new Request("https://x/functions/v1/whatsapp-bot?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"), ENV, { fetch: w.f });
  assert.equal(ok.status, 200); assert.equal(await ok.text(), "12345");
  const bad = await handle(new Request("https://x/functions/v1/whatsapp-bot?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1"), ENV, { fetch: w.f });
  assert.equal(bad.status, 403);
});

test("a webhook with a wrong signature is refused and nothing is stored or sent", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("hi")]);
  const r = await handle(hook(inbound("97333111111", "هلا"), "wrong-secret"), ENV, { fetch: w.f, ai });
  assert.equal(r.status, 401); assert.equal(w.msgs.length, 0); assert.equal(ai.calls.length, 0); assert.equal(w.sent.length, 0);
});

test("price question: Claude gets the real price list (cached), Bahraini rules, low effort, fallbacks; the reply is sent and stored", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("هلا والله 🌸 غسيل وكي الثوب 0.500 د.ب")]);
  const r = await handle(hook(inbound("97333111111", "بكم غسيل الثوب؟")), ENV, { fetch: w.f, ai });
  assert.equal(r.status, 200);
  const p = ai.calls[0];
  assert.equal(p.model, "claude-sonnet-5-5"); assert.equal(p.output_config.effort, "low"); assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.match(p.system[0].text, /اللهجة البحرينية/);
  assert.match(p.system[1].text, /ثوب \(Thobe\): غسيل وكي 0\.500 د\.ب · كي 0\.200 د\.ب/);
  assert.match(p.system[1].text, /Package 50ps: غسيل وكي، 50 قطعة بـ 16\.900 د\.ب/);
  assert.deepEqual(p.system[1].cache_control, { type: "ephemeral" });
  assert.ok(!/NAWAF/.test(JSON.stringify(p)), "discount codes are never given to the model");
  const last = p.messages[p.messages.length - 1];
  assert.equal(last.role, "user"); assert.match(last.content[0].text, /العميل مسجّل: Ali/);
  assert.equal(w.sent.length, 1); assert.equal(w.sent[0].to, "97333111111"); assert.match(w.sent[0].text.body, /0\.500/);
  assert.deepEqual(w.msgs.map((m) => m.dir), ["in", "out", "out"]);
  assert.equal(w.reads.length, 1, "blue ticks: the customer's message is marked as read");
});

test("the same WhatsApp message delivered twice is answered once", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("ok")]);
  const body = inbound("97333111111", "هلا");
  await handle(hook(body), ENV, { fetch: w.f, ai }); await handle(hook(body), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, 1); assert.equal(w.sent.length, 1);
});

test("pickup booking from a new customer: customer + pickup REQUEST created (needs staff confirmation), chat flagged", async () => {
  const handle = await load(), w = world();
  const ai = fakeAI([tool("request_pickup", { customer_name: "Sara", area: "الرفاع", address: "مجمع 905 طريق 12", day: "tomorrow", slot: "evening", deliver_back: true, notes: "5 ثياب" }),
    (p) => { const tr = p.messages[p.messages.length - 1].content[0]; assert.match(tr.content, /waiting for staff confirmation/); return text("وصل طلبك للمحل ✅ الموظف بيأكد الموعد قريباً"); }]);
  await handle(hook(inbound("97333999999", "ايه أكد")), ENV, { fetch: w.f, ai });
  const cust = w.recs.find((r) => r.collection === "customers" && r.data.phone === "97333999999");
  assert.ok(cust && cust.data.name === "Sara", "new customer created with the phone and name");
  const req = w.recs.find((r) => r.collection === "suspended_orders");
  assert.ok(req && req.data.kind === "pickup" && req.data.needsConfirm === true && req.data.source === "whatsapp" && req.data.slot === "evening" && req.data.drop === true && req.data.customerId === cust.data.id);
  assert.match(req.data.address, /الرفاع — مجمع 905/);
  assert.equal(w.threads[0].flag, "pickup"); assert.equal(w.threads[0].waiting, true);
  assert.match(w.sent[0].text.body, /بيأكد الموعد/);
});

test("'ابي اكلم الموظف' while staff are available: chat handed to staff, the assistant then stays quiet", async () => {
  const handle = await load(), w = world(), ai = fakeAI([tool("request_human", { reason: "يبي يكلم موظف" }), text("تم 👍 حولتك للموظف، بيرد عليك هنا")]);
  await handle(hook(inbound("97333111111", "ابي اكلم الموظف")), ENV, { fetch: w.f, ai });
  assert.equal(w.threads[0].mode, "human"); assert.equal(w.threads[0].flag, "human");
  assert.ok(w.msgs.some((m) => m.dir === "note" && /طلب التحدث مع موظف/.test(m.body)));
  const before = ai.calls.length, sentBefore = w.sent.length;
  await handle(hook(inbound("97333111111", "متى بتردون؟")), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, before, "no AI call while a person handles the chat"); assert.equal(w.sent.length, sentBefore, "no automatic reply");
  assert.equal(w.threads[0].unread, 2);
});

test("hand-off when staff are NOT available: the model is told so (no false transfer), the chat waits for a call back", async () => {
  const handle = await load(), w = world({ bot: { staffOn: false } });
  const ai = fakeAI([tool("request_human", { reason: "x" }), (p) => { const tr = JSON.parse(p.messages[p.messages.length - 1].content[0].content); assert.equal(tr.transferred, false); return text("الموظف مو متوفر الحين، تبي تخلي رسالة؟"); }]);
  await handle(hook(inbound("97333111111", "حولني للموظف")), ENV, { fetch: w.f, ai });
  assert.equal(w.threads[0].mode, "bot"); assert.equal(w.threads[0].waiting, true);
  assert.match(w.sent[0].text.body, /مو متوفر/);
});

test("order status shows only the sender's own orders (privacy)", async () => {
  const handle = await load(), w = world();
  let seen = null;
  const ai = fakeAI([tool("get_my_orders", {}), (p) => { seen = p.messages[p.messages.length - 1].content[0].content; return text("طلبك #00007 جاهز"); }]);
  await handle(hook(inbound("97333111111", "وين طلبي")), ENV, { fetch: w.f, ai });
  assert.match(seen, /00007/); assert.match(seen, /جاهز للاستلام/); assert.ok(!/00008/.test(seen), "another customer's order is never shown");
});

test("complaint is recorded for management and the chat is flagged", async () => {
  const handle = await load(), w = world(), ai = fakeAI([tool("submit_feedback", { kind: "complaint", message: "الثوب فيه بقعة", order_number: "00007" }), text("نعتذر منك 🙏 بلغنا الإدارة")]);
  await handle(hook(inbound("97333111111", "الثوب رجع فيه بقعة")), ENV, { fetch: w.f, ai });
  assert.equal(w.threads[0].flag, "complaint");
  assert.ok(w.msgs.some((m) => m.dir === "note" && /شكوى \(طلب #00007\)/.test(m.body)));
});

test("without a Claude key the assistant never pretends: first message gets a holding reply and goes to staff", async () => {
  const handle = await load(), w = world();
  await handle(hook(inbound("97333111111", "هلا")), ENV, { fetch: w.f });
  assert.match(w.sent[0].text.body, /الموظف بيرد عليك/); assert.equal(w.threads[0].waiting, true);
  await handle(hook(inbound("97333111111", "عادي سؤال")), ENV, { fetch: w.f });
  assert.equal(w.sent.length, 1, "no repeated holding message");
});

test("assistant switched off: messages are stored for the inbox but not answered", async () => {
  const handle = await load(), w = world({ bot: { enabled: false } }), ai = fakeAI([text("x")]);
  await handle(hook(inbound("97333111111", "هلا")), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, 0); assert.equal(w.sent.length, 0); assert.equal(w.msgs.length, 1); assert.equal(w.threads.length, 1);
});

test("a refusal or an API error gives a polite message and alerts staff", async () => {
  const handle = await load(), w = world();
  await handle(hook(inbound("97333111111", "x")), ENV, { fetch: w.f, ai: fakeAI([{ stop_reason: "refusal", content: [] }]) });
  assert.match(w.sent[0].text.body, /أحولك للموظف/);
  const w2 = world(); const broken = { beta: { messages: { create: async () => { throw Object.assign(new Error("overloaded"), { status: 529 }); } } } };
  await handle(hook(inbound("97333111111", "x")), ENV, { fetch: w2.f, ai: broken });
  assert.match(w2.sent[0].text.body, /بلغت الموظف/); assert.equal(w2.threads[0].waiting, true);
  const note = w2.msgs.find((m) => m.dir === "note");
  assert.ok(note && /Claude/.test(note.body) && /529/.test(note.body) && /overloaded/.test(note.body), "the real reason is shown to staff in the chat");
});

test("check connection makes a real call to Claude and reports a bad key with its reason", async () => {
  const handle = await load(), w = world();
  const req = (auth, body) => new Request("https://x/functions/v1/whatsapp-bot", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });
  const good = { models: { retrieve: async (id) => ({ id }) } };
  const okPing = await (await handle(req("Bearer staff-jwt", { action: "ping" }), ENV, { fetch: w.f, ai: good })).json();
  assert.equal(okPing.ai, true); assert.equal(okPing.aiError, null);
  const bad = { models: { retrieve: async () => { throw Object.assign(new Error("invalid x-api-key"), { status: 401 }); } } };
  const badPing = await (await handle(req("Bearer staff-jwt", { action: "ping" }), ENV, { fetch: w.f, ai: bad })).json();
  assert.equal(badPing.ai, false); assert.match(badPing.aiError, /401 invalid x-api-key/);
});

test("staff reply from the system: only signed-in members; sends, stores, and takes the chat over", async () => {
  const handle = await load(), w = world();
  const req = (auth, body) => new Request("https://x/functions/v1/whatsapp-bot", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });
  assert.equal((await handle(req("", { action: "reply", to: "97333111111", text: "هلا" }), ENV, { fetch: w.f })).status, 401);
  assert.equal((await handle(req("Bearer someone", { action: "reply", to: "97333111111", text: "هلا" }), ENV, { fetch: w.f })).status, 401);
  const r = await handle(req("Bearer staff-jwt", { action: "reply", to: "97333111111", text: "هلا، طلبك جاهز" }), ENV, { fetch: w.f });
  assert.equal(r.status, 200);
  assert.equal(w.sent[0].text.body, "هلا، طلبك جاهز");
  assert.equal(w.msgs[0].who, "Yaseen"); assert.equal(w.threads[0].mode, "human"); assert.equal(w.threads[0].waiting, false);
  const ping = await (await handle(req("Bearer staff-jwt", { action: "ping" }), ENV, { fetch: w.f })).json();
  assert.deepEqual([ping.whatsapp, ping.signature, ping.verify, ping.ai], [true, true, true, false]);
});

test("a location message becomes a map link the assistant can use as the address", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("وصلني موقعك 👍")]);
  const body = { entry: [{ changes: [{ value: { contacts: [], messages: [{ from: "97333111111", id: "wamid.loc1", type: "location", location: { latitude: 26.13, longitude: 50.55 } }] } }] }] };
  await handle(hook(body), ENV, { fetch: w.f, ai });
  assert.match(w.msgs[0].body, /maps\.google\.com\/\?q=26\.13,50\.55/);
});

test("coexistence: a reply typed on the shop phone app is logged and the assistant then stays quiet", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("رد المساعد")]);
  const echo = { entry: [{ changes: [{ field: "smb_message_echoes", value: { message_echoes: [{ from: "15556463423", to: "97333111111", id: "wamid.echo1", type: "text", text: { body: "هلا، طلبك جاهز" } }] } }] }] };
  await handle(hook(echo), ENV, { fetch: w.f, ai });
  await handle(hook(echo), ENV, { fetch: w.f, ai }); // delivered twice → logged once
  assert.equal(w.msgs.filter((m) => m.wa_id === "wamid.echo1").length, 1);
  assert.equal(w.msgs[0].dir, "out"); assert.match(w.msgs[0].who, /جوال المحل/);
  assert.equal(w.threads.length, 1); assert.equal(w.threads[0].mode, "human"); assert.ok(w.threads[0].human_at);
  assert.equal(w.sent.length, 0); assert.equal(ai.calls.length, 0);
  await handle(hook(inbound("97333111111", "شكراً")), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, 0, "a person is handling the chat — no assistant reply"); assert.equal(w.sent.length, 0);
});

test("an unexpected error inside the function still answers JSON with CORS (not a network error in the browser)", async () => {
  const src2 = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "whatsapp-bot", "index.ts"), "utf8");
  assert.match(src2, /Deno\.serve\(async \(req\) => \{\s*try \{ return await handle/);
  const send = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "whatsapp-send", "index.ts"), "utf8");
  assert.match(send, /Deno\.serve\(async \(req\) => \{\s*try \{ return await handle/);
});

test("the request has no system-role message; the turn context rides in the last user message", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("هلا 👋")]);
  await handle(hook(inbound("97333111111", "هلا")), ENV, { fetch: w.f, ai });
  const msgs = ai.calls[0].messages;
  assert.ok(msgs.every((m) => m.role === "user" || m.role === "assistant"));
  const last = msgs[msgs.length - 1];
  assert.equal(last.role, "user");
  assert.match(last.content[0].text, /سياق من النظام/); assert.equal(last.content[1].text, "هلا");
  assert.equal(w.sent[0].text.body, "هلا 👋");
});

test("a 400 from the API is retried once without the fallback beta", async () => {
  const handle = await load(), w = world(), calls = [];
  const ai = { beta: { messages: { create: async (p) => { calls.push(p); if (p.betas) throw Object.assign(new Error("bad beta"), { status: 400 }); return text("تمام"); } } } };
  await handle(hook(inbound("97333111111", "هلا")), ENV, { fetch: w.f, ai });
  assert.equal(calls.length, 2); assert.ok(!calls[1].betas && !calls[1].fallbacks);
  assert.equal(w.sent[0].text.body, "تمام");
});

test("keys pasted with invisible characters (RLM, NBSP, zero-width, newline) are cleaned", async () => {
  const { cleanKey } = await import(tmp);
  assert.equal(cleanKey("‏sk-ant-api03-AbC_12 ​\n "), "sk-ant-api03-AbC_12");
  assert.equal(cleanKey(undefined), undefined);
});

test("first contact gets the language buttons once; later messages do not", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("هلا 👋")]);
  await handle(hook(inbound("97333111111", "هلا")), ENV, { fetch: w.f, ai });
  assert.equal(w.buttons.length, 1);
  const btns = w.buttons[0].interactive.action.buttons.map((b) => b.reply.title);
  assert.deepEqual(btns, ["العربية", "English"]);
  await handle(hook(inbound("97333111111", "كم سعر الثوب؟")), ENV, { fetch: w.f, ai });
  assert.equal(w.buttons.length, 1, "no buttons again for a known chat");
});

test("choosing English with the button reaches the assistant as the text 'English'", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("Hello! How can I help?")]);
  await handle(hook(inbound("97333111111", "", { type: "interactive", text: undefined, interactive: { type: "button_reply", button_reply: { id: "lang_en", title: "English" } } })), ENV, { fetch: w.f, ai });
  const last = ai.calls[0].messages[ai.calls[0].messages.length - 1];
  assert.equal(last.content[1].text, "English");
  assert.match(ai.calls[0].system[0].text, /English/);
});

test("two quick messages: only the newest one is answered (no duplicate replies)", async () => {
  const handle = await load(), w = world();
  let release; const gate = new Promise((r) => (release = r));
  let n2 = 0;
  const ai = { beta: { messages: { create: async () => { n2++; if (n2 === 1) await gate; return text("reply " + n2); } } } };
  const first = handle(hook(inbound("97333111111", "مرحبا")), ENV, { fetch: w.f, ai });
  await new Promise((r) => setTimeout(r, 10));
  await handle(hook(inbound("97333111111", "كم سعر الثوب")), ENV, { fetch: w.f, ai });
  release(); await first;
  assert.deepEqual(w.sent.map((x) => x.text.body), ["reply 2"]);
});

test("delivery of a ready order is filed for staff (not confirmed) and the chat is flagged", async () => {
  const handle = await load(), w = world();
  const ai = fakeAI([tool("request_delivery", { order_number: "00007", area: "الرفاع", address: "مجمع 901", day: "tomorrow", slot: "evening", notes: "" }), text("وصل طلب التوصيل للمحل والموظف بيأكد الموعد")]);
  await handle(hook(inbound("97333111111", "وصلوا لي طلبي بكرة المسا")), ENV, { fetch: w.f, ai });
  const note = w.msgs.find((m) => m.dir === "note");
  assert.match(note.body, /طلب توصيل للطلب #00007/); assert.match(note.body, /مجمع 901/);
  assert.equal(w.threads[0].flag, "pickup"); assert.equal(w.threads[0].waiting, true);
  assert.ok(!/تأكد|تم الحجز/.test(w.sent[0].text.body.replace("بيأكد", "")));
});

test("a 👍 reaction is not answered and not stored as a message", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("x")]);
  await handle(hook({ entry: [{ changes: [{ value: { contacts: [], messages: [{ from: "97333111111", id: "wamid.r1", type: "reaction", reaction: { message_id: "wamid.out1", emoji: "👍" } }] } }] }] }), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, 0); assert.equal(w.sent.length, 0); assert.equal(w.msgs.length, 0);
});

test("photos/videos: one fixed acknowledgement (no AI), the chat is flagged for staff, a second photo right after is not answered again", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("x")]);
  const media = (id) => ({ entry: [{ changes: [{ value: { contacts: [], messages: [{ from: "97333111111", id, type: "video", video: { id: "v" } }] } }] }] });
  await handle(hook(media("wamid.v1")), ENV, { fetch: w.f, ai });
  await handle(hook(media("wamid.v2")), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, 0);
  assert.equal(w.sent.length, 1); assert.match(w.sent[0].text.body, /الموظف بيشوفها/);
  assert.equal(w.threads[0].waiting, true); assert.equal(w.threads[0].flag, "media");
});

test("the assistant never sends a phone number (e.g. another customer's) — only the shop's own", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("حولت المحادثة للموظف وبيتأكد من الرقم 39458208 — وللتواصل: 39599902")]);
  w.recs.find((r) => r.collection === "profile").data.phone = "+97339599902";
  await handle(hook(inbound("97333111111", "طلبي على رقم 39458208")), ENV, { fetch: w.f, ai });
  const body = w.sent[0].text.body;
  assert.ok(!/39458208/.test(body), body); assert.match(body, /39599902/);
  assert.match(ai.calls[0].system[0].text, /لا تكتب أي رقم هاتف/);
});

test("one webhook with several changes: a staff echo and a customer message are both handled (assistant stays quiet)", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("x")]);
  const body = { entry: [{ changes: [
    { field: "smb_message_echoes", value: { message_echoes: [{ from: "15556463423", to: "97333111111", id: "wamid.e9", type: "text", text: { body: "هلا، معك الموظف" } }] } },
    { field: "messages", value: { contacts: [], messages: [{ from: "97333111111", id: "wamid.in9", type: "text", text: { body: "تمام شكراً" } }] } },
  ] }] };
  await handle(hook(body), ENV, { fetch: w.f, ai });
  assert.equal(w.threads[0].mode, "human"); assert.equal(ai.calls.length, 0); assert.equal(w.sent.length, 0);
  assert.equal(w.msgs.length, 2);
});

test("if the reply says «I transferred you» without using the hand-off tool, the chat is really handed to staff", async () => {
  const handle = await load(), w = world(), ai = fakeAI([text("تمام، حولتك للموظف وبيرد عليك هنا قريباً")]);
  await handle(hook(inbound("97333111111", "عندي سؤال عن بقعة")), ENV, { fetch: w.f, ai });
  assert.equal(w.threads[0].mode, "human"); assert.equal(w.threads[0].waiting, true); assert.equal(w.threads[0].flag, "human");
  assert.ok(w.msgs.some((m) => m.dir === "note" && /طلب التحدث مع موظف/.test(m.body)));
});

test("order status: a delivered order put on the customer's account is reported as on account (not «fully paid»), with the debt", async () => {
  const handle = await load(), w = world();
  w.recs.find((r) => r.record_id === "c1").data.balance = -0.5;
  w.recs.push({ shop_id: SHOP, deleted: false, collection: "orders", record_id: "o9", data: { id: "o9", number: "00001", customerId: "c1", status: "delivered", items: [{ qty: 2 }], payment: { total: 0.5, paid: 0, method: "unpaid" }, payLater: true, paymentConfirmed: true, createdAt: "2026-10-31T10:00:00Z" } });
  let result = null;
  const ai = fakeAI([tool("get_my_orders", {}), (p) => { result = JSON.parse(p.messages[p.messages.length - 1].content[0].content); return text("ok"); }]);
  await handle(hook(inbound("97333111111", "عندي ثياب وياكم؟")), ENV, { fetch: w.f, ai });
  const o9 = result.orders.find((o) => o.number === "00001");
  assert.match(o9.payment, /آجل/); assert.match(result.account_balance, /0\.500/);
  assert.match(ai.calls[0].system[0].text, /ويانا/);
});

test("handed to staff but nobody replied: quiet for 2 h, then the assistant answers again (apologising); after a staff reply it stays quiet 12 h", async () => {
  const handle = await load(), w = world();
  // handed over 3 hours ago, no staff reply since
  w.threads.push({ shop_id: SHOP, phone: "97333111111", mode: "human", human_at: new Date(Date.now() - 3 * 3600e3).toISOString(), waiting: true, flag: "human", unread: 0 });
  let ai = fakeAI([text("هلا! معذرة على التأخير، شلون أقدر أساعدك؟")]);
  await handle(hook(inbound("97333111111", "Hi")), ENV, { fetch: w.f, ai });
  assert.equal(ai.calls.length, 1); assert.equal(w.sent.length, 1);
  assert.match(ai.calls[0].messages[ai.calls[0].messages.length - 1].content[0].text, /ولم يرد بعد/);
  // handed over 30 minutes ago → still quiet
  const w2 = world(); w2.threads.push({ shop_id: SHOP, phone: "97333111111", mode: "human", human_at: new Date(Date.now() - 30 * 60e3).toISOString(), waiting: true, flag: "human", unread: 0 });
  ai = fakeAI([text("x")]);
  await handle(hook(inbound("97333111111", "Hi")), ENV, { fetch: w2.f, ai });
  assert.equal(ai.calls.length, 0);
  // staff replied 5 hours ago (after the hand-off) → quiet (12 h rule)
  const w3 = world(); const t5 = new Date(Date.now() - 5 * 3600e3).toISOString();
  w3.threads.push({ shop_id: SHOP, phone: "97333111111", mode: "human", human_at: t5, waiting: false, unread: 0 });
  w3.msgs.push({ id: 999, shop_id: SHOP, phone: "97333111111", dir: "out", who: "📱 جوال المحل", body: "هلا", at: t5, wa_id: "wamid.s1" });
  ai = fakeAI([text("x")]);
  await handle(hook(inbound("97333111111", "شكراً")), ENV, { fetch: w3.f, ai });
  assert.equal(ai.calls.length, 0);
});
