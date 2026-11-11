// 997 Laundry — WhatsApp AI assistant (Meta WhatsApp Cloud API webhook + Claude).
// Deploy: Supabase → Edge Functions → Deploy a new function → name: whatsapp-bot → paste this file → Deploy.
//         Then open the function's settings and turn OFF "Verify JWT" (Meta calls this URL without a Supabase login;
//         the function checks Meta's signature itself, and checks the shop login itself for staff actions).
// Secrets (Supabase → Edge Functions → Secrets):
//   WA_TOKEN, WA_PHONE_ID   same as whatsapp-send (Meta system-user token, Phone number ID)
//   WA_APP_SECRET           Meta app → App settings → Basic → App secret (verifies that a webhook really comes from Meta)
//   WA_VERIFY_TOKEN         any long random text you choose; type the same text in Meta → WhatsApp → Configuration → Webhook
//   ANTHROPIC_API_KEY       Claude API key (console.anthropic.com) — without it the assistant only routes to staff
//   WA_BOT_MODEL            optional, default claude-sonnet-5-5 (fast; claude-opus-5-5 for the strongest, claude-haiku-5-5 for the cheapest)
//   WA_BOT_EFFORT           optional, default low (short chat answers)
//   WA_SHOP_ID              optional — only if the project holds more than one shop
// Meta → WhatsApp → Configuration → Webhook: Callback URL = https://<project>.supabase.co/functions/v1/whatsapp-bot ,
//   Verify token = WA_VERIFY_TOKEN, then subscribe to the "messages" field.
// Needs supabase/whatsapp_bot.sql (conversation tables).
//
// What it does: answers customers in Bahraini Arabic / English from the shop's REAL data (prices, packages, delivery
// policy, the customer's own orders), books home-pickup REQUESTS (staff confirm them — the bot never confirms a booking
// itself), and hands the chat to a person on request ("ابي اكلم الموظف"): the bot then stays quiet and the staff reply
// from the system's WhatsApp page. Messages are kept for the inbox only and are visible to shop members only.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const bd = (n) => `${r3(n).toFixed(3)} د.ب`;
const HUMAN_HOURS = 12;          // a chat taken by staff goes back to the assistant after 12 h without staff replies
const HISTORY = 16;              // messages of context sent to the model
const SLOTS = { morning: "صباحاً 8–12", noon: "ظهراً 12–4", evening: "مساءً 4–8", night: "ليلاً 8–12" };

// ---- catalog names (generated from src/app.js by tools/build.js — do not edit by hand) ----
// @@CATALOG_START
const CATALOG = {"thob_cotton":["ثوب","Thobe"],"thob_wool":["ثوب صوف","Thobe Wool"],"ghatra":["غترة","Ghutra"],"agal":["عقال","Agal"],"abaya_plain":["عباية","Abaya"],"abaya_emb":["عباية مطرزة","Abaya Embroidered"],"shirt":["قميص","Shirt"],"tshirt":["تيشيرت","T-Shirt"],"pants_long":["بنطلون","Pant"],"pants_short":["بنطلون قصير","Half Pant"],"jacket":["جاكيت","Jacket"],"overcoat":["كوت","Coat"],"suit2pcs":["بدلة","Suit"],"dress":["فستان","Dress"],"dress_long":["فستان طويل / سهرة","Dress Long / Evening"],"blouse":["بلوزة","Blouse"],"miniskirt":["تنورة قصيرة","Mini Skirt"],"skirtlong":["تنورة","Skirt (Flat / Pleated)"],"pullover":["فانلة / سويتر","Pullover / Sweater"],"necktie":["ربطة عنق","Necktie"],"kurta_pyjama":["كورتا","Kurta"],"undershirt2pcs":["بدلة داخلية (طقم)","Under Shirt 2Pcs"],"underwear":["ملابس داخلية","Underwear"],"socks":["جوارب","Socks"],"cap":["طاقية","Cap"],"bedsheet_single":["شرشف","Bedsheet"],"bedsheet_double":["شرشف دبل","Double Bedsheet"],"bedcover":["غطاء (كفر)","Cover"],"bedspread":["غطاء سرير كبير (مفرش)","Bed Spread"],"blanket_single":["بطانية","Blanket"],"blanket_double":["بطانية دبل","Double Blanket"],"duvet":["لحاف","Comforter"],"pillowcase":["كيس مخدة","Pillow Cover"],"bathtowel":["منشفة كبيرة","Bath Towel"],"bathrobe":["روب حمام","Bath Robe"],"curtain_per_m":["ستارة (لكل متر)","Curtain (per m)"],"tablecloth":["مفرش طاولة","Table Cloth"],"tablecloth_large":["غطاء طاولة كبير","Table Cloth Large"],"bisht":["بشت","Bisht"],"dupatta":["دوباتا","Dupatta"],"gahfiya":["قحفية","Gahfiya"],"tshirt_half":["تي شيرت نص كم","Half T-Shirt"],"carpet_m2":["سجاد (للمتر)","Carpet (per m²)"],"shaila":["شيلة","Shaila"],"jalabiya":["جلابية","Jalabiya"],"bdf_uniform":["بدلة قوة الدفاع","BDF Uniform"],"hoodie_jacket":["جاكيت هودي","Hoodie Jacket"],"overcoat_long":["معطف","Overcoat"],"shoes":["حذاء","Shoes"],"small_towel":["منشفة صغيرة","Small Towel"]};
// @@CATALOG_END
const SERVICE_NAMES = { washiron: ["غسيل وكي", "Wash & Iron"], iron: ["كي", "Iron"], wash: ["غسيل", "Wash"], dryclean: ["غسيل جاف", "Dry clean"] };

/* ===================== Supabase (service role) ===================== */
function db(env, f) {
  const base = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = (extra) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(extra || {}) });
  const call = async (path, opt) => {
    const r = await f(`${base}/rest/v1/${path}`, { ...(opt || {}), headers: h(opt && opt.headers) });
    const t = await r.text();
    let body = null; try { body = t ? JSON.parse(t) : null; } catch (e) { body = t; }
    if (!r.ok) { const err = new Error(`db ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`.slice(0, 300)); err.status = r.status; throw err; }
    return body;
  };
  return {
    get: (path) => call(path),
    post: (path, body, prefer) => call(path, { method: "POST", body: JSON.stringify(body), headers: { Prefer: prefer || "return=representation" } }),
    patch: (path, body) => call(path, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=representation" } }),
  };
}
const enc = encodeURIComponent;

async function shopId(env, D) {
  if (env.WA_SHOP_ID) return env.WA_SHOP_ID;
  const rows = await D.get("shops?select=id&limit=1");
  return rows && rows[0] ? rows[0].id : null;
}
async function records(D, shop, collection, extra) {
  const rows = await D.get(`records?shop_id=eq.${shop}&collection=eq.${collection}&deleted=eq.false&select=record_id,data${extra || ""}`);
  return (rows || []).map((r) => r.data);
}
async function doc(D, shop, collection) { const d = await records(D, shop, collection, "&record_id=eq._"); return d[0] || {}; }

/* ===================== shop knowledge (from the real data) ===================== */
function pkgTrips(cp, dlv) {
  const n = cp && cp.dlvTrips !== undefined && cp.dlvTrips !== null && cp.dlvTrips !== "" ? Math.max(0, Math.floor(Number(cp.dlvTrips) || 0)) : dlv.pkgFree;
  return { n, period: cp && cp.dlvPeriod === "total" ? "total" : "month" };
}
function dlvCfg(settings) {
  const d = settings.delivery || {}, n = (v, def) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? def : Math.max(0, Number(v)));
  return { on: d.on !== false, fee: r3(n(d.fee, 0.5)), pkgFree: Math.floor(n(d.pkgFree, 4)), pkgFee: r3(n(d.pkgFee, 0.5)), freeOver: r3(n(d.freeOver, 0)) };
}
function botCfg(settings) {
  const b = settings.waBot || {};
  return { enabled: b.enabled === true, staffOn: b.staffOn !== false, from: b.staffFrom || "08:00", to: b.staffTo || "23:00", hours: b.hoursText || "مفتوح 24 ساعة", areas: b.areas || "", extra: b.extra || "" };
}
function bhNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "long", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`, weekday: p.weekday };
}
function staffAvailable(cfg) {
  if (!cfg.staffOn) return false;
  const t = bhNow().time, a = cfg.from, b = cfg.to;
  return a <= b ? t >= a && t < b : t >= a || t < b; // overnight ranges such as 20:00–02:00
}
function knowledge(settings, profile, garments) {
  const prices = settings.prices || {}, active = settings.garmentActive || {}, svcOn = settings.serviceActive || {};
  const on = (s) => (svcOn[s] !== undefined ? svcOn[s] !== false : s !== "wash");
  const names = { ...CATALOG };
  (garments || []).forEach((g) => { if (g && g.id) names[g.id] = [g.name || g.id, g.nameEn || g.name || g.id]; });
  const lines = [];
  Object.keys(names).forEach((id) => {
    if (active[id] === false) return;
    const ps = ["washiron", "iron", "wash", "dryclean"].filter((s) => on(s) && Number(prices[`${id}_${s}`]) > 0).map((s) => `${SERVICE_NAMES[s][0]} ${bd(prices[`${id}_${s}`])}`);
    if (ps.length) lines.push(`- ${names[id][0]} (${names[id][1]}): ${ps.join(" · ")}`);
  });
  const dlv = dlvCfg(settings), w = settings.packageWeights || {};
  const heavy = Object.entries(w).filter(([, v]) => v && typeof v === "object" && Number(v.washiron) !== 1).map(([id, v]) => `${(names[id] || [id])[0]}: ${Number(v.washiron) === 0 ? "خارج الباقات" : `= ${v.washiron} قطع`}${v.iron !== undefined && Number(v.iron) !== Number(v.washiron) ? ` (كوي فقط = ${v.iron})` : ""}`);
  const pk = (settings.packageDefs || []).map((p) => {
    const t = pkgTrips(p, dlv), svc = (SERVICE_NAMES[p.serviceType] || [p.serviceType])[0];
    return `- ${p.name}: ${svc}، ${p.pieceCount} قطعة بـ ${bd(p.price)} (${bd(p.price / p.pieceCount)} للقطعة)، ${Number(p.validDays) > 0 ? `صالحة ${p.validDays} يوم` : "بدون تاريخ انتهاء"}، ${t.n > 0 ? `${t.n} مشاوير استلام/توصيل مجانية ${t.period === "total" ? "للباقة كاملة" : "كل شهر"}` : "بدون مشاوير مجانية"}${p.bonus ? `، هدية: ${p.bonus}` : ""}`;
  });
  const extras = Object.entries(settings.extras || {}).filter(([, c]) => Number(c && c.price) > 0).map(([id, c]) => `${id === "perfume" ? "تعطير" : id === "wrap" ? "تغليف" : id} ${bd(c.price)} ${c.per === "piece" ? "للقطعة" : "للطلب"}`);
  const cfg = botCfg(settings);
  return [
    `اسم المحل: ${profile.nameAr || "مغسلة 997"} (${profile.nameEn || "997 Laundry"})`,
    `العنوان: ${[profile.region, profile.address].filter(Boolean).join(" — ") || "الرفاع، البحرين"}`,
    `ساعات العمل: ${cfg.hours}`,
    profile.phone ? `هاتف المحل: ${profile.phone}` : "",
    `الدفع: نقداً، بطاقة، Benefit Pay، تحويل بنكي`,
    `مدة التجهيز العادية: ${settings.normalHours || 24} ساعة — المستعجل: ${settings.urgentHours || 6} ساعات (رسوم إضافية حسب الصنف)`,
    `\nالأسعار (د.ب للقطعة):\n${lines.join("\n") || "- (لا توجد أسعار مسجلة)"}`,
    `\nالباقات المسبقة الدفع:\n${pk.join("\n") || "- لا توجد باقات حالياً"}`,
    heavy.length ? `أوزان القطع في الباقات: ${heavy.join("، ")}. الأصناف الأخرى = قطعة واحدة.` : "",
    extras.length ? `خدمات إضافية: ${extras.join("، ")}` : "",
    `\nالاستلام والتوصيل: ${dlv.on ? `متوفر. عميل بدون باقة: ${bd(dlv.fee)} للمشوار. عميل الباقة: مشاوير مجانية حسب باقته ثم ${bd(dlv.pkgFee)}.${dlv.freeOver > 0 ? ` مجاني للطلب من ${bd(dlv.freeOver)}.` : ""} أوقات الاستلام: صباحاً 8–12، ظهراً 12–4، مساءً 4–8، ليلاً 8–12.` : "غير متوفر حالياً."}`,
    cfg.areas ? `مناطق التوصيل: ${cfg.areas}` : "مناطق التوصيل: غير محددة في النظام — الموظف يؤكد التغطية عند تأكيد الموعد.",
    cfg.extra ? `\nمعلومات إضافية من المالك:\n${cfg.extra}` : "",
  ].filter(Boolean).join("\n");
}

const RULES = `أنت المساعد الافتراضي لمغسلة على واتساب. تتكلم باللهجة البحرينية الخليجية بأسلوب ودود ومحترم ومختصر، وبالإنجليزية إذا كتب العميل بالإنجليزية، وتفهم الفصحى والاختصارات والأخطاء الإملائية.

قواعد ثابتة:
1) لا تخترع أي معلومة. استخدم فقط «بيانات المحل» أدناه ونتائج الأدوات. إذا سُئلت عن خدمة أو سعر غير موجود (مثل الغسيل بالبخار أو الملابس الحساسة إن لم تُذكر) قل إنك تتأكد من الموظف، واعرض التحويل للموظف أو ترك رسالة.
2) الردود قصيرة: 1–6 أسطر. للأسعار استخدم قائمة نقطية مختصرة بالأصناف التي سأل عنها فقط. رمز تعبيري أو اثنين كحد أقصى. لا تكرر التحية في كل رسالة — حيّ العميل في أول رد فقط.
3) اسأل عن المعلومة الناقصة واحدة واحدة وبشكل طبيعي.
4) حجز الاستلام من البيت: اجمع الاسم (إذا لم يكن معروفاً)، المنطقة، العنوان أو رابط الموقع، اليوم، الوقت (صباحاً/ظهراً/مساءً/ليلاً)، وهل يريد التوصيل بعد التنظيف. لخّص الطلب واسأل العميل «أأكد الطلب؟». بعد موافقته فقط استخدم أداة request_pickup. بعدها قل إن الطلب وصل للمحل وإن الموظف سيؤكد الموعد قريباً — لا تقل أبداً إن الموعد «تأكد» أو «تم الحجز» لأن التأكيد من الموظف.
5) حالة الطلب أو رصيد الباقة: استخدم get_my_orders أو get_my_packages. هذه الأدوات تعرض بيانات صاحب هذا الرقم فقط. لا تذكر أبداً بيانات أي عميل آخر، ولا أكواد الخصم، ولا أرقام هواتف أو عناوين غير عنوان العميل نفسه.
6) إذا طلب العميل التحدث مع شخص (مثل: ابي اكلم العامل/الموظف، حولني لموظف، أريد شخص، human, agent) أو كان غاضباً أو عنده مشكلة لا تحلها البيانات: استخدم request_human فوراً. إذا أعادت الأداة أن الموظف متاح، قل إنك حولت المحادثة وإن الموظف سيرد هنا قريباً. إذا أعادت أنه غير متاح، قل ذلك بصراحة واعرض عليه ترك رسالة أو طلب اتصال (leave_message). لا تدّعِ أبداً أن التحويل تم إذا لم يتم.
7) الشكاوى والملاحظات: اعتذر باختصار، اجمع التفاصيل (رقم الطلب إن وجد)، ثم استخدم submit_feedback، وقل إن الإدارة ستتابع.
8) لا تؤكد أسعاراً نهائية لطلب لم يُستلم بعد؛ السعر النهائي يُحسب في المحل حسب القطع الفعلية.
9) رسائل الصوت والصور: قل إنك تستقبل النص فقط، واطلب كتابة الطلب أو عرض التحويل للموظف.
10) اللغة: إذا اختار العميل «العربية» أو «English» (زر أو كتابة) أو كتب «عربي / Arabic / English / انجليزي»، التزم بهذه اللغة في كل الردود حتى يغيّرها. بالإنجليزية اكتب إنجليزية واضحة وودودة، وأسماء الأصناف بالإنجليزية من بيانات المحل، والعملة BHD.
11) القائمة: إذا كانت رسالة العميل تحية فقط أو اختيار لغة أو «قائمة / menu / مساعدة»، رحّب واعرض باختصار ما تقدر تساعد فيه بأسطر مرقمة: 1 الأسعار والخدمات · 2 الباقات · 3 حجز استلام من البيت · 4 توصيل طلب جاهز · 5 حالة طلبي · 6 شكوى أو ملاحظة · 7 التحدث مع موظف. وإذا كتب رقماً من القائمة فنفّذ ما يقابله.
14) أنت تتكلم باسم المحل بصيغة «نحن»: قل «عندك ثياب ويانا / عندنا / نستلم / بنرد عليك» — لا تقل أبداً «وياهم / عندهم / المحل عندهم» كأنك شخص خارج المحل. «الموظف» شخص من فريقنا.
15) الدفع: اعتمد على نتيجة get_my_orders كما هي — «مدفوع» أو «آجل على الحساب» أو «غير مدفوع». إذا كان على العميل دين في account_balance اذكره بلطف. لا تقل «مدفوع بالكامل» إلا إذا كانت النتيجة «مدفوع» ولا يوجد دين.
13) أرقام الهواتف: لا تكتب أي رقم هاتف في ردك أبداً — لا رقم العميل ولا رقماً كتبه العميل ولا أي رقم آخر (رقم المحل فقط إذا سأل عنه). إذا طلب العميل التحقق من طلب برقم آخر أو باسم شخص آخر: لا تستطيع ذلك لحماية خصوصية العملاء — حوّل للموظف بـ request_human واكتب الرقم في سبب التحويل فقط، وقل للعميل «وصلت المعلومة للموظف وبيتأكد لك» بدون ذكر الرقم.
12) توصيل طلب جاهز إلى البيت: تحقق بـ get_my_orders، ثم اجمع المنطقة والعنوان واليوم والوقت، لخّص واطلب الموافقة، ثم استخدم request_delivery. قل إن الطلب وصل للمحل والموظف يؤكد الموعد — لا تقل إنه تأكد.`;

/* ===================== tools ===================== */
const TOOLS = [
  { name: "get_my_orders", description: "Orders of THIS customer (the sender's phone number only): number, status, pieces, amount still owed, delivery status. Use for 'وين طلبي', 'جاهز؟', order status questions.", strict: true, input_schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "get_my_packages", description: "THIS customer's active prepaid packages: pieces left, expiry, free delivery trips left.", strict: true, input_schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "request_pickup", description: "Send a home-pickup REQUEST to the shop after the customer agreed to the summary. The shop staff confirm it; it is not confirmed yet.", strict: true, input_schema: { type: "object", additionalProperties: false, required: ["customer_name", "area", "address", "day", "slot", "deliver_back", "notes"], properties: {
    customer_name: { type: "string", description: "Customer's name ('' if already known)" },
    area: { type: "string" }, address: { type: "string", description: "Block/road/house or a map link" },
    day: { type: "string", description: "today | tomorrow | YYYY-MM-DD" },
    slot: { type: "string", enum: ["morning", "noon", "evening", "night"] },
    deliver_back: { type: "boolean", description: "Deliver back home after cleaning" },
    notes: { type: "string", description: "Items or instructions ('' if none)" } } } },
  { name: "request_delivery", description: "Ask the shop to deliver an existing (ready) order to the customer's home, after the customer agreed to the summary. Staff confirm it; it is not confirmed yet.", strict: true, input_schema: { type: "object", additionalProperties: false, required: ["order_number", "area", "address", "day", "slot", "notes"], properties: {
    order_number: { type: "string", description: "Order number from get_my_orders ('' if the customer does not know it)" },
    area: { type: "string" }, address: { type: "string", description: "Block/road/house or a map link" },
    day: { type: "string", description: "today | tomorrow | YYYY-MM-DD" },
    slot: { type: "string", enum: ["morning", "noon", "evening", "night"] },
    notes: { type: "string", description: "'' if none" } } } },
  { name: "request_human", description: "The customer wants a person (worker/staff) or has an issue you cannot solve. Hands the chat to staff if available; returns whether staff are available now.", strict: true, input_schema: { type: "object", additionalProperties: false, required: ["reason"], properties: { reason: { type: "string" } } } },
  { name: "leave_message", description: "Leave a message for staff / ask for a call back (when staff are not available or the customer prefers).", strict: true, input_schema: { type: "object", additionalProperties: false, required: ["message", "callback"], properties: { message: { type: "string" }, callback: { type: "boolean" } } } },
  { name: "submit_feedback", description: "Record a complaint, suggestion or praise for the management.", strict: true, input_schema: { type: "object", additionalProperties: false, required: ["kind", "message", "order_number"], properties: { kind: { type: "string", enum: ["complaint", "suggestion", "praise"] }, message: { type: "string" }, order_number: { type: "string", description: "'' if none" } } } },
];
const STATUS_AR = { received: "قيد التنظيف", ready: "جاهز للاستلام", delivered: "تم التسليم", cancelled: "ملغي" };
const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const addDays = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const owed = (o) => { const p = o.payment || {}; return o.status === "cancelled" ? 0 : r3(Math.max(0, (Number(p.total) || 0) - (Number(p.paid) || 0) - (Number(p.balanceUse) || 0))); };

async function runTool(name, input, ctx) {
  const { D, shop, phone, cust, thread, settings } = ctx;
  if (name === "get_my_orders") {
    if (!cust) return { found: false, note: "No customer file with this phone number." };
    const os = (await records(D, shop, "orders", `&data->>customerId=eq.${enc(cust.id)}&order=updated_at.desc&limit=8`)).filter((o) => o.status !== "cancelled").slice(0, 5);
    const bal = r3(Number(cust.balance) || 0);
    return { found: true, account_balance: bal < 0 ? `على العميل ${bd(-bal)} (دين)` : bal > 0 ? `للعميل رصيد ${bd(bal)}` : "لا شيء", orders: os.map((o) => ({ number: o.number, status: STATUS_AR[o.status] || o.status, pieces: (o.items || []).reduce((a, it) => a + (Number(it.qty) || 0), 0), total: bd((o.payment || {}).total), payment: !o.paymentConfirmed ? `غير مدفوع بعد — المطلوب ${bd(owed(o))}` : ((o.payment || {}).method === "unpaid" || o.payLater) ? "سُلّم على الحساب (آجل) — يُسدَّد من رصيد الحساب" : "مدفوع", created: String(o.createdAt || "").slice(0, 10), home_delivery: o.delivery && o.delivery.drop ? ({ pending: "بانتظار التجهيز", onway: "خرج للتوصيل", done: "وُصّل" })[o.delivery.dropStatus || "pending"] : "لا" })) };
  }
  if (name === "get_my_packages") {
    if (!cust) return { found: false };
    const today = bhNow().date, dlv = dlvCfg(settings);
    const pk = (await records(D, shop, "customer_packages", `&data->>customerId=eq.${enc(cust.id)}`)).filter((p) => Number(p.remainingPieces) > 0 && (!p.expiresAt || p.expiresAt >= today));
    return { found: true, packages: pk.map((p) => ({ name: p.name, pieces_left: p.remainingPieces, of: p.totalPieces, expires: p.expiresAt || "بدون تاريخ انتهاء", free_trips: (() => { const t = pkgTrips(p, dlv); return t.n > 0 ? `${t.n} ${t.period === "total" ? "للباقة كاملة" : "كل شهر"}` : "لا يوجد"; })() })) };
  }
  if (name === "request_pickup") {
    const today = bhNow().date;
    const day = input.day === "today" ? today : input.day === "tomorrow" ? addDays(today, 1) : /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : "";
    if (!day || day < today) return { ok: false, error: "Ask for a valid day (today, tomorrow or a date)." };
    if (!String(input.address || "").trim() && !String(input.area || "").trim()) return { ok: false, error: "Ask for the address." };
    let c = cust;
    if (!c) {
      const name = String(input.customer_name || "").trim() || thread.name || "";
      if (!name) return { ok: false, error: "Ask for the customer's name first." };
      c = { id: uid(), name, phone, area: input.area || "", address: input.address || "", notes: "أُضيف عبر واتساب", balance: 0, openingBalance: 0, createdAt: new Date().toISOString(), source: "whatsapp" };
      await D.post("records", { shop_id: shop, collection: "customers", record_id: c.id, data: c }, "return=minimal");
      ctx.cust = c;
    }
    const now = new Date().toISOString(), id = uid();
    const req = { id, kind: "pickup", source: "whatsapp", needsConfirm: true, customerId: c.id, customerName: c.name, address: [input.area, input.address].filter((x) => String(x || "").trim()).join(" — "), date: day, slot: input.slot, drop: !!input.deliver_back, notes: input.notes || "", status: "new", items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: "WhatsApp" };
    await D.post("records", { shop_id: shop, collection: "suspended_orders", record_id: id, data: req }, "return=minimal");
    ctx.flag = "pickup";
    return { ok: true, status: "REQUEST SENT — waiting for staff confirmation (not confirmed yet)", day, slot: SLOTS[input.slot] };
  }
  if (name === "request_delivery") {
    const today = bhNow().date;
    const day = input.day === "today" ? today : input.day === "tomorrow" ? addDays(today, 1) : /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : "";
    if (!day || day < today) return { ok: false, error: "Ask for a valid day (today, tomorrow or a date)." };
    if (!String(input.address || "").trim() && !String(input.area || "").trim()) return { ok: false, error: "Ask for the address." };
    ctx.flag = "pickup";
    ctx.patch = { ...(ctx.patch || {}), waiting: true };
    ctx.note = `🚚 طلب توصيل${input.order_number ? ` للطلب #${input.order_number}` : ""} — ${[input.area, input.address].filter((x) => String(x || "").trim()).join(" — ")} — ${day} ${SLOTS[input.slot] || input.slot}${input.notes ? ` — ${input.notes}` : ""}`;
    return { ok: true, status: "DELIVERY REQUEST SENT — waiting for staff confirmation (not confirmed yet)", day, slot: SLOTS[input.slot] };
  }
  if (name === "request_human") {
    const avail = staffAvailable(botCfg(settings));
    ctx.patch = { ...(ctx.patch || {}), waiting: true, flag: "human", ...(avail ? { mode: "human", human_at: new Date().toISOString() } : {}) };
    ctx.note = `🙋 طلب التحدث مع موظف: ${input.reason || ""}`;
    return avail ? { transferred: true, note: "Staff notified; the assistant stops replying in this chat." } : { transferred: false, staff_available: false, hours: `${botCfg(settings).from}–${botCfg(settings).to}`, note: "Staff are not available now. Offer to leave a message or a call back." };
  }
  if (name === "leave_message") {
    ctx.patch = { ...(ctx.patch || {}), waiting: true, flag: "callback" };
    ctx.note = `✉️ رسالة للموظف${input.callback ? " (يطلب اتصال)" : ""}: ${input.message}`;
    return { saved: true };
  }
  if (name === "submit_feedback") {
    ctx.patch = { ...(ctx.patch || {}), waiting: true, flag: input.kind === "complaint" ? "complaint" : "callback" };
    ctx.note = `${input.kind === "complaint" ? "⚠️ شكوى" : input.kind === "praise" ? "🌟 شكر" : "💡 اقتراح"}${input.order_number ? ` (طلب #${input.order_number})` : ""}: ${input.message}`;
    return { saved: true };
  }
  return { error: "unknown tool" };
}

/* ===================== Claude ===================== */
async function askClaude(ai, env, system, messages, ctx) {
  const model = env.WA_BOT_MODEL || "claude-sonnet-5-5";
  const base = { model, max_tokens: 2048, system, tools: TOOLS, output_config: { effort: env.WA_BOT_EFFORT || "low" } };
  const fallback = /^claude-(opus|fable|sonnet)/.test(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
  for (let i = 0; i < 5; i++) {
    let res;
    try { res = await ai.beta.messages.create({ ...base, ...fallback, messages }); }
    catch (e) {
      if (!(e && e.status === 400 && fallback.betas)) throw e;
      // a 400 tied to the optional fallback beta: retry once as a plain request
      console.error("claude 400, retry without fallback", e && e.message);
      res = await ai.beta.messages.create({ ...base, messages });
    }
    if (res.stop_reason === "refusal") return { text: "", refusal: true };
    if (res.stop_reason !== "tool_use") return { text: res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() };
    messages.push({ role: "assistant", content: res.content });
    const results = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      let out;
      try { out = await runTool(b.name, b.input || {}, ctx); } catch (e) { out = { error: "temporary problem — offer to pass the message to staff" }; console.error("tool", b.name, e && e.message); }
      results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out), ...(out && out.error ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "" };
}

/* ===================== WhatsApp ===================== */
async function waText(env, f, to, body) {
  const r = await f(`https://graph.facebook.com/${env.WA_API_VERSION || "v21.0"}/${env.WA_PHONE_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${env.WA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: String(body).slice(0, 4000) } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `send ${r.status}`); e.status = r.status; throw e; }
  return j.messages && j.messages[0] ? j.messages[0].id : null;
}
async function waButtons(env, f, to, body, buttons) {
  const r = await f(`https://graph.facebook.com/${env.WA_API_VERSION || "v21.0"}/${env.WA_PHONE_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${env.WA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: buttons.map(([id, title]) => ({ type: "reply", reply: { id, title } })) } } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `send ${r.status}`); e.status = r.status; throw e; }
  return j.messages && j.messages[0] ? j.messages[0].id : null;
}
async function verifySig(env, raw, header) {
  if (!env.WA_APP_SECRET || !header || !header.startsWith("sha256=")) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.WA_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(raw)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const got = header.slice(7);
  if (got.length !== hex.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
const NO_AI = "هلا والله 🌸 وصلتنا رسالتك، والموظف بيرد عليك هنا بأقرب وقت.\nHello! We received your message — our team will reply here shortly.";
const HANDOFF_WORDS = /(اكلم|أكلم|كلم|تواصل|أتواصل|اتواصل)\s*(مع)?\s*(ال)?(عامل|موظف|شخص|انسان|إنسان|احد|أحد)|حول(ني)?\s*(لل|ل|على|إلى|الى)?\s*(ال)?(موظف|عامل)|موظف\s*لو\s*سمحت|\b(human|agent|real person|talk to (a )?(person|human|staff))\b/i;

async function handleInbound(env, deps, payload) {
  const values = [];
  ((payload && payload.entry) || []).forEach((en) => ((en && en.changes) || []).forEach((ch) => { if (ch && ch.value) values.push(ch.value); }));
  for (const value of values) await handleValue(env, deps, value);
}
// never send a phone number the customer did not ask for (another customer's number, a number they typed…): only the shop's own
function scrubPhones(text, allowed) {
  const ok = new Set((allowed || []).map((x) => String(x || "").replace(/\D/g, "")).filter(Boolean).flatMap((d) => [d, d.replace(/^973/, "")]));
  return String(text).replace(/\+?\d[\d\s-]{6,}\d/g, (m) => { const d = m.replace(/\D/g, ""); return d.length < 8 || ok.has(d) || ok.has(d.replace(/^973/, "")) ? m : "(الرقم)"; });
}
async function handleValue(env, deps, value) {
  const f = deps.fetch || fetch, D = db(env, f);
  const shop = await shopId(env, D);
  if (!shop) return;
  // coexistence: a staff member answered from the WhatsApp Business app on the shop phone →
  // log it in the chat and let the person handle it (the assistant stays quiet for HUMAN_HOURS)
  if (value && Array.isArray(value.message_echoes)) {
    for (const m of value.message_echoes) {
      const phone = String(m.to || "").replace(/\D/g, "");
      if (!/^\d{8,15}$/.test(phone)) continue;
      const text = (m.type === "text" ? (m.text && m.text.body) || "" : `[${m.type || "رسالة"}]`).slice(0, 4000);
      try { await D.post("wa_messages?on_conflict=wa_id", { shop_id: shop, phone, dir: "out", who: "📱 جوال المحل", body: text, wa_id: m.id || null }, "return=minimal"); }
      catch (e) { if (e.status === 409) continue; throw e; } // already logged (e.g. the assistant's own reply)
      const now = new Date().toISOString();
      const patch = { last_text: text.slice(0, 200), last_at: now, unread: 0, waiting: false, mode: "human", human_at: now };
      const ex = (await D.get(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}&limit=1`))[0];
      if (ex) await D.patch(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}`, patch);
      else await D.post("wa_threads", { shop_id: shop, phone, ...patch }, "return=minimal");
    }
    return;
  }
  if (!value || !Array.isArray(value.messages)) return; // delivery/read statuses: nothing to do
  const contact = (value.contacts || [])[0] || {};
  const [settings, profile, garments] = await Promise.all([doc(D, shop, "settings"), doc(D, shop, "profile"), records(D, shop, "custom_garments")]);
  const cfg = botCfg(settings);
  for (const m of value.messages) {
    const phone = String(m.from || "").replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(phone)) continue;
    if (m.type === "reaction" || m.type === "system" || m.type === "ephemeral" || m.type === "request_welcome") continue; // 👍 on a message, number change… — nothing to answer
    let text = m.type === "text" ? (m.text && m.text.body) || "" : m.type === "button" ? (m.button && m.button.text) || "" : m.type === "interactive" ? ((m.interactive.button_reply || m.interactive.list_reply || {}).title || "") : m.type === "location" ? `📍 موقعي: https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}${m.location.address ? " — " + m.location.address : ""}` : "";
    const media = !text;
    if (media) text = `[${m.type === "audio" ? "رسالة صوتية" : m.type === "image" ? "صورة" : m.type === "video" ? "فيديو" : m.type === "document" ? "ملف" : "رسالة غير نصية"}]`;
    // dedupe (Meta may deliver the same message twice)
    try { await D.post("wa_messages?on_conflict=wa_id", { shop_id: shop, phone, dir: "in", who: "customer", body: text.slice(0, 4000), wa_id: m.id || null }, "return=minimal"); }
    catch (e) { if (e.status === 409) continue; throw e; }
    const custs = await records(D, shop, "customers", `&data->>phone=eq.${phone}&limit=1`);
    const cust = custs[0] || null;
    const ex = (await D.get(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}&limit=1`))[0];
    const now = new Date().toISOString();
    let thread = ex;
    if (!ex) thread = (await D.post("wa_threads", { shop_id: shop, phone, name: (contact.profile && contact.profile.name) || (cust && cust.name) || null, customer_id: cust ? cust.id : null, last_text: text.slice(0, 200), last_at: now, unread: 1, ...(media ? { flag: "media", waiting: true } : {}) }))[0];
    else thread = (await D.patch(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}`, { last_text: text.slice(0, 200), last_at: now, unread: (ex.unread || 0) + 1, ...(ex.mode === "human" ? { waiting: true } : {}), ...(cust && !ex.customer_id ? { customer_id: cust.id } : {}), ...(media && ex.mode !== "human" ? { flag: "media", waiting: true } : {}) }))[0];
    // read receipt (blue ticks) — best effort
    if (m.id && env.WA_TOKEN && env.WA_PHONE_ID) f(`https://graph.facebook.com/${env.WA_API_VERSION || "v21.0"}/${env.WA_PHONE_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${env.WA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: m.id }) }).catch(() => {});

    if (!cfg.enabled) continue; // assistant switched off in the system: staff answer from the WhatsApp page
    if (thread.mode === "human") {
      const fresh = thread.human_at && Date.now() - new Date(thread.human_at).getTime() < HUMAN_HOURS * 3600e3;
      const backToBot = /^(بوت|المساعد|الرد الآلي|bot)$/i.test(text.trim());
      if (fresh && !backToBot) continue; // a person is handling this chat — the assistant stays quiet
      await D.patch(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}`, { mode: "bot" }); // staff silent for 12 h → assistant again
    }
    const ctx = { D, shop, phone, cust, thread, settings, patch: null, note: null, flag: null };
    let reply = "";
    if (media) {
      ctx.patch = { waiting: true, flag: "media" };
      // one acknowledgement per burst of photos/voice notes (marked with a zero-width space), not one per file
      const outs = await D.get(`wa_messages?shop_id=eq.${shop}&phone=eq.${phone}&dir=eq.out&order=at.desc&limit=4`).catch(() => []);
      const recent = (outs || []).some((o) => o.who === "bot" && String(o.body || "").endsWith("\u200b") && Date.now() - new Date(o.at).getTime() < 15 * 60e3);
      if (!recent) reply = (staffAvailable(cfg)
        ? "وصلتنا رسالتك 👍 الموظف بيشوفها ويرد عليك هنا قريباً.\nGot it 👍 our team will check it and reply here shortly."
        : `وصلتنا رسالتك 👍 الموظف بيشوفها ويرد عليك أول ما يتوفر (الدوام ${cfg.from}–${cfg.to}).\nGot it 👍 our team will reply as soon as they're available.`) + "\u200b";
    } else if (!deps.ai) {
      // no Claude key: never pretend — route to staff
      ctx.patch = { waiting: true, flag: "human" };
      reply = ex ? "" : NO_AI;
      if (HANDOFF_WORDS.test(text)) reply = staffAvailable(cfg) ? "تم 👍 حولتك للموظف، بيرد عليك هنا بأقرب وقت." : `الموظف مو متوفر الحين (الدوام ${cfg.from}–${cfg.to}). خل رسالتك هنا وبنرد عليك أول ما يتوفر 🙏`;
    } else {
      const hist = (await D.get(`wa_messages?shop_id=eq.${shop}&phone=eq.${phone}&dir=neq.note&order=at.desc&limit=${HISTORY}`)).reverse();
      const msgs = [];
      hist.forEach((h) => {
        const role = h.dir === "in" ? "user" : "assistant";
        const content = h.dir === "out" && h.who && h.who !== "bot" ? `(رد الموظف ${h.who}): ${h.body}` : h.body;
        if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += "\n" + content;
        else msgs.push({ role, content });
      });
      while (msgs.length && msgs[0].role !== "user") msgs.shift();
      const n0 = bhNow();
      const who = cust ? `العميل مسجّل: ${cust.name}${cust.area ? " — " + cust.area : ""}${cust.address ? " — " + cust.address : ""}.` : `عميل جديد غير مسجّل${thread && thread.name ? ` (اسمه في واتساب: ${thread.name})` : ""}.`;
      // context for this turn rides inside the customer's last message (works on every model; no system-role message)
      const ctxText = `[سياق من النظام — ليس من العميل] الآن: ${n0.weekday} ${n0.date} الساعة ${n0.time} (البحرين). ${who} الموظفون ${staffAvailable(cfg) ? "متاحون الآن" : `غير متاحين الآن (الدوام ${cfg.from}–${cfg.to})`}.${media ? " آخر رسالة من العميل ليست نصاً." : ""}`;
      const last = msgs[msgs.length - 1];
      if (last && last.role === "user") last.content = [{ type: "text", text: ctxText }, ...(typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content)];
      else msgs.push({ role: "user", content: ctxText });
      const system = [{ type: "text", text: RULES }, { type: "text", text: `بيانات المحل (المصدر الوحيد للأسعار والخدمات):\n${knowledge(settings, profile, garments)}`, cache_control: { type: "ephemeral" } }];
      try {
        const out = await askClaude(deps.ai, env, system, msgs, ctx);
        reply = out.text || (out.refusal ? "عذراً، ما أقدر أساعد في هذا الطلب. تبي أحولك للموظف؟" : "");
        // the reply says the chat was handed to staff but the hand-off tool was not used: make it true (never a false promise)
        if (reply && !(ctx.patch && ctx.patch.flag) && /حوّلت|حولت|حولتك|حوّلتك|بلغت الموظف|بلّغت الموظف|transferred|handed (your|the) (chat|conversation)|passed (it|your (details|message|request)) (on )?to (our |a )?(staff|team)/i.test(reply)) {
          await runTool("request_human", { reason: `تحويل تلقائي — رد المساعد ذكر التحويل: ${text.slice(0, 160)}` }, ctx);
        }
      } catch (e) {
        const why = `${(e && e.status) || ""} ${(e && e.message) || e}`.trim().slice(0, 400);
        console.error("claude", why);
        ctx.note = `${ctx.note ? ctx.note + "\n" : ""}⚠️ تعذّر رد المساعد الذكي (Claude): ${why}`;
        ctx.patch = { ...(ctx.patch || {}), waiting: true, flag: "human" };
        reply = "عذراً، صار عندي خلل بسيط 🙏 بلغت الموظف وبيرد عليك هنا.";
      }
    }
    if (ctx.note) await D.post("wa_messages", { shop_id: shop, phone, dir: "note", who: "system", body: ctx.note.slice(0, 4000) }, "return=minimal");
    if (ctx.patch || ctx.flag) await D.patch(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}`, { ...(ctx.flag ? { flag: ctx.flag, waiting: true } : {}), ...(ctx.patch || {}), ...(ctx.cust && !thread.customer_id ? { customer_id: ctx.cust.id } : {}) });
    // the customer sent another message while this answer was being written: let that newer turn answer everything at once
    if (reply) reply = scrubPhones(reply, [profile && profile.phone, profile && profile.whatsapp]);
    if (reply && m.id && deps.ai) {
      const latest = (await D.get(`wa_messages?shop_id=eq.${shop}&phone=eq.${phone}&dir=eq.in&order=at.desc&limit=1`).catch(() => []))[0];
      if (latest && latest.wa_id && latest.wa_id !== m.id) reply = "";
    }
    if (reply && env.WA_TOKEN && env.WA_PHONE_ID) {
      try {
        const wid = await waText(env, f, phone, reply);
        await D.post("wa_messages", { shop_id: shop, phone, dir: "out", who: "bot", body: reply.slice(0, 4000), wa_id: wid }, "return=minimal");
        // first contact: offer the language choice as two buttons
        if (!ex && deps.ai) {
          try {
            const bid = await waButtons(env, f, phone, "🌐 تبي نكمل بأي لغة؟\nWhich language would you like?", [["lang_ar", "العربية"], ["lang_en", "English"]]);
            await D.post("wa_messages", { shop_id: shop, phone, dir: "out", who: "bot", body: "🌐 العربية / English", wa_id: bid }, "return=minimal");
          } catch (e) { console.error("buttons", e && e.message); }
        }
      } catch (e) { console.error("send", e && e.message); await D.post("wa_messages", { shop_id: shop, phone, dir: "note", who: "system", body: `⚠️ تعذّر إرسال رد المساعد: ${(e && e.message) || ""}`.slice(0, 500) }, "return=minimal"); }
    }
  }
}

/* ===================== staff actions from the system (signed-in shop members) ===================== */
async function member(env, f, req) {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  const u = await f(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: auth } });
  if (!u.ok) return null;
  const user = await u.json().catch(() => null);
  if (!user || !user.id) return null;
  const rows = await db(env, f).get(`shop_members?user_id=eq.${enc(user.id)}&active=eq.true&select=shop_id,role,display_name&limit=1`);
  return rows && rows[0] ? { id: user.id, shop: rows[0].shop_id, role: rows[0].role, name: rows[0].display_name || "الموظف" } : null;
}

export async function handle(req, env, deps) {
  deps = deps || {};
  const f = deps.fetch || fetch;
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "server not configured" });
  const url = new URL(req.url);
  // Meta webhook verification (once, when you save the webhook in Meta)
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && env.WA_VERIFY_TOKEN && url.searchParams.get("hub.verify_token") === env.WA_VERIFY_TOKEN;
    return ok ? new Response(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (sig !== null) {
    // from Meta: answer at once; the work continues in the background (Meta resends if it waits too long)
    if (!(await verifySig(env, raw, sig))) return json(401, { error: "bad signature" });
    let payload = null; try { payload = JSON.parse(raw); } catch (e) { return json(400, { error: "bad json" }); }
    const job = handleInbound(env, deps, payload).catch((e) => console.error("inbound", e && e.message));
    if (deps.waitUntil) { deps.waitUntil(job); return json(200, { ok: true }); }
    await job; return json(200, { ok: true });
  }
  // from the system (staff)
  const me = await member(env, f, req);
  if (!me) return json(401, { error: "sign in first" });
  let body = {}; try { body = JSON.parse(raw || "{}"); } catch (e) { return json(400, { error: "bad request" }); }
  const D = db(env, f);
  if (body.action === "ping") {
    const model = env.WA_BOT_MODEL || "claude-sonnet-5-5";
    // a real (free) call: proves the Claude key works and can use the model, not just that it is set
    let ai = !!deps.ai, aiError = null;
    if (deps.ai && deps.ai.models && typeof deps.ai.models.retrieve === "function") {
      try { await deps.ai.models.retrieve(model); } catch (e) { ai = false; aiError = `${(e && e.status) || ""} ${(e && e.message) || e}`.trim().slice(0, 300); }
    }
    return json(200, { ok: true, whatsapp: !!(env.WA_TOKEN && env.WA_PHONE_ID), signature: !!env.WA_APP_SECRET, verify: !!env.WA_VERIFY_TOKEN, ai, aiError, model });
  }
  if (body.action === "reply") {
    const to = String(body.to || "").replace(/\D/g, ""), text = String(body.text || "").trim();
    if (!/^\d{8,15}$/.test(to) || !text) return json(400, { error: "bad request" });
    if (!(env.WA_TOKEN && env.WA_PHONE_ID)) return json(503, { error: "whatsapp not configured" });
    let wid;
    try { wid = await waText(env, f, to, text); } catch (e) { return json(502, { error: "send failed", detail: e.message }); }
    const now = new Date().toISOString();
    await D.post("wa_messages", { shop_id: me.shop, phone: to, dir: "out", who: me.name, body: text.slice(0, 4000), wa_id: wid }, "return=minimal");
    const keepBot = body.keepBot === true;
    const ex = (await D.get(`wa_threads?shop_id=eq.${me.shop}&phone=eq.${to}&limit=1`))[0];
    const patch = { last_text: text.slice(0, 200), last_at: now, unread: 0, waiting: false, ...(keepBot ? {} : { mode: "human", human_at: now }) };
    if (ex) await D.patch(`wa_threads?shop_id=eq.${me.shop}&phone=eq.${to}`, patch);
    else await D.post("wa_threads", { shop_id: me.shop, phone: to, ...patch }, "return=minimal");
    return json(200, { ok: true, id: wid });
  }
  return json(400, { error: "unknown action" });
}

// keys pasted with an Arabic keyboard can carry invisible marks (RLM, NBSP, zero-width…) that break HTTP headers
const cleanKey = (v) => (v == null ? v : String(v).replace(/[^\x21-\x7E]/g, ""));
const cleanEnv = (e) => ({ ...e, ANTHROPIC_API_KEY: cleanKey(e.ANTHROPIC_API_KEY), WA_TOKEN: cleanKey(e.WA_TOKEN), WA_PHONE_ID: cleanKey(e.WA_PHONE_ID), WA_APP_SECRET: cleanKey(e.WA_APP_SECRET), WA_VERIFY_TOKEN: cleanKey(e.WA_VERIFY_TOKEN) });
export { cleanKey };

if (typeof Deno !== "undefined") {
  const env = cleanEnv(Deno.env.toObject());
  let ai = null;
  if (env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import("npm:@anthropic-ai/sdk");
    ai = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  const waitUntil = globalThis.EdgeRuntime && typeof globalThis.EdgeRuntime.waitUntil === "function" ? (p) => globalThis.EdgeRuntime.waitUntil(p) : null;
  // any unexpected error still answers with CORS headers, so the system shows the real reason instead of "no internet"
  Deno.serve(async (req) => {
    try { return await handle(req, cleanEnv(Deno.env.toObject()), { ai, waitUntil }); }
    catch (e) { console.error("handler", e && e.message); return json(500, { error: "server error", detail: String((e && e.message) || e).slice(0, 300) }); }
  });
}
