// 997 Laundry — customer app API (Supabase Edge Function "customer-api").
// Deploy: Supabase → Edge Functions → Deploy a new function → name: customer-api → paste this file → Deploy.
//         Then open its settings and turn OFF "Verify JWT" (the app signs customers in itself — see below).
// Secrets: none new. It uses SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (always present) and, optionally:
//   CUSTOMER_TOKEN_SECRET  long random text to sign customer sessions (default: derived from the service key)
//   WA_SHOP_NUMBER         the shop's WhatsApp number for the sign-in link (default: profile phone, then 97339599902)
//   WA_SHOP_ID             only if the project holds more than one shop
// Needs the WhatsApp assistant (whatsapp-bot) — sign-in works by the customer SENDING a one-time code to the shop's
// WhatsApp (no Meta template, no SMS cost). The message itself proves the phone number.
//
// Security model: customers never touch the database. Every answer is computed here with the service role and
// contains ONLY the signed-in customer's own data (their orders, packages, balance) + the public price list.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-customer-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const enc = encodeURIComponent;
const LOGIN_TTL_MS = 10 * 60e3;          // a sign-in code is valid for 10 minutes
const SESSION_DAYS = 120;                // the app stays signed in for 4 months
const SLOTS = ["morning", "noon", "evening", "night"];

// ---- catalog names (generated from src/app.js by tools/build.js — do not edit by hand) ----
// @@CATALOG_START
const CATALOG = {"thob_cotton":["ثوب","Thobe"],"thob_wool":["ثوب صوف","Thobe Wool"],"ghatra":["غترة","Ghutra"],"agal":["عقال","Agal"],"abaya_plain":["عباية","Abaya"],"abaya_emb":["عباية مطرزة","Abaya Embroidered"],"shirt":["قميص","Shirt"],"tshirt":["تيشيرت","T-Shirt"],"pants_long":["بنطلون","Pant"],"pants_short":["بنطلون قصير","Half Pant"],"jacket":["جاكيت","Jacket"],"overcoat":["كوت","Coat"],"suit2pcs":["بدلة","Suit"],"dress":["فستان","Dress"],"dress_long":["فستان طويل / سهرة","Dress Long / Evening"],"blouse":["بلوزة","Blouse"],"miniskirt":["تنورة قصيرة","Mini Skirt"],"skirtlong":["تنورة","Skirt (Flat / Pleated)"],"pullover":["فانلة / سويتر","Pullover / Sweater"],"necktie":["ربطة عنق","Necktie"],"kurta_pyjama":["كورتا","Kurta"],"undershirt2pcs":["بدلة داخلية (طقم)","Under Shirt 2Pcs"],"underwear":["ملابس داخلية","Underwear"],"socks":["جوارب","Socks"],"cap":["طاقية","Cap"],"bedsheet_single":["شرشف","Bedsheet"],"bedsheet_double":["شرشف دبل","Double Bedsheet"],"bedcover":["غطاء (كفر)","Cover"],"bedspread":["غطاء سرير كبير (مفرش)","Bed Spread"],"blanket_single":["بطانية","Blanket"],"blanket_double":["بطانية دبل","Double Blanket"],"duvet":["لحاف","Comforter"],"pillowcase":["كيس مخدة","Pillow Cover"],"bathtowel":["منشفة كبيرة","Bath Towel"],"bathrobe":["روب حمام","Bath Robe"],"curtain_per_m":["ستارة (لكل متر)","Curtain (per m)"],"tablecloth":["مفرش طاولة","Table Cloth"],"tablecloth_large":["غطاء طاولة كبير","Table Cloth Large"],"bisht":["بشت","Bisht"],"dupatta":["دوباتا","Dupatta"],"gahfiya":["قحفية","Gahfiya"],"tshirt_half":["تي شيرت نص كم","Half T-Shirt"],"carpet_m2":["سجاد (للمتر)","Carpet (per m²)"],"shaila":["شيلة","Shaila"],"jalabiya":["جلابية","Jalabiya"],"bdf_uniform":["بدلة قوة الدفاع","BDF Uniform"],"hoodie_jacket":["جاكيت هودي","Hoodie Jacket"],"overcoat_long":["معطف","Overcoat"],"shoes":["حذاء","Shoes"],"small_towel":["منشفة صغيرة","Small Towel"]};
// @@CATALOG_END
const SERVICE_NAMES = { washiron: ["غسيل وكي", "Wash & Iron"], iron: ["كي", "Iron"], wash: ["غسيل", "Wash"], dryclean: ["تنظيف جاف", "Dry clean"] };

/* ===================== Supabase (service role) ===================== */
function db(env, f) {
  const base = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  const call = async (path, opt) => {
    const r = await f(`${base}/rest/v1/${path}`, { ...(opt || {}), headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...((opt && opt.headers) || {}) } });
    const t = await r.text();
    let body = null; try { body = t ? JSON.parse(t) : null; } catch (e) { body = t; }
    if (!r.ok) { const err = new Error(`db ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`.slice(0, 300)); err.status = r.status; throw err; }
    return body;
  };
  return {
    get: (path) => call(path),
    post: (path, body) => call(path, { method: "POST", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } }),
  };
}
async function records(D, shop, collection, extra) {
  const rows = await D.get(`records?shop_id=eq.${shop}&collection=eq.${collection}&deleted=eq.false&select=record_id,data${extra || ""}`);
  return (rows || []).map((r) => r.data);
}
async function doc(D, shop, collection) { const d = await records(D, shop, collection, "&record_id=eq._"); return d[0] || {}; }
async function shopId(env, D) {
  if (env.WA_SHOP_ID) return env.WA_SHOP_ID;
  const rows = await D.get("shops?select=id&limit=1");
  return rows && rows[0] ? rows[0].id : null;
}
async function insertRecord(D, shop, collection, data) {
  await D.post("records", { shop_id: shop, collection, record_id: data.id, data });
}

/* ===================== small helpers ===================== */
const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
function bhToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const addDays = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const digits = (v) => String(v || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/\D/g, "");
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n || 300);
function owed(o) {
  const p = o.payment || {};
  if (o.status === "cancelled") return 0;
  return r3(Math.max(0, (Number(p.total) || 0) - (Number(p.paid) || 0) - (Number(p.balanceUse) || 0)));
}
function pkgTrips(cp, dlv) {
  const n = cp && cp.dlvTrips !== undefined && cp.dlvTrips !== null && cp.dlvTrips !== "" ? Math.max(0, Math.floor(Number(cp.dlvTrips) || 0)) : dlv.pkgFree;
  return { n, period: cp && cp.dlvPeriod === "total" ? "total" : "month" };
}
function dlvCfg(settings) {
  const d = settings.delivery || {}, n = (v, def) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? def : Math.max(0, Number(v)));
  return { on: d.on !== false, fee: r3(n(d.fee, 0.5)), pkgFree: Math.floor(n(d.pkgFree, 4)), pkgFee: r3(n(d.pkgFee, 0.5)), freeOver: r3(n(d.freeOver, 0)) };
}

/* ===================== customer sessions (signed, stateless) ===================== */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uText = (s) => b64u(new TextEncoder().encode(s));
const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
async function hmac(env, text) {
  const secret = env.CUSTOMER_TOKEN_SECRET || `customer-api-v1:${env.SUPABASE_SERVICE_ROLE_KEY}`;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}
const sameText = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
async function signToken(env, payload) { const body = b64uText(JSON.stringify(payload)); return `${body}.${await hmac(env, "s:" + body)}`; }
async function readToken(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || !sameText(sig, await hmac(env, "s:" + body))) return null;
  try { const p = JSON.parse(unb64u(body)); return p && p.exp > Date.now() ? p : null; } catch (e) { return null; }
}

/* ===================== public data: prices, packages, delivery policy ===================== */
function catalog(settings, profile, garments, lang) {
  const prices = settings.prices || {}, active = settings.garmentActive || {}, svcOn = settings.serviceActive || {};
  const on = (s) => (svcOn[s] !== undefined ? svcOn[s] !== false : s !== "wash");
  const names = { ...CATALOG }, cats = {};
  (garments || []).forEach((g) => { if (g && g.id && g.active !== false) { names[g.id] = [g.name || g.id, g.nameEn || g.name || g.id]; cats[g.id] = g.cat || ""; } });
  const services = ["washiron", "iron", "wash", "dryclean"].filter(on);
  const items = Object.keys(names).filter((id) => active[id] !== false).map((id) => ({
    id, ar: names[id][0], en: names[id][1], cat: cats[id] || "",
    prices: Object.fromEntries(services.filter((s) => Number(prices[`${id}_${s}`]) > 0).map((s) => [s, r3(prices[`${id}_${s}`])])),
  })).filter((x) => Object.keys(x.prices).length);
  const dlv = dlvCfg(settings);
  const packages = (settings.packageDefs || []).filter((p) => !p.private).map((p) => {
    const t = pkgTrips(p, dlv);
    return { id: p.id, name: p.name, service: p.serviceType, pieces: Number(p.pieceCount) || 0, price: r3(p.price), perPiece: p.pieceCount ? r3(p.price / p.pieceCount) : 0,
      validDays: Number(p.validDays) || 0, trips: t.n, tripsPeriod: t.period, bonus: p.bonus || "", itemsLimited: Array.isArray(p.garments) && p.garments.length > 0 };
  });
  const waNum = digits(profile.whatsapp || profile.phone) || "97339599902";
  return {
    shop: { nameAr: profile.nameAr || "مغسلة 997", nameEn: profile.nameEn || "997 Laundry", area: profile.region || "الرفاع", address: profile.address || "", phone: waNum.startsWith("973") ? waNum : "973" + waNum, hours: (settings.waBot && settings.waBot.hoursText) || "مفتوح 24 ساعة" },
    services: services.map((s) => ({ id: s, ar: SERVICE_NAMES[s][0], en: SERVICE_NAMES[s][1] })),
    items, packages,
    delivery: { on: dlv.on, fee: dlv.fee, pkgFree: dlv.pkgFree, pkgFee: dlv.pkgFee, freeOver: dlv.freeOver, slots: SLOTS },
    urgent: { hours: Number(settings.urgentHours) || 6, normalHours: Number(settings.normalHours) || 24 },
    lang: lang === "en" ? "en" : "ar",
  };
}

/* ===================== the signed-in customer's own data ===================== */
function nameOf(id, garments) {
  const g = (garments || []).find((x) => x && x.id === id);
  if (g) return [g.name || id, g.nameEn || g.name || id];
  return CATALOG[id] || [id, id];
}
function receiptUrl(o, base) { return o.receiptPub && o.receiptPub.token ? `${base}r.html?t=${o.receiptPub.token}` : ""; }
function orderView(o, garments, base, full) {
  const items = (o.items || []).map((it) => {
    const nm = nameOf(it.clothingId, garments), sv = SERVICE_NAMES[it.serviceId] || [it.serviceId, it.serviceId];
    return { ar: nm[0], en: nm[1], serviceAr: sv[0], serviceEn: sv[1], qty: Number(it.qty) || 0, total: r3(it.total), fromPackage: !!it.fromPackageId,
      value: it.fromPackageId ? r3((Number(it.listUnit) || 0) * (Number(it.qty) || 0)) : r3(it.total), urgent: !!it.urgent };
  });
  const p = o.payment || {}, d = o.delivery || null;
  const v = {
    id: o.id, number: o.number, status: o.status, createdAt: o.createdAt, readyAt: o.readyAt || ((o.statusHistory || []).find((h) => h.status === "ready") || {}).at || "",
    deliveredAt: o.deliveredAt || "", urgent: o.priority === "urgent" || (o.items || []).some((it) => it.urgent),
    pieces: items.reduce((a, it) => a + it.qty, 0), total: r3(p.total), owed: owed(o), paid: !!o.paymentConfirmed && owed(o) <= 0,
    payLater: !!o.payLater || p.method === "unpaid", fromPackage: items.some((it) => it.fromPackage),
    delivery: d ? { pickup: !!d.pickup, drop: !!d.drop, address: d.address || "", date: d.date || "", slot: d.slot || "", status: d.drop ? d.dropStatus || "pending" : "" } : null,
    receipt: receiptUrl(o, base),
    discount: r3(p.discount), before: r3((Number(p.total) || 0) + (Number(p.discount) || 0)), paidSoFar: r3(Math.max(0, r3(p.total) - owed(o))),
  };
  if (full) {
    v.items = items;
    v.extras = (o.extras || []).map((l) => ({ label: l.label || l.name || l.id, total: r3(l.total), free: !!l.free }));
    v.subtotal = r3(p.subtotal); v.urgentFee = r3(p.urgentFee);
    v.history = (o.statusHistory || []).map((h) => ({ status: h.status, at: h.at }));
    v.packageValue = r3(items.filter((it) => it.fromPackage).reduce((a, it) => a + it.value, 0));
  }
  return v;
}
function packageView(cp, dlv, today) {
  const t = pkgTrips(cp, dlv);
  return { id: cp.id, name: cp.name, service: cp.serviceType, total: Number(cp.totalPieces) || 0, left: Number(cp.remainingPieces) || 0,
    expiresAt: cp.expiresAt || "", expired: !!(cp.expiresAt && cp.expiresAt < today), trips: t.n, tripsPeriod: t.period, purchasedAt: cp.purchasedAt || "" };
}

/* ===================== ⭐ loyalty card (same rules as the system: src/finance.js customerStats) ===================== */
const LOYALTY_TIERS = [{ id: "bronze", ar: "برونزي", en: "Bronze", min: 0, discount: 5 }, { id: "silver", ar: "فضي", en: "Silver", min: 25, discount: 10 }, { id: "gold", ar: "ذهبي", en: "Gold", min: 60, discount: 15 }, { id: "platinum", ar: "بلاتيني", en: "Platinum", min: 120, discount: 20 }];
const localDay = (iso) => new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString().slice(0, 10); // Bahrain (UTC+3, no DST)
function loyaltyCfg(settings) {
  const l = (settings && settings.loyalty) || {}, n = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== "" && v !== null ? Number(v) : d);
  const tiers = (Array.isArray(l.tiers) && l.tiers.length ? l.tiers : LOYALTY_TIERS).map((t) => ({ ...t, min: Number(t.min) || 0 })).sort((a, b) => a.min - b.min);
  return { on: l.on !== false, perBD: n(l.perBD, 10), redeemPoints: Math.max(1, Math.floor(n(l.redeemPoints, 500))), redeemValue: r3(n(l.redeemValue, 1)), lateDays: Math.floor(n(l.lateDays, 14)), tiers };
}
function loyaltyOf(cust, orders, ledger, settings, today) {
  const cfg = loyaltyCfg(settings);
  if (!cfg.on) return null;
  const isSale = (o) => (o.status === "ready" || o.status === "delivered") && o.paymentConfirmed !== false;
  const paidAt = (o) => o.paidAt || o.readyAt || o.deliveredAt || o.createdAt;
  // the customer's debt is spread over their on-account orders, newest last (same as the system)
  let left = r3(Math.max(0, -Number(cust.balance) || 0));
  const tp = {}; ledger.forEach((t) => { if (t.settles && t.orderId && !t.reversedBy) tp[t.orderId] = r3((tp[t.orderId] || 0) + (Number(t.amount) || 0)); });
  const owedBy = {};
  orders.filter((o) => o.debtRecorded && o.status !== "cancelled").sort((a, b) => String(paidAt(b)).localeCompare(String(paidAt(a)))).forEach((o) => {
    const open = r3(Math.max(0, (Number((o.payment || {}).outstanding) || 0) - (tp[o.id] || 0))), ow = r3(Math.min(open, left)); owedBy[o.id] = ow; left = r3(left - ow);
  });
  const from90 = addDays(today, -89);
  let paid = 0, spent90 = 0, sales = 0, debtOrders = 0, oldest = "";
  orders.filter((o) => o.status !== "cancelled" && isSale(o)).forEach((o) => {
    const total = r3((o.payment || {}).total), ow = o.debtRecorded ? owedBy[o.id] || 0 : 0;
    sales++; paid = r3(paid + total - ow);
    if (localDay(paidAt(o)) >= from90) spent90 = r3(spent90 + total);
    if (o.debtRecorded) debtOrders++;
    if (ow > 0) { const d = localDay(paidAt(o)); if (!oldest || d < oldest) oldest = d; }
  });
  let pkg = 0;
  ledger.forEach((t) => { if (t.type === "package_purchase") { const pr = r3(t.price); pkg = r3(pkg + pr); if (t.at && localDay(t.at) >= from90) spent90 = r3(spent90 + pr); } });
  const redeemed = ledger.reduce((a, t) => a + (t.reversedBy ? 0 : Number(t.loyaltyPoints) || 0), 0);
  const points = Math.max(0, Math.floor((paid + pkg) * cfg.perBD) - redeemed);
  const overdue = oldest ? Math.max(0, Math.round((new Date(today + "T12:00:00Z").getTime() - new Date(oldest + "T12:00:00Z").getTime()) / 86400000)) : 0;
  let commitment = 100;
  if (sales) commitment -= Math.round((debtOrders / sales) * 40);
  if (Number(cust.balance) < 0) commitment -= 10;
  commitment -= Math.min(50, overdue > cfg.lateDays ? overdue : Math.round(overdue / 2));
  commitment = Math.max(0, Math.min(100, commitment));
  let ti = 0; cfg.tiers.forEach((t, i) => { if (spent90 >= t.min) ti = i; });
  if (commitment < 60 && ti > 0) ti--;
  const tier = cfg.tiers[ti], next = cfg.tiers[ti + 1] || null;
  return { cardNo: "997-" + String(cust.phone || cust.id || "").replace(/\D/g, "").slice(-6).padStart(6, "0"), points, value: r3(Math.floor(points / cfg.redeemPoints) * cfg.redeemValue),
    tier: tier.id, tierAr: tier.ar, tierEn: tier.en || tier.ar, commitment, spent90,
    next: next ? { ar: next.ar, en: next.en || next.ar, need: r3(Math.max(0, next.min - spent90)) } : null, redeemPoints: cfg.redeemPoints, redeemValue: cfg.redeemValue, perBD: cfg.perBD };
}

/* ===================== actions ===================== */
async function act(action, body, env, f, base) {
  const D = db(env, f);
  const shop = await shopId(env, D);
  if (!shop) return json(500, { error: "no shop" });
  const lang = body.lang === "en" ? "en" : "ar";

  if (action === "catalog") {
    const [settings, profile, garments] = await Promise.all([doc(D, shop, "settings"), doc(D, shop, "profile"), records(D, shop, "custom_garments")]);
    return json(200, catalog(settings, profile, garments, lang));
  }

  if (action === "login_start") {
    const n = new Uint32Array(1); crypto.getRandomValues(n);
    const code = `997-${String(n[0] % 1000000).padStart(6, "0")}`, exp = Date.now() + LOGIN_TTL_MS;
    const nonce = `${exp}.${await hmac(env, `l:${code}:${exp}`)}`;
    const profile = await doc(D, shop, "profile");
    let num = digits(env.WA_SHOP_NUMBER || profile.whatsapp || profile.phone || "97339599902");
    if (num.length === 8) num = "973" + num;
    const text = `رمز دخول تطبيق مغسلة 997: ${code}`;
    return json(200, { code, nonce, expiresAt: exp, shopNumber: num, text, link: `https://wa.me/${num}?text=${enc(text)}` });
  }

  if (action === "login_check") {
    const code = String(body.code || ""), [expS, sig] = String(body.nonce || "").split("."), exp = Number(expS);
    if (!/^997-\d{6}$/.test(code) || !exp || !sig || !sameText(sig, await hmac(env, `l:${code}:${exp}`))) return json(400, { error: "bad code" });
    if (Date.now() > exp) return json(410, { error: "expired" });
    const since = new Date(exp - LOGIN_TTL_MS - 60e3).toISOString();
    const six = code.slice(4);
    const msgs = await D.get(`wa_messages?shop_id=eq.${shop}&dir=eq.in&body=ilike.*${six}*&at=gte.${enc(since)}&select=phone,body,at&order=at.desc&limit=5`);
    const hit = (msgs || []).find((m) => new RegExp(`997[-\\s]?${six}`).test(String(m.body || "")));
    if (!hit) return json(200, { ok: false, waiting: true });
    const phone = digits(hit.phone);
    let cust = (await records(D, shop, "customers", `&data->>phone=eq.${phone}&limit=1`))[0];
    if (!cust) {
      const th = (await D.get(`wa_threads?shop_id=eq.${shop}&phone=eq.${phone}&select=name&limit=1`).catch(() => []))[0];
      cust = { id: uid(), name: clean((th && th.name) || body.name || "", 60) || "عميل التطبيق", phone, area: "", address: "", notes: "أُضيف عبر تطبيق العملاء", balance: 0, openingBalance: 0, createdAt: new Date().toISOString(), source: "app" };
      await insertRecord(D, shop, "customers", cust);
    }
    const token = await signToken(env, { c: cust.id, p: phone, exp: Date.now() + SESSION_DAYS * 86400e3 });
    return json(200, { ok: true, token, customer: { id: cust.id, name: cust.name, phone } });
  }

  // ---- everything below needs a signed-in customer ----
  const tok = await readToken(env, body.token);
  if (!tok) return json(401, { error: "sign in" });
  const cust = (await records(D, shop, "customers", `&data->>id=eq.${enc(tok.c)}&limit=1`))[0];
  if (!cust || digits(cust.phone) !== tok.p) return json(401, { error: "sign in" });
  const today = bhToday();

  if (action === "home" || action === "me") {
    const [settings, garments, orders, pkgs, reqs, ledger] = await Promise.all([doc(D, shop, "settings"), records(D, shop, "custom_garments"),
      records(D, shop, "orders", `&data->>customerId=eq.${enc(cust.id)}&order=updated_at.desc&limit=1000`), records(D, shop, "customer_packages", `&data->>customerId=eq.${enc(cust.id)}`),
      records(D, shop, "suspended_orders", `&data->>customerId=eq.${enc(cust.id)}`), records(D, shop, "ledger", `&data->>customerId=eq.${enc(cust.id)}`)]);
    const dlv = dlvCfg(settings), bal = r3(Number(cust.balance) || 0);
    const live = orders.filter((o) => o.status !== "cancelled").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json(200, {
      customer: { id: cust.id, name: cust.name, phone: digits(cust.phone), area: cust.area || "", address: cust.address || "" },
      balance: bal, debt: bal < 0 ? r3(-bal) : 0, credit: bal > 0 ? bal : 0,
      active: live.filter((o) => o.status !== "delivered").map((o) => orderView(o, garments, base, false)),
      recent: live.filter((o) => o.status === "delivered").slice(0, 10).map((o) => orderView(o, garments, base, false)),
      packages: pkgs.filter((p) => Number(p.remainingPieces) > 0).map((p) => packageView(p, dlv, today)),
      requests: reqs.filter((r) => r.kind === "pickup" || r.kind === "dropreq").map((r) => ({ id: r.id, kind: r.kind, date: r.date || "", slot: r.slot || "", address: r.address || "", status: r.status || "new", confirmed: !r.needsConfirm, orderNumber: r.orderNumber || "" })),
      owedTotal: r3(live.reduce((a, o) => a + owed(o), 0)),
      loyalty: loyaltyOf(cust, orders, ledger, settings, today),
    });
  }

  if (action === "orders") {
    const [garments, orders] = await Promise.all([records(D, shop, "custom_garments"), records(D, shop, "orders", `&data->>customerId=eq.${enc(cust.id)}&order=updated_at.desc&limit=200`)]);
    return json(200, { orders: orders.filter((o) => o.status !== "cancelled").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((o) => orderView(o, garments, base, false)) });
  }

  if (action === "order") {
    const [garments, o] = await Promise.all([records(D, shop, "custom_garments"), records(D, shop, "orders", `&data->>id=eq.${enc(String(body.id || ""))}&limit=1`).then((x) => x[0])]);
    if (!o || o.customerId !== cust.id) return json(404, { error: "not found" });
    return json(200, { order: orderView(o, garments, base, true) });
  }

  if (action === "packages") {
    const [settings, pkgs] = await Promise.all([doc(D, shop, "settings"), records(D, shop, "customer_packages", `&data->>customerId=eq.${enc(cust.id)}`)]);
    const dlv = dlvCfg(settings);
    return json(200, { packages: pkgs.sort((a, b) => String(b.purchasedAt || "").localeCompare(String(a.purchasedAt || ""))).map((p) => packageView(p, dlv, today)) });
  }

  if (action === "book_pickup") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : today;
    if (date < today || date > addDays(today, 30)) return json(400, { error: "bad date" });
    const slot = SLOTS.includes(body.slot) ? body.slot : "evening";
    const area = clean(body.area, 60), addr = clean(body.address, 240), loc = /^-?\d{1,2}\.\d+,-?\d{1,3}\.\d+$/.test(String(body.location || "")) ? String(body.location) : "";
    const address = [area, addr, loc ? `https://maps.google.com/?q=${loc}` : ""].filter(Boolean).join(" — ") || [cust.area, cust.address].filter(Boolean).join(" — ");
    if (!address) return json(400, { error: "address" });
    const open = (await records(D, shop, "suspended_orders", `&data->>customerId=eq.${enc(cust.id)}&data->>kind=eq.pickup`))[0];
    if (open) return json(200, { ok: true, already: true, request: { id: open.id, date: open.date || "", slot: open.slot || "", address: open.address || "" } });
    const now = new Date().toISOString(), id = uid();
    const req = { id, kind: "pickup", source: "app", needsConfirm: true, customerId: cust.id, customerName: cust.name, address, date, slot, drop: body.drop !== false,
      notes: clean(body.notes, 300), status: "new", items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: "التطبيق" };
    await insertRecord(D, shop, "suspended_orders", req);
    return json(200, { ok: true, request: { id, date, slot, address } });
  }

  if (action === "request_delivery") {
    const o = (await records(D, shop, "orders", `&data->>id=eq.${enc(String(body.orderId || ""))}&limit=1`))[0];
    if (!o || o.customerId !== cust.id || ["delivered", "cancelled"].includes(o.status)) return json(404, { error: "not found" });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : today;
    if (date < today || date > addDays(today, 30)) return json(400, { error: "bad date" });
    const slot = SLOTS.includes(body.slot) ? body.slot : "evening";
    const loc = /^-?\d{1,2}\.\d+,-?\d{1,3}\.\d+$/.test(String(body.location || "")) ? String(body.location) : "";
    const address = [clean(body.area, 60), clean(body.address, 240), loc ? `https://maps.google.com/?q=${loc}` : ""].filter(Boolean).join(" — ") || (o.delivery && o.delivery.address) || [cust.area, cust.address].filter(Boolean).join(" — ");
    if (!address) return json(400, { error: "address" });
    const dup = (await records(D, shop, "suspended_orders", `&data->>customerId=eq.${enc(cust.id)}&data->>kind=eq.dropreq`)).find((r) => r.orderId === o.id);
    if (dup) return json(200, { ok: true, already: true });
    const now = new Date().toISOString(), id = uid();
    await insertRecord(D, shop, "suspended_orders", { id, kind: "dropreq", source: "app", needsConfirm: true, customerId: cust.id, customerName: cust.name, orderId: o.id, orderNumber: o.number,
      address, date, slot, notes: clean(body.notes, 300), status: "new", items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: "التطبيق" });
    return json(200, { ok: true });
  }

  if (action === "feedback") {
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 0)));
    const msg = clean(body.message, 1000);
    if (!body.rating && !msg) return json(400, { error: "empty" });
    const o = body.orderId ? (await records(D, shop, "orders", `&data->>id=eq.${enc(String(body.orderId))}&limit=1`))[0] : null;
    const note = `${rating <= 2 ? "⚠️ تقييم منخفض" : "⭐ تقييم"} من تطبيق العملاء: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}${o && o.customerId === cust.id ? ` — طلب #${o.number}` : ""}${msg ? ` — ${msg}` : ""}`;
    // shows in the system's WhatsApp inbox on this customer's chat (staff see it with the conversation)
    const phone = digits(cust.phone);
    await D.post("wa_messages", { shop_id: shop, phone, dir: "note", who: "app", body: note.slice(0, 4000) });
    try { await D.post("wa_threads", { shop_id: shop, phone, name: cust.name, customer_id: cust.id, last_text: note.slice(0, 200), last_at: new Date().toISOString(), unread: 1, waiting: rating <= 3, flag: rating <= 2 ? "complaint" : null }); } catch (e) { /* the chat exists already */ }
    return json(200, { ok: true });
  }

  return json(400, { error: "unknown action" });
}

export async function handle(req, env, deps) {
  deps = deps || {};
  const f = deps.fetch || fetch;
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "server not configured" });
  let body = {};
  try { body = await req.json(); } catch (e) { return json(400, { error: "bad json" }); }
  if (!body.token) body.token = req.headers.get("x-customer-token") || "";
  const base = env.SITE_URL || "https://997-laundry.github.io/";
  try { return await act(String(body.action || ""), body, env, f, base.endsWith("/") ? base : base + "/"); }
  catch (e) { console.error("customer-api", e && e.message); return json(500, { error: "server error" }); }
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve((req) => handle(req, { SUPABASE_URL: Deno.env.get("SUPABASE_URL"), SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), CUSTOMER_TOKEN_SECRET: Deno.env.get("CUSTOMER_TOKEN_SECRET"), WA_SHOP_NUMBER: Deno.env.get("WA_SHOP_NUMBER"), WA_SHOP_ID: Deno.env.get("WA_SHOP_ID"), SITE_URL: Deno.env.get("SITE_URL") }));
}
