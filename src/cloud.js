/* ==========================================================================
   997 Laundry — cloud.js
   مزامنة سحابية مع Supabase: كل جهاز يحفظ بياناته محلياً كما هو (يعمل بدون إنترنت)،
   وهذا الملف يرفع كل تغيير للسحابة ويسحب تغييرات الأجهزة الأخرى.

   - كل سجل (طلب، عميل، مصروف...) = صف في جدول records، مع رقم نسخة (version):
     التعديل يُقبل فقط إذا لم يغيّره جهاز آخر قبلنا — وإلا تفوز نسخة السحابة وتُحفظ نسختنا في «تعارضات».
   - تغييرات الأجهزة الأخرى تُطبَّق فقط عندما يكون الجهاز خاملاً (لا نافذة مفتوحة ولا سلة) ثم تُعاد تهيئة الصفحة،
     حتى لا تكتب الشاشة المفتوحة بيانات قديمة فوق الجديدة.
   - كلمات المرور المجزّأة ورمز الاسترداد لا تغادر الجهاز أبداً.
   - لا يعمل شيء من هذا قبل أن يربط المالك النظام بالسحابة (زر في «ملف المنشأة»).
   ========================================================================== */
(function (root) {
  "use strict";
  const CFG = Object.assign({
    url: "https://szlfvwzuyllitqkdysju.supabase.co",
    key: "sb_publishable_UrGITH1hX1-Ds8fA0eHPew_vMFzFkdS",
    pollMs: 4000, idleMs: 8000, softIdleMs: 1500, emailDomain: "997laundry.app",
  }, root.__L997_CLOUD_CONFIG || {});

  // [اسم المجموعة في السحابة, مفتاح التخزين المحلي, نوعها, خيارات]
  // list = مصفوفة سجلات لكل منها id · doc = كائن واحد · local = حقول لا تُرفع · keepRemoved = لا تُحذف من السحابة عند قصّها محلياً
  const COLLECTIONS = [
    ["orders", "l997_orders", "list"], ["customers", "l997_customers", "list"], ["ledger", "l997_ledger", "list"],
    ["customer_packages", "l997_customer_packages", "list"], ["suspended_orders", "l997_suspended_orders", "list"],
    ["shifts", "l997_shifts", "list"], ["attendance", "l997_attendance", "list"],
    ["audit", "l997_audit", "list", { keepRemoved: true }],
    ["settings", "l997_settings", "doc", { local: ["orderSeq"], defaults: { orderSeq: 1 } }],
    ["custom_garments", "l997_custom_garments", "list"], ["profile", "l997_profile", "doc"],
    ["branches", "l997_branches", "doc"], ["perm_matrix", "l997_perm_matrix", "doc"],
    ["security", "l997_security", "doc", { local: ["recoveryHash", "recoverySalt", "recoveryAt"] }],
    ["employees", "l997_employees", "list", { local: ["passHash", "salt", "password", "_mfaTrusted", "_mfaPassed"] }],
    ["payroll", "l997_payroll", "list"], ["expenses", "l997_expenses", "list"],
    ["recurring_expenses", "l997_recurring_expenses", "list"], ["inventory", "l997_inventory", "list"],
    ["purchases", "l997_purchases", "list"], ["suppliers", "l997_suppliers", "list"],
    ["stock_moves", "l997_stock_moves", "list", { keepRemoved: true }], ["closures", "l997_closures", "list"],
    // جلسات الدخول (جهاز/مستخدم/آخر نشاط) — صفحة الأمان + إبطال جلسة عن بُعد (supabase/security.sql)
    ["sessions", "l997_sessions", "list"],
  ].map(([name, key, type, o]) => ({ name, key, type, local: [], defaults: {}, keepRemoved: false, ...(o || {}) }));
  const byKey = {}, byName = {};
  COLLECTIONS.forEach((c) => { byKey[c.key] = c; byName[c.name] = c; });

  const ST_KEY = "l997_cloud", BASE_KEY = "l997_cloud_base", TOK_KEY = "l997_cloud_tokens";
  let ls = null;
  try { ls = root.localStorage; ls.getItem("l997_cloud"); } catch (e) { ls = null; }
  const rawSet = typeof Storage !== "undefined" ? Storage.prototype.setItem : null;
  const read = (k, d) => { try { const v = ls.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const write = (k, v) => { try { rawSet.call(ls, k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  let st = ls ? read(ST_KEY, null) : null; // { shopId, cursor, numbers, rules, conflicts, rejected, lastSyncAt, lastError }
  let base = ls ? read(BASE_KEY, {}) : {}; // collection → record id → [version, hash]
  let tokens = ls ? read(TOK_KEY, {}) : {}; // cloud user id → { a, r, exp }
  let user = null; // { uid, role }
  let applying = false, busy = false, timer = null, debounce = null, needLogin = false, online = true;
  let userGen = 0;
  let lastInput = Date.now(), lastError = "", staged = new Map(), stagedCursor = 0;
  // طلبات خسر هذا الجهاز تعديلها لصالح جهاز آخر في هذه الجولة — قيود الدفع المرتبطة بها لا تُرفع
  let lostOrders = new Set(), localChanged = false;
  // فرق ساعة الجهاز عن ساعة الخادم (يُقاس من وقت حفظ السجلات في الخادم) — ساعة خاطئة تُسجّل العمليات بتاريخ خاطئ
  let clockSkewMs = null;
  const dirty = new Set();
  const saveSt = () => { if (st) write(ST_KEY, st); };
  const saveBase = () => write(BASE_KEY, base);
  const saveTok = () => write(TOK_KEY, tokens);

  /* ---------- اكتشاف التغييرات المحلية ---------- */
  if (ls && rawSet) {
    Storage.prototype.setItem = function (k, v) {
      rawSet.call(this, k, v);
      if (this === ls && !applying && st && byKey[k]) { dirty.add(k); schedulePush(); }
    };
  }
  if (typeof document !== "undefined") {
    ["pointerdown", "keydown", "touchstart", "input", "wheel", "scroll", "mousemove"].forEach((ev) => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  }

  // نص ثابت للمقارنة (ترتيب المفاتيح لا يؤثر — قاعدة البيانات تعيد ترتيبها)
  function canon(v) {
    if (v === null || typeof v !== "object") { const s = JSON.stringify(v); return s === undefined ? "null" : s; }
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  function hashOf(v) {
    const s = canon(v);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + "." + s.length.toString(36);
  }
  function strip(c, d) {
    if (!c.local.length || !d || typeof d !== "object" || Array.isArray(d)) return d;
    const o = { ...d }; c.local.forEach((k) => delete o[k]); return o;
  }
  function pickLocal(c, d) {
    const o = {};
    if (d && typeof d === "object") c.local.forEach((k) => { if (d[k] !== undefined) o[k] = d[k]; });
    return o;
  }
  function localRecords(c) {
    const v = read(c.key, null), m = new Map();
    if (v === null) return m;
    if (c.type === "doc") { m.set("_", strip(c, v)); return m; }
    if (Array.isArray(v)) v.forEach((r) => { if (r && r.id !== undefined && r.id !== null) m.set(String(r.id), strip(c, r)); });
    return m;
  }

  /* ---------- الاتصال ---------- */
  const emailOf = (username) => String(username || "").trim().toLowerCase() + "@" + CFG.emailDomain;
  async function api(path, opt) {
    opt = opt || {};
    const h = { apikey: CFG.key, "Content-Type": "application/json", ...(opt.headers || {}) };
    if (opt.bearer) h.Authorization = "Bearer " + opt.bearer;
    else if (opt.auth !== false) { const t = await accessToken(opt.as); if (!t) throw Object.assign(new Error("no-session"), { noSession: true }); h.Authorization = "Bearer " + t; }
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), opt.timeout || 15000) : null;
    let r;
    const t0 = Date.now();
    try { r = await root.fetch(CFG.url + path, { method: opt.method || "GET", headers: h, body: opt.body === undefined ? undefined : JSON.stringify(opt.body), signal: ctl ? ctl.signal : undefined }); }
    catch (e) {
      if (e && e.name === "AbortError" && opt.timeout) throw Object.assign(new Error("timeout"), { timeout: true });
      online = false; throw Object.assign(new Error("offline"), { offline: true });
    }
    finally { if (to) clearTimeout(to); }
    online = true;
    const txt = await r.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) throw Object.assign(new Error((data && (data.msg || data.message || data.error_description)) || "HTTP " + r.status), { status: r.status, data });
    if (Array.isArray(data) && data[0] && data[0].updated_at && (opt.method === "POST" || opt.method === "PATCH")) {
      const srv = Date.parse(data[0].updated_at);
      if (srv) clockSkewMs = Math.round((t0 + Date.now()) / 2 - srv);
    }
    return data;
  }
  const rep = { Prefer: "return=representation" };
  function keepSession(s) {
    if (!s || !s.access_token || !s.user) return null;
    tokens[s.user.id] = { a: s.access_token, r: s.refresh_token, exp: Date.now() + (Number(s.expires_in) || 3600) * 1000 };
    saveTok();
    return s.user.id;
  }
  async function accessToken(asUid) {
    const uid = asUid || (user && user.uid);
    if (!uid) return null;
    const t = tokens[uid];
    if (!t) { if (!asUid) needLogin = true; return null; }
    if (Date.now() < t.exp - 60000) return t.a;
    try {
      const s = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", auth: false, body: { refresh_token: t.r } });
      keepSession(s); if (!asUid) needLogin = false;
      return tokens[uid].a;
    } catch (e) {
      if (e.offline) throw e;
      delete tokens[uid]; saveTok(); if (!asUid) needLogin = true;
      return null;
    }
  }
  const msgOf = (e) => (e.offline ? "offline"
    : e.data && e.data.error_code === "email_not_confirmed" ? "email-unconfirmed"
    : e.status === 429 || (e.data && /rate|too many/i.test(String(e.data.error_code || e.data.msg || ""))) ? "too-many"
    : e.status === 400 || e.status === 401 ? "bad-credentials" : e.message || "error");

  /* ---------- رفع التغييرات ---------- */
  // مجموعة يكتب فيها الدور ولا يقرأها (مثل سجل النشاط للعامل) — تُضاف عبر دالة الإضافة فقط
  const canRead = (c) => !st || !st.rules || !st.rules[c.name] || (user && st.rules[c.name].r.includes(user.role));
  const retried = new Set(); // سجلات رُفضت سابقاً — تُعاد محاولتها مرة واحدة في كل فتح للنظام
  const canWrite = (c) => !st || !st.rules || !st.rules[c.name] || (user && st.rules[c.name].w.includes(user.role));
  // مجموعة جديدة لم تُفعَّل بعد على الخادم (لم يُشغَّل ملف SQL الخاص بها) — تبقى على الجهاز ولا تُرفع
  const serverKnows = (c) => !st || !st.rules || !!st.rules[c.name] || ["orders", "customers", "ledger"].includes(c.name);
  function note(list, item, max) { st[list] = [item, ...(st[list] || [])].slice(0, max || 40); }
  async function serverRow(c, rid) {
    const rows = await api(`/rest/v1/records?shop_id=eq.${st.shopId}&collection=eq.${c.name}&record_id=eq.${encodeURIComponent(rid)}`);
    return rows && rows[0] ? rows[0] : null;
  }
  function conflict(c, rid, localData, row) {
    if (c.name === "orders") lostOrders.add(String(rid));
    const mine = canon(localData).slice(0, 4000);
    const previous = (st.conflicts || []).find((entry) => entry.collection === c.name && entry.id === rid);
    if (!previous || previous.mine !== mine) {
      note("conflicts", { at: new Date().toISOString(), collection: c.name, id: rid, mine });
    }
    if (row) {
      const key = c.name + "\u0000" + rid;
      const queued = staged.get(key);
      if (!queued || queued.version < row.version) staged.set(key, row);
      stagedCursor = Math.max(stagedCursor, row.seq || 0);
    }
  }
  // قيد دفع/استرداد خاص بطلب (ليس سداداً لاحقاً) — لا يتكرر لنفس الطلب
  const orderEntry = (d) => d && d.orderId && !d.settles && (d.type === "order_charge" || d.type === "order_refund" || d.type === "credit");
  // حذف قيود محلية لم تُقبل (الطلب نفسه سُجّل دفعه على جهاز آخر) حتى لا يُحسب المبلغ مرتين على هذا الجهاز
  function dropLocal(c, ids, why) {
    if (!ids.length) return;
    const arr = read(c.key, []);
    applying = true;
    try { write(c.key, (Array.isArray(arr) ? arr : []).filter((r) => !ids.includes(String(r && r.id)))); } finally { applying = false; }
    const b = base[c.name] || {};
    // يُحفظ حتى لا يعود القيد من ذاكرة الشاشة قبل تحديثها فيُرفع لاحقاً
    st.dropped = [...new Set([...ids, ...(st.dropped || [])])].slice(0, 500);
    ids.forEach((rid) => { delete b[rid]; if (why) note("conflicts", { at: new Date().toISOString(), collection: c.name, id: rid, mine: why }); });
    localChanged = true;
  }
  async function pushCollection(c) {
    if (c.name === "ledger") {
      const recs0 = localRecords(c), b0 = base[c.name] || {}, gone = new Set(st.dropped || []);
      dropLocal(c, [...recs0.keys()].filter((rid) => gone.has(rid) && !b0[rid]), "");
      if (lostOrders.size) dropLocal(c, [...recs0].filter(([rid, d]) => !b0[rid] && !gone.has(rid) && orderEntry(d) && lostOrders.has(String(d.orderId))).map(([rid]) => rid), "dropped: this order was paid/cancelled on another device first");
    }
    const recs = localRecords(c), b = base[c.name] || (base[c.name] = {});
    const inserts = [], updates = [], removes = [];
    const readable = canRead(c);
    recs.forEach((d, rid) => {
      const h = hashOf(d), bb = b[rid], key = c.name + "\u0000" + rid;
      if (!bb || (bb[0] === 0 && !retried.has(key))) { retried.add(key); inserts.push([rid, d, h]); }
      else if (bb[1] !== h) { if (readable) updates.push([rid, d, h, bb[0]]); else bb[1] = h; } // لا تعديل لما لا نقرؤه
    });
    if (!c.keepRemoved && readable) Object.keys(b).forEach((rid) => { if (!recs.has(rid) && b[rid][0] > 0) removes.push([rid, b[rid][0]]); });
    if (!readable) {
      for (let i = 0; i < inserts.length; i += 100) {
        const chunk = inserts.slice(i, i + 100);
        try {
          await api("/rest/v1/rpc/append_records", { method: "POST", body: { p_shop: st.shopId, p_collection: c.name, p_items: chunk.map(([rid, d]) => ({ id: rid, data: d })) } });
          chunk.forEach(([rid, , h]) => { b[rid] = [1, h]; });
        } catch (e) {
          if (e.offline || e.noSession) throw e;
          note("rejected", { at: new Date().toISOString(), collection: c.name, id: chunk[0][0], why: e.message });
          chunk.forEach(([rid, , h]) => { b[rid] = [0, h]; });
        }
      }
      return;
    }
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      try {
        const rows = await api("/rest/v1/records", { method: "POST", headers: rep, body: chunk.map(([rid, d]) => ({ shop_id: st.shopId, collection: c.name, record_id: rid, data: d })) });
        rows.forEach((row) => { const it = chunk.find((x) => x[0] === row.record_id); b[row.record_id] = [row.version, it ? it[2] : hashOf(row.data)]; });
      } catch (e) {
        if (e.offline || e.noSession) throw e;
        // دفعة رُفضت: نجرّب كل سجل وحده حتى لا يوقف سجل واحد الباقي
        for (const [rid, d, h] of chunk) {
          try {
            const rows = await api("/rest/v1/records", { method: "POST", headers: rep, body: { shop_id: st.shopId, collection: c.name, record_id: rid, data: d } });
            b[rid] = [rows[0].version, h];
          } catch (e2) {
            if (e2.offline || e2.noSession) throw e2;
            if (e2.status === 409) {
              // «موجود مسبقاً» بنفس المحتوى = محاولة سابقة وصلت للخادم وضاع الرد (انقطاع) — ليس تعارضاً ولا تكراراً
              const row = await serverRow(c, rid);
              if (row && !row.deleted && hashOf(row.data) === h) b[rid] = [row.version, h];
              else { conflict(c, rid, d, row); b[rid] = [0, h]; }
            }
            else if (c.name === "ledger" && /already recorded on another device/.test(e2.message)) dropLocal(c, [rid], "dropped: " + e2.message);
            else { note("rejected", { at: new Date().toISOString(), collection: c.name, id: rid, why: e2.message }); b[rid] = [0, h]; }
          }
        }
      }
    }
    for (const [rid, d, h, v] of updates) {
      try {
        if (v === 0) { // لم يُقبل سابقاً — محاولة إدخال من جديد
          const rows = await api("/rest/v1/records", { method: "POST", headers: rep, body: { shop_id: st.shopId, collection: c.name, record_id: rid, data: d } });
          b[rid] = [rows[0].version, h]; continue;
        }
        const rows = await api(`/rest/v1/records?shop_id=eq.${st.shopId}&collection=eq.${c.name}&record_id=eq.${encodeURIComponent(rid)}&version=eq.${v}`, { method: "PATCH", headers: rep, body: { data: d } });
        if (rows && rows.length) b[rid] = [rows[0].version, h];
        else {
          const row = await serverRow(c, rid);
          // The earlier PATCH may have committed before the connection dropped.
          if (row && !row.deleted && hashOf(row.data) === h) b[rid] = [row.version, h];
          else conflict(c, rid, d, row);
        }
      } catch (e) {
        if (e.offline || e.noSession) throw e;
        note("rejected", { at: new Date().toISOString(), collection: c.name, id: rid, why: e.message });
        b[rid] = [v, h];
      }
    }
    for (const [rid, v] of removes) {
      try {
        const rows = await api(`/rest/v1/records?shop_id=eq.${st.shopId}&collection=eq.${c.name}&record_id=eq.${encodeURIComponent(rid)}&version=eq.${v}`, { method: "PATCH", headers: rep, body: { deleted: true } });
        if (rows && rows.length) delete b[rid];
        else conflict(c, rid, null, await serverRow(c, rid));
      } catch (e) {
        if (e.offline || e.noSession) throw e;
        note("rejected", { at: new Date().toISOString(), collection: c.name, id: rid, why: e.message });
        delete b[rid];
      }
    }
  }
  async function push() {
    const order = (k) => COLLECTIONS.indexOf(byKey[k]);
    const keys = [...dirty].sort((x, y) => order(x) - order(y));
    lostOrders = new Set();
    for (const k of keys) {
      const c = byKey[k];
      if (!canWrite(c)) continue; // يبقى معلّقاً حتى يدخل مستخدم له صلاحية الكتابة
      if (!serverKnows(c)) { dirty.delete(k); continue; }
      dirty.delete(k);
      try { await pushCollection(c); } catch (e) { dirty.add(k); throw e; } finally { saveBase(); saveSt(); }
    }
  }
  function schedulePush() {
    clearTimeout(debounce);
    debounce = setTimeout(() => { sync(false).catch(() => {}); }, 400); // رفع شبه فوري بعد الحفظ
  }

  /* ---------- سحب تغييرات الأجهزة الأخرى ---------- */
  async function pull() {
    let from = Math.max(0, (Math.max(st.cursor || 0, stagedCursor) || 0) - 50); // تداخل بسيط حتى لا تفوتنا عمليات متزامنة
    for (let page = 0; page < 200; page++) {
      const rows = await api(`/rest/v1/records?select=collection,record_id,data,deleted,version,seq&shop_id=eq.${st.shopId}&seq=gt.${from}&order=seq.asc&limit=500`);
      for (const row of rows) {
        const c = byName[row.collection]; if (!c) continue;
        const bb = (base[c.name] || {})[row.record_id];
        stagedCursor = Math.max(stagedCursor, row.seq);
        if (bb && bb[0] >= row.version) continue;
        const k = c.name + "\u0000" + row.record_id, prev = staged.get(k);
        if (!prev || prev.version < row.version) staged.set(k, row);
      }
      if (rows.length < 500) break;
      from = rows[rows.length - 1].seq;
    }
  }
  // تطبيق التغييرات المسحوبة على التخزين المحلي — دفعة واحدة متزامنة قبل إعادة تهيئة الصفحة مباشرة
  function applyStaged(replaceAll) {
    const groups = new Map();
    staged.forEach((row) => { const c = byName[row.collection]; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(row); });
    applying = true;
    try {
      COLLECTIONS.forEach((c) => {
        const b = base[c.name] || (base[c.name] = {});
        const rows = (groups.get(c) || []).filter((row) =>
          replaceAll || !b[row.record_id] || row.version > b[row.record_id][0]);
        if (!rows.length && !replaceAll) return;
        const cur = replaceAll ? null : read(c.key, null);
        if (c.type === "doc") {
          const row = rows.sort((x, y) => y.version - x.version)[0];
          if (!row) return;
          if (row.deleted) { delete b._; return; }
          if (!replaceAll && cur !== null && b._ && hashOf(strip(c, cur)) !== b._[1]) conflict(c, "_", strip(c, cur), null);
          write(c.key, { ...c.defaults, ...row.data, ...pickLocal(c, cur) });
          b._ = [row.version, hashOf(row.data)];
          return;
        }
        let arr = Array.isArray(cur) ? cur.slice() : [];
        const idx = new Map(arr.map((r, i) => [r && r.id !== undefined ? String(r.id) : "\u0000" + i, r]));
        const fresh = [];
        rows.sort((x, y) => x.seq - y.seq).forEach((row) => {
          const rid = row.record_id, local = idx.get(rid);
          if (local && b[rid] && hashOf(strip(c, local)) !== b[rid][1]) conflict(c, rid, strip(c, local), null); // تعديل محلي لم يُرفع — تفوز السحابة
          if (row.deleted) { idx.delete(rid); delete b[rid]; return; }
          const merged = { ...row.data, ...pickLocal(c, local) };
          if (local) idx.set(rid, merged); else fresh.unshift(merged);
          b[rid] = [row.version, hashOf(row.data)];
        });
        arr = [...fresh, ...idx.values()];
        write(c.key, arr);
      });
      st.cursor = Math.max(st.cursor || 0, stagedCursor);
      staged = new Map();
      saveBase(); saveSt();
    } finally { applying = false; }
  }
  const host = () => root.L997CloudHost || null;
  function idle() {
    const h = host();
    return !!h && !h.busy() && Date.now() - lastInput > CFG.idleMs;
  }
  // إعادة تحميل الصفحة بدون إنترنت قد تُظهر صفحة خطأ المتصفح بدل النظام — لا نعيد التحميل إلا مع اتصال
  const netUp = () => online && (typeof navigator === "undefined" || navigator.onLine !== false);
  // حماية من التحديث المتكرر: أكثر من 3 إعادات تحميل تلقائية خلال دقيقتين = خلل (مثلاً جهاز بنسخة قديمة) —
  // نتوقف عن إعادة التحميل التلقائي ونعرض زر «تحديث» بدلاً منه، ونسجّل السبب للتشخيص
  function reloadStorm() {
    let a = []; try { a = JSON.parse(sessionStorage.getItem("l997_cloud_reloads") || "[]"); } catch (e) { a = []; }
    return a.filter((t) => Date.now() - t < 120000).length >= 3;
  }
  function autoReload() {
    if (reloadStorm()) { showUpdateChip(true); return; }
    try {
      let a = JSON.parse(sessionStorage.getItem("l997_cloud_reloads") || "[]");
      a = [...a.filter((t) => Date.now() - t < 120000), Date.now()]; sessionStorage.setItem("l997_cloud_reloads", JSON.stringify(a));
    } catch (e) { /* ignore */ }
    const why = [...new Set([...staged.values()].map((r) => r.collection))].join(",");
    note("reloads", { at: new Date().toISOString(), why });
    reloadNow();
  }
  function reloadNow() {
    const h = host();
    try { sessionStorage.setItem("l997_cloud_page", h ? h.page() : ""); sessionStorage.setItem("l997_cloud_scroll", String(Math.round(root.scrollY || 0))); } catch (e) { /* ignore */ }
    applyStaged(false);
    root.location.reload();
  }
  // ما يمكن عرضه فوراً بدون إعادة تحميل الصفحة؛ غيرها (إعدادات، صلاحيات، موظفون…) يحتاج إعادة تهيئة كاملة
  const SOFT = new Set(["orders", "customers", "ledger", "customer_packages", "suspended_orders", "shifts", "attendance", "audit", "expenses", "sessions"]);
  // تغيير لا يؤثر على عمل الشاشة (مثل «آخر دخول» لموظف سجّل دخوله على جهاز آخر) — يُطبَّق بهدوء بدون إعادة تحميل الصفحة
  const VOLATILE = { employees: ["lastLogin"] };
  function harmless(row) {
    const c = byName[row.collection], skip = VOLATILE[row.collection];
    if (!c || !skip || row.deleted || c.type !== "list") return false;
    const arr = read(c.key, []);
    const local = Array.isArray(arr) ? arr.find((r) => r && String(r.id) === row.record_id) : null;
    if (!local) return false;
    const clean = (d) => { const o = { ...strip(c, d) }; skip.forEach((k) => delete o[k]); return o; };
    return hashOf(clean(local)) === hashOf(clean(row.data));
  }
  function maybeApply() {
    const h = host();
    if (localChanged && !staged.size && h && h.refresh && !h.busy()) { localChanged = false; try { h.refresh(); } catch (e) { reloadNow(); } return; }
    if (!staged.size) { showUpdateChip(false); return; }
    const soft = h && h.refresh && [...staged.values()].every((r) => SOFT.has(r.collection) || harmless(r));
    if (soft && !(h.softBusy ? h.softBusy() : h.busy())) {
      // تحديث هادئ ممكن: ننتظر لحظة توقف المستخدم عن الحركة ثم نطبّقه — لا نلجأ لإعادة تحميل الصفحة أبداً في هذه الحالة
      if (Date.now() - lastInput <= CFG.softIdleMs) return;
      applyStaged(false); localChanged = false;
      try { h.refresh(); } catch (e) { reloadNow(); return; }
      showUpdateChip(false); renderChip();
      return;
    }
    showUpdateChip(true);
    if (idle() && netUp()) autoReload();
  }

  /* ---------- حلقة المزامنة ---------- */
  // رفع/سحب واحد فقط في نفس الوقت — تزامن عمليتين كان يرسل نفس السجل مرتين (تعارض وهمي بعد الربط)
  async function lock() { while (busy) await new Promise((r) => setTimeout(r, 200)); busy = true; }
  async function sync(withPull) {
    if (!st || !st.shopId || !user || busy) return;
    busy = true;
    try {
      await push();
      if (withPull !== false) await pull();
      st.lastSyncAt = new Date().toISOString(); lastError = "";
      needLogin = false;
    } catch (e) {
      lastError = msgOf(e);
    } finally {
      busy = false; saveSt(); renderChip();
      if (withPull !== false) maybeApply();
    }
  }
  // أعلى رقم طلب على هذا الجهاز — أول كتلة أرقام من السحابة لا تبدأ تحته
  const localMaxNumber = () => (read("l997_orders", []) || []).reduce((m, o) => Math.max(m, Number(o && o.number) || 0), 0);
  // هل ميزة «رابط الإيصال» مفعّلة على الخادم (supabase/receipt_link.sql)؟ null = لم يُفحص بعد
  let receiptLinks = null;
  function checkReceiptLinks() {
    if (receiptLinks === true) return;
    api("/rest/v1/rpc/public_receipt", { method: "POST", auth: false, body: { p_token: "x" } })
      .then(() => { receiptLinks = true; }, (e) => { if (!e.offline) receiptLinks = false; });
  }
  function start() {
    stop();
    checkReceiptLinks();
    // ما تغيّر محلياً ولم يُرفع قبل إعادة تحميل الصفحة (مثلاً بدون إنترنت) — الرفع يقارن بالنسخ المرفوعة فلا يُرسل إلا المختلف
    if (st && st.shopId) storeDirtyAll();
    sync(true);
    // حجز أرقام الطلبات فور الدخول إن لم يكن لدينا أرقام (لا ننتظر أول طلب، ولا نحجز من جديد مع كل تحديث للصفحة)
    // الأرقام تُحجز وقت الحفظ فقط (رقم واحد) — كتل الأرقام القديمة المحجوزة مسبقاً لم تعد تُستعمل
    if (st && (st.numbers || st.nextBlock)) { st.numbers = null; st.nextBlock = null; saveSt(); }
    timer = setInterval(() => { if (typeof document === "undefined" || !document.hidden) sync(true); }, CFG.pollMs);
  }
  function stop() { clearInterval(timer); timer = null; }
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => sync(true));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(true); });
  }

  /* ---------- مؤشرات صغيرة على الشاشة ---------- */
  function chipEl(id, css) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement("button"); el.type = "button"; el.id = id; el.style.cssText = css; document.body.appendChild(el); }
    return el;
  }
  function renderChip() {
    if (typeof document === "undefined" || !document.body) return;
    const el = chipEl("cloudChip", "position:fixed;bottom:calc(10px + env(safe-area-inset-bottom,0px));inset-inline-start:10px;z-index:60;border:0;border-radius:999px;padding:6px 12px;font:700 12px Tajawal,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer");
    if (!st || !user) { el.style.display = "none"; return; }
    const s = status();
    const [txt, bg, fg] = s.needLogin ? ["☁ سجّل الدخول للمزامنة", "#fbf0e0", "#a86411"]
      : !s.online ? ["☁ بدون إنترنت — سيُرفع لاحقاً", "#fbf0e0", "#a86411"]
      : s.pending ? ["☁ جاري المزامنة…", "#e3f1f7", "#1f7ea8"]
      : s.conflicts || s.rejected ? ["☁ متزامن — يحتاج مراجعة", "#fbf0e0", "#a86411"]
      : ["☁ متزامن ✓", "#e2f3eb", "#1f7a55"];
    el.textContent = txt; el.style.background = bg; el.style.color = fg; el.style.display = "";
    el.onclick = () => { const h = host(); if (h && h.openCloudPanel) h.openCloudPanel(); };
  }
  function showUpdateChip(on) {
    if (typeof document === "undefined" || !document.body) return;
    const el = chipEl("cloudUpdateChip", "position:fixed;bottom:calc(52px + env(safe-area-inset-bottom,0px));inset-inline-start:10px;z-index:61;border:0;border-radius:12px;padding:10px 14px;font:800 13px Tajawal,system-ui,sans-serif;background:#1f7ea8;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer");
    el.textContent = "🔄 تحديثات من جهاز آخر — اضغط للتحديث";
    el.style.display = on ? "" : "none";
    el.onclick = () => { if (!netUp()) { alert("لا يوجد اتصال بالإنترنت الآن — سيُطبَّق التحديث تلقائياً عند عودة الاتصال."); return; } const h = host(); if (h && h.busy() && !confirm("أكمل أو احفظ عملك المفتوح أولاً. التحديث الآن يغلق النوافذ المفتوحة. متابعة؟")) return; reloadNow(); };
  }

  /* ---------- واجهة للنظام ---------- */
  async function loadRules() {
    const rows = await api("/rest/v1/collection_rules");
    st.rules = {}; rows.forEach((r) => { st.rules[r.collection] = { r: r.read_roles, w: r.write_roles }; });
  }
  async function membership(uid) {
    const rows = await api(`/rest/v1/shop_members?select=shop_id,role,active,employee_id,display_name&user_id=eq.${uid}`);
    return rows && rows[0] ? rows[0] : null;
  }
  // بريد الدخول في السحابة: اسم المستخدم@الدومين، أو بريد المالك الشخصي إن أضافه (للاسترداد) — أو بريد مكتوب مباشرة
  function emailsFor(username) {
    const u = String(username || "").trim().toLowerCase();
    if (u.includes("@")) return [u];
    const out = [];
    try {
      const list = JSON.parse(ls.getItem("l997_employees") || "[]");
      const e = Array.isArray(list) ? list.find((x) => x && String(x.username || "").toLowerCase() === u) : null;
      if (e && e.cloudEmail) out.push(String(e.cloudEmail).toLowerCase());
    } catch (e) { /* ignore */ }
    out.push(emailOf(u));
    // «997 laundry» بدل «997-laundry»: نجرب الاسم بشرطة وبدون مسافات
    if (/\s/.test(u)) { out.push(emailOf(u.replace(/\s+/g, "-"))); out.push(emailOf(u.replace(/\s+/g, ""))); }
    return [...new Set(out)];
  }
  // كلمة مرور كُتبت والكيبورد عربي (نفس الأزرار): نحوّلها لحروف الكيبورد الإنجليزي كمحاولة ثانية
  const AR_KEYS = { "ض": "q", "ص": "w", "ث": "e", "ق": "r", "ف": "t", "غ": "y", "ع": "u", "ه": "i", "خ": "o", "ح": "p", "ج": "[", "د": "]", "ش": "a", "س": "s", "ي": "d", "ب": "f", "ل": "g", "ا": "h", "ت": "j", "ن": "k", "م": "l", "ك": ";", "ط": "'", "ئ": "z", "ء": "x", "ؤ": "c", "ر": "v", "ى": "n", "ة": "m", "و": ",", "ز": ".", "ظ": "/", "ذ": "`", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  const latinPw = (pw) => String(pw).replace(/لا/g, "b").replace(/[\u0600-\u06FF\u0660-\u0669]/g, (c) => AR_KEYS[c] || c);
  async function passwordToken(username, password) {
    let last = null;
    const pws = [password]; if (/[\u0600-\u06FF]/.test(String(password))) pws.push(latinPw(password));
    for (const pw of [...new Set(pws)]) for (const email of emailsFor(username)) {
      try { return await api("/auth/v1/token?grant_type=password", { method: "POST", auth: false, body: { email, password: pw } }); }
      catch (e) { last = e; if (e.status !== 400) throw e; if (e.data && e.data.error_code === "email_not_confirmed") throw e; }
    }
    throw last;
  }
  const verifiedTotp = (u) => ((u && u.factors) || []).filter((f) => f.factor_type === "totp" && f.status === "verified");
  async function signInRaw(username, password) {
    try {
      const s = await passwordToken(username, password);
      return { uid: keepSession(s), factors: verifiedTotp(s && s.user) };
    } catch (e) { return { error: msgOf(e) }; }
  }
  function storeDirtyAll() { COLLECTIONS.forEach((c) => { if (ls.getItem(c.key) !== null) dirty.add(c.key); }); }

  const api997 = {
    collections: COLLECTIONS.map((c) => c.name),
    isLinked: () => !!(st && st.shopId),
    emailOf,
    // تسجيل دخول الموظف في السحابة (قبل الدخول المحلي). offline → يكمل النظام بالدخول المحلي فقط
    async signIn(username, password) { return signInRaw(username, password); },
    // تحقق فقط من كلمة مرور شخص آخر (موافقة مشرف على جهاز موظف): لا تُحفظ جلسته، وتُنهى فوراً
    async verifyPassword(username, password) {
      try {
        const s = await passwordToken(username, password);
        // scope=local: يُنهي جلسة التحقق هذه فقط — بدونها يُنهي Supabase كل جلسات المشرف على كل أجهزته
        if (s && s.access_token) root.fetch(CFG.url + "/auth/v1/logout?scope=local", { method: "POST", headers: { apikey: CFG.key, Authorization: "Bearer " + s.access_token } }).catch(() => {});
        return { ok: !!(s && s.user), uid: s && s.user ? s.user.id : null };
      } catch (e) { return { error: msgOf(e) }; }
    },
    // الدخول تم (محلياً) — تبدأ المزامنة باسم هذا الموظف
    async setUser(emp) {
      userGen++;
      if (!st || !emp) { user = null; stop(); renderChip(); showUpdateChip(false); return; }
      user = { uid: emp.cloudUserId || "", role: emp.role };
      if (!user.uid || !tokens[user.uid]) needLogin = true;
      // قواعد المجموعات تُقرأ من جديد عند كل دخول (مثلاً بعد تشغيل ملف SQL يضيف مجموعة جديدة كالجلسات)
      try { const m = await membership(user.uid); if (m) user.role = m.role; await loadRules(); } catch (e) { /* offline */ }
      start(); renderChip();
    },
    // المالك يربط هذا الجهاز (وبياناته الحالية) بالسحابة لأول مرة
    async linkOwner(username, password, shopName, displayName) {
      if (!ls) return { error: "storage" };
      let uid = null;
      try { uid = keepSession(await api("/auth/v1/signup", { method: "POST", auth: false, body: { email: emailOf(username), password } })); }
      catch (e) {
        if (e.offline) return { error: "offline" };
        if (e.status === 422 || e.status === 400) { const r = await signInRaw(username, password); if (r.error) return { error: r.error === "bad-credentials" ? "exists-other-password" : r.error }; uid = r.uid; }
        else return { error: msgOf(e) };
      }
      if (!uid) return { error: "signup-failed" };
      user = { uid, role: "owner" };
      st = { shopId: null, cursor: 0, conflicts: [], rejected: [] };
      try {
        let m = await membership(uid);
        if (!m) { const shopId = await api("/rest/v1/rpc/create_shop", { method: "POST", body: { p_name: shopName || "997 Laundry", p_display_name: displayName || "" } }); m = { shop_id: shopId, role: "owner" }; }
        if (m.role !== "owner") throw new Error("not-owner");
        const existing = await api(`/rest/v1/records?select=record_id&shop_id=eq.${m.shop_id}&limit=1`);
        if (existing.length) throw new Error("cloud-has-data");
        st.shopId = m.shop_id;
        await loadRules();
        base = {}; saveBase(); saveSt();
        return { uid };
      } catch (e) {
        st = null; user = null; try { ls.removeItem(ST_KEY); } catch (e2) { /* ignore */ }
        return { error: e.offline ? "offline" : /already exists/.test(e.message) ? "shop-exists" : /not the shop owner/.test(e.message) ? "owner-not-named" : e.message };
      }
    },
    // رفع كل بيانات الجهاز (بعد linkOwner، وبعد أن يحفظ النظام رقم الحساب السحابي للمالك)
    async uploadAll(employeeId, onProgress) {
      if (!st || !user) return { error: "not-linked" };
      await api(`/rest/v1/shop_members?user_id=eq.${user.uid}`, { method: "PATCH", body: { employee_id: employeeId || null } }).catch(() => {});
      await lock();
      storeDirtyAll();
      let done = 0;
      try {
        for (const c of COLLECTIONS) {
          if (!dirty.has(c.key)) continue;
          dirty.delete(c.key);
          await pushCollection(c); saveBase(); saveSt();
          done++; if (onProgress) onProgress(done, c.name);
        }
        st.cursor = 0; stagedCursor = 0;
        await pull(); staged = new Map(); // ما رفعناه للتو يعود بنفس النسخ — لا شيء جديد
        st.cursor = stagedCursor; st.linkedAt = new Date().toISOString(); st.lastSyncAt = st.linkedAt; saveSt();
      } catch (e) { storeDirtyAll(); return { error: msgOf(e) }; } finally { busy = false; }
      start(); // بعد فك القفل — وإلا فكّ القفلُ المتأخر قفلَ أول مزامنة فتتداخل عمليتا رفع
      return { ok: true, rejected: (st.rejected || []).length };
    },
    // جهاز جديد: الدخول بحساب سحابي وتنزيل كل البيانات (يستبدل بيانات هذا الجهاز)
    async joinDevice(username, password) {
      if (!ls) return { error: "storage" };
      const r = await signInRaw(username, password);
      if (r.error) return { error: r.error };
      user = { uid: r.uid, role: "worker" };
      try {
        const m = await membership(r.uid);
        if (!m || !m.active) throw new Error("not-member");
        user.role = m.role;
        st = { shopId: m.shop_id, cursor: 0, conflicts: [], rejected: [] };
        base = {}; staged = new Map(); stagedCursor = 0;
        await loadRules();
        await pull();
        applyStaged(true);
        st.linkedAt = new Date().toISOString(); st.lastSyncAt = st.linkedAt; saveSt();
        return { uid: r.uid, role: m.role, employeeId: m.employee_id || null };
      } catch (e) {
        st = null; user = null; try { ls.removeItem(ST_KEY); ls.removeItem(BASE_KEY); } catch (e2) { /* ignore */ }
        return { error: e.offline ? "offline" : e.message };
      }
    },
    // حساب دخول لموظف جديد (يحتاج إنترنت) — يرجع رقم حسابه في السحابة
    // إرسال الإيصال عبر WhatsApp Business API (دالة whatsapp-send على Supabase — رمز Meta محفوظ هناك فقط)
    // 💬 مساعد واتساب الذكي: المحادثات (جداول wa_threads / wa_messages — supabase/whatsapp_bot.sql)
    async waThreads() {
      try { return { rows: await api(`/rest/v1/wa_threads?shop_id=eq.${st.shopId}&order=last_at.desc&limit=200`) }; }
      catch (e) { return { error: e.offline ? "offline" : e.status === 404 || /wa_threads/.test(e.message || "") ? "no-table" : e.message, status: e.status }; }
    },
    async waMessages(phone) {
      try { return { rows: await api(`/rest/v1/wa_messages?shop_id=eq.${st.shopId}&phone=eq.${encodeURIComponent(phone)}&order=at.desc&limit=80`) }; }
      catch (e) { return { error: e.offline ? "offline" : e.message, status: e.status }; }
    },
    async waThreadPatch(phone, patch) {
      try { return { rows: await api(`/rest/v1/wa_threads?shop_id=eq.${st.shopId}&phone=eq.${encodeURIComponent(phone)}`, { method: "PATCH", body: patch, headers: rep }) }; }
      catch (e) { return { error: e.offline ? "offline" : e.message, status: e.status }; }
    },
    async waBot(payload) {
      try { return await api("/functions/v1/whatsapp-bot", { method: "POST", body: payload, timeout: 45000 }); }
      catch (e) { return { error: e.offline ? "offline" : e.noSession ? "no-session" : (e.data && (e.data.error + (e.data.detail ? " — " + e.data.detail : ""))) || e.message, status: e.status }; }
    },
    async waSend(payload) {
      try { return await api("/functions/v1/whatsapp-send", { method: "POST", body: payload, timeout: 45000 }); }
      catch (e) { return { error: e.offline ? "offline" : e.noSession ? "no-session" : (e.data && (e.data.error + (e.data.detail ? " — " + e.data.detail : ""))) || e.message, status: e.status }; }
    },
    // صفحة الإيصال العامة: يقرأ إيصالاً واحداً برمزه السري (بدون حساب)
    async publicReceipt(token) {
      try { return { model: await api("/rest/v1/rpc/public_receipt", { method: "POST", auth: false, body: { p_token: String(token || "") } }) }; }
      catch (e) { return { error: e.offline ? "offline" : e.message }; }
    },
    async createStaff(username, tempPassword, role, displayName, employeeId) {
      try {
        const s = await api("/auth/v1/signup", { method: "POST", auth: false, body: { email: emailOf(username), password: tempPassword } });
        const uid = s && s.user ? s.user.id : null; // لا نحتفظ بجلسته — الموظف يدخل بنفسه
        if (!uid) return { error: "signup-failed" };
        await api("/rest/v1/shop_members", { method: "POST", body: { shop_id: st.shopId, user_id: uid, role, display_name: displayName || "", employee_id: employeeId || null } });
        return { uid };
      } catch (e) { return { error: e.status === 422 ? "username-taken" : msgOf(e) }; }
    },
    async updateMember(uid, patch) {
      try { await api(`/rest/v1/shop_members?user_id=eq.${uid}`, { method: "PATCH", headers: rep, body: patch }); return { ok: true }; }
      catch (e) { return { error: msgOf(e) }; }
    },
    async resetPassword(uid, password) {
      try { await api("/rest/v1/rpc/set_member_password", { method: "POST", body: { p_user: uid, p_password: password } }); return { ok: true }; }
      catch (e) { return { error: msgOf(e) }; }
    },
    // ---------- التحقق بخطوتين (MFA / TOTP — Google Authenticator) — السر محفوظ في Supabase فقط ----------
    async mfaFactors(uid) {
      try { const u = await api("/auth/v1/user", { as: uid }); return { factors: verifiedTotp(u), all: (u && u.factors) || [] }; }
      catch (e) { return { error: msgOf(e) }; }
    },
    async mfaEnroll(uid, label) {
      try {
        const f = await api("/auth/v1/factors", { method: "POST", as: uid, body: { factor_type: "totp", friendly_name: (label || "997 Laundry") + " " + Date.now().toString(36), issuer: "997 Laundry" } });
        return { id: f.id, qr: f.totp && f.totp.qr_code, secret: f.totp && f.totp.secret, uri: f.totp && f.totp.uri };
      } catch (e) { return { error: msgOf(e) }; }
    },
    // يتحقق من الرمز (6 أرقام) — عند النجاح تصبح الجلسة بمستوى التحقق الثاني (aal2)
    async mfaVerify(uid, factorId, code) {
      try {
        const ch = await api(`/auth/v1/factors/${factorId}/challenge`, { method: "POST", as: uid, body: {} });
        const s = await api(`/auth/v1/factors/${factorId}/verify`, { method: "POST", as: uid, body: { challenge_id: ch.id, code: String(code || "").replace(/\D/g, "") } });
        if (s && s.access_token) { if (!s.user) s.user = { id: uid }; keepSession(s); }
        return { ok: true };
      } catch (e) { return { error: e.status === 422 || e.status === 400 ? "bad-code" : msgOf(e) }; }
    },
    async mfaRemove(uid, factorId) {
      try { await api(`/auth/v1/factors/${factorId}`, { method: "DELETE", as: uid }); return { ok: true }; }
      catch (e) { return { error: msgOf(e) }; }
    },
    // خروج المستخدم: رفع آخر التغييرات (سجل الخروج ونهاية الجلسة)، ثم إبطال جلسته على الخادم، ثم إيقاف المزامنة
    async endUser(uid) {
      const gen = ++userGen;
      try { await sync(false); } catch (e) { /* offline */ }
      if (gen !== userGen) return; // دخل مستخدم آخر في الأثناء
      await api997.signOut(uid);
      if (gen !== userGen) return;
      user = null; stop(); renderChip(); showUpdateChip(false);
    },
    // تسجيل الخروج: إبطال جلسة السحابة على الخادم (رمز التحديث لا يعود صالحاً) وحذفها من الجهاز
    async signOut(uid) {
      const t = uid && tokens[uid];
      if (!t) return { ok: true };
      // scope=local: جلسة هذا الجهاز فقط (الأجهزة الأخرى لنفس المستخدم تبقى)
      try { if (online) await api("/auth/v1/logout?scope=local", { method: "POST", bearer: t.a, body: {} }); } catch (e) { /* offline / expired: يُحذف محلياً على أي حال */ }
      delete tokens[uid]; saveTok();
      if (user && user.uid === uid) needLogin = true;
      return { ok: true };
    },
    // بريد استرداد كلمة المرور (للمالك): يصبح بريد الدخول في السحابة، فيصل إليه رابط «نسيت كلمة المرور»
    async setRecoveryEmail(email, uid) {
      try {
        const u = await api("/auth/v1/user", { method: "PUT", body: { email: String(email).trim().toLowerCase() }, as: uid });
        const applied = u && String(u.email || "").toLowerCase() === String(email).trim().toLowerCase();
        return { ok: true, pending: !applied };
      } catch (e) { return { error: e.status === 422 ? "email-taken" : msgOf(e) }; }
    },
    // يرسل رابط استرداد إلى البريد (من شاشة الدخول — بدون حساب). الرابط يعود إلى النظام لتعيين كلمة مرور جديدة
    async sendRecovery(email, redirectTo) {
      try { await api("/auth/v1/recover" + (redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : ""), { method: "POST", auth: false, body: { email: String(email).trim().toLowerCase() } }); return { ok: true }; }
      catch (e) { return { error: e.status === 429 ? "rate-limit" : msgOf(e) }; }
    },
    // بعد فتح رابط الاسترداد: كلمة المرور الجديدة بالرمز الذي في الرابط
    async completeRecovery(token, password) {
      try {
        await api("/auth/v1/user", { method: "PUT", body: { password }, bearer: token });
        const u = await api("/auth/v1/user", { bearer: token });
        return { ok: true, uid: u && u.id, email: u && u.email };
      } catch (e) { return { error: e.status === 401 || e.status === 403 ? "link-expired" : msgOf(e) }; }
    },
    async changeOwnPassword(password, uid) {
      try { await api("/auth/v1/user", { method: "PUT", body: { password }, as: uid }); return { ok: true }; }
      catch (e) { return { error: msgOf(e) }; }
    },
    // رقم الطلب التالي من السحابة لحظة الحفظ — رقم واحد بالتسلسل بين كل الأجهزة (بدون كتل وبدون فجوات).
    // null = لا إنترنت (ينتظر حتى 6 ثوانٍ) → يستخدم النظام الترقيم المحلي
    async reserveNumber(min) {
      if (!st || !st.shopId || !user) return null;
      const call = api("/rest/v1/rpc/reserve_order_numbers", { method: "POST", body: { p_count: 1, p_min: Math.max(1, Number(min) || 1, localMaxNumber() + 1) } }).then((n) => Number(n) || null).catch(() => null);
      return Promise.race([call, new Promise((r) => setTimeout(() => r(null), 6000))]);
    },
    // بعد إعادة ترتيب الأرقام: الرقم التالي في السحابة = بعد آخر رقم (للمالك فقط؛ لا ينزل تحت أي رقم موجود)
    async setOrderCounter(next) {
      try { return { next: Number(await api("/rest/v1/rpc/set_order_counter", { method: "POST", body: { p_next: Math.max(1, Number(next) || 1) } })) }; }
      catch (e) { return { error: msgOf(e) }; }
    },
    syncNow: () => sync(true),
    applyNow: () => { if (staged.size) reloadNow(); },
    status,
    // يُفك ربط هذا الجهاز فقط (البيانات تبقى في السحابة وعلى الجهاز)
    unlink() { stop(); st = null; user = null; base = {}; staged = new Map(); dirty.clear(); try { ["l997_cloud", "l997_cloud_base", "l997_cloud_tokens"].forEach((k) => ls.removeItem(k)); } catch (e) { /* ignore */ } renderChip(); showUpdateChip(false); },
    // بعد مراجعة المالك: مسح قائمة التعارضات والرفض من اللوحة
    clearNotes() { if (st) { st.conflicts = []; st.rejected = []; saveSt(); renderChip(); } },
    _debug: () => ({ dirty: [...dirty], staged: staged.size, cursor: st && st.cursor, stagedCursor }),
  };
  function status() {
    return {
      linked: !!(st && st.shopId), signedIn: !!user, needLogin, online, receiptLinks,
      // ما لا يملك المستخدم رفعه (صلاحيات) لا يُعدّ «معلّقاً»
      pending: [...dirty].filter((k) => byKey[k] && canWrite(byKey[k]) && serverKnows(byKey[k])).length,
      sessionsSync: !st || !st.rules ? null : !!st.rules.sessions, incoming: staged.size,
      clockSkewMin: clockSkewMs === null ? null : Math.round(clockSkewMs / 60000), lastSyncAt: st ? st.lastSyncAt : null, linkedAt: st ? st.linkedAt : null, lastError,
      conflicts: st && st.conflicts ? st.conflicts.length : 0, rejected: st && st.rejected ? st.rejected.length : 0,
      conflictList: st && st.conflicts ? st.conflicts.slice(0, 20) : [], rejectedList: st && st.rejected ? st.rejected.slice(0, 20) : [],
    };
  }
  root.L997Cloud = api997;
})(typeof self !== "undefined" ? self : this);
