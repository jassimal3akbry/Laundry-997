// Security center (cloud stand-in): login attempts with user/date/time/device, failed-login lock + alerts that reach the
// owner, active sessions with remote sign-out, cloud session revoked at sign-out, two-step verification (TOTP) for admin
// accounts (optional / required), tamper-evident audit log (hash chain) + server refuses audit edits, filters + search.
// Usage: node tests/e2e.security.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\s+/g, " ").slice(0, 220) : ""}`);
  if (!cond) failures++;
}
const OWNER_PW = "Owner#2026pass", WORKER_PW = "Worker#2026new";

(async () => {
  const cloud = await startStandin({ latencyMs: 30 });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag, ua) {
    const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, ...(ua ? { userAgent: ua } : {}) })).newPage();
    page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((cfg) => { window.__L997_CLOUD_CONFIG = cfg; window.open = () => ({ closed: false }); }, { url: cloud.url, key: "k" });
    return page;
  }
  const H = (P) => ({
    wait: (ms) => P.waitForTimeout(ms),
    nav: (pg) => P.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg),
    closeAll: () => P.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())),
    ls: (k) => P.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k),
    status: () => P.evaluate(() => window.L997Cloud.status()),
    locked: () => P.evaluate(() => document.body.classList.contains("auth-locked")),
  });
  const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 300)); } return false; };
  const login = async (P, user, pw) => { await P.fill("#au_user", user); await P.fill("#au_pass", pw); await P.click("#au_form button[type=submit]"); await P.waitForTimeout(500); };
  const logout = async (P) => { await P.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())); await P.click("#logoutBtn"); await P.waitForTimeout(400); if (await P.isVisible("#quickFormSubmitBtn")) { await P.click("#quickFormSubmitBtn"); await P.waitForTimeout(300); } await P.waitForSelector("#au_user"); };
  const tab = async (P, t) => { await P.evaluate(() => document.querySelector('.nav-item[data-page="security"]').click()); await P.waitForTimeout(200); await P.click(`[data-sec-tab="${t}"]`); await P.waitForTimeout(250); };
  const rows = (P) => P.$$eval("#securityRoot tbody tr", (trs) => trs.map((tr) => tr.textContent.replace(/\s+/g, " ").trim()).filter((x) => !/لا توجد/.test(x)));

  /* owner A + worker Yaseen on an Android tablet B */
  const A = await device("A"); const a = H(A);
  await A.goto(url);
  await A.fill("#au_name", "Owner"); await A.fill("#au_user", "owner"); await A.fill("#au_pw", OWNER_PW); await A.fill("#au_pw2", OWNER_PW);
  await A.click("#au_form button[type=submit]"); await A.check("#au_saved"); await A.click("#au_next"); await A.waitForSelector("body:not(.auth-locked)");
  await a.nav("profile"); await A.click("#cloudLinkBtn"); await A.fill("#qf_pw", OWNER_PW); await A.fill("#qf_c", "رفع"); await A.click("#quickFormSubmitBtn");
  check("A linked to the cloud", await until(async () => (await a.status()).linked && (await a.status()).pending === 0));
  await until(async () => !(await A.evaluate(() => { const b = document.getElementById("quickFormSubmitBtn"); return document.getElementById("quickFormDialog").open && b.disabled; })));
  await a.wait(1200); await a.closeAll();
  await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Yaseen"); await A.selectOption("#qf_role", "worker"); await A.fill("#qf_username", "yaseen");
  const tempPw = await A.inputValue("#qf_password"); await A.click("#quickFormSubmitBtn");
  await until(async () => (await cloud.query("select 1 from auth.users where email = 'yaseen@997laundry.app'")).rowCount === 1);
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {});
  await a.wait(1200); await a.closeAll();
  const B = await device("B", "Mozilla/5.0 (Linux; Android 13; Active 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"); const b = H(B);
  await B.goto(url); await B.waitForSelector("#au_cloud_join"); await B.click("#au_cloud_join");
  await B.fill("#au_user", "yaseen"); await B.fill("#au_pass", tempPw);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await b.wait(150); await login(B, "yaseen", tempPw);
  await B.waitForSelector("#au_pw2"); await b.wait(150);
  await B.fill("#au_pw", WORKER_PW); await B.fill("#au_pw2", WORKER_PW); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("body:not(.auth-locked)");

  /* 1) failed logins on the tablet: limited, logged with user/time/device, alert reaches the owner */
  await logout(B);
  for (let i = 0; i < 3; i++) await login(B, "yaseen", "wrong-pass" + i);
  const left = await B.textContent("#au_err");
  check("wrong password: refused with attempts left", /محاولة|تبقى|متبق/.test(left) || left.length > 0, left);
  await login(B, "yaseen", WORKER_PW); await B.waitForSelector("body:not(.auth-locked)", { timeout: 15000 });
  check("security log reaches the owner (audit synced)", await until(async () => ((await a.ls("l997_audit")) || []).some((x) => x.meta && x.meta.sec === "alert" && /yaseen/.test(x.action)), 30000));
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)"); await a.wait(1500); await a.closeAll();
  const badge = await A.evaluate(() => { const b = document.querySelector('.nav-item[data-page="security"] .sec-badge'); return b ? Number(b.textContent) : 0; });
  check("owner's menu shows a red security badge", badge >= 1, badge);
  await tab(A, "logins");
  let r = await rows(A);
  const failRow = r.find((x) => /دخول فاشل/.test(x) && /yaseen/.test(x));
  check("login attempts: failed attempt with user, username, date/time and device (Android tablet · Chrome)", !!failRow && /Android tablet · Chrome/.test(failRow) && /٢٠٢٦|2026/.test(failRow), failRow);
  check("login attempts: successful logins listed too", r.some((x) => /دخول ناجح/.test(x) && /Yaseen/.test(x)));
  await A.selectOption("#secType", "login_fail"); await a.wait(200);
  r = await rows(A);
  check("filter by type (failed only)", r.length >= 3 && r.every((x) => /دخول فاشل|قفل/.test(x)), r.length);
  await A.selectOption("#secUser", "Owner"); await a.wait(200);
  check("filter by user (Owner has no failed logins)", (await rows(A)).length === 0);
  await A.click("#secClear"); await a.wait(200);
  const tomorrow = await A.evaluate(() => { const d = new Date(Date.now() + 86400000 * 2); return d.toISOString().slice(0, 10); });
  await A.fill("#secFrom", tomorrow); await A.dispatchEvent("#secFrom", "change"); await a.wait(200);
  check("filter by date (from the day after tomorrow → nothing)", (await rows(A)).length === 0);
  await A.click("#secClear"); await a.wait(150);
  await A.fill("#secQ", "Android"); await a.wait(250);
  check("search box", (await rows(A)).length >= 1 && (await rows(A)).every((x) => /Android/.test(x)));
  await A.click("#secClear"); await a.wait(150);
  await tab(A, "alerts");
  r = await rows(A);
  check("alerts tab: «repeated failed logins for yaseen» with severity «risk»", r.some((x) => /محاولات دخول فاشلة متكررة/.test(x) && /خطر/.test(x)), r[0]);
  await a.wait(5500); await A.evaluate(() => document.querySelector('.nav-item[data-page="dashboard"]').click()); await a.wait(1500);
  check("opening the alerts marks them as seen (badge cleared)", await A.evaluate(() => !document.querySelector('.nav-item[data-page="security"] .sec-badge')));

  /* 2) active sessions + remote sign-out */
  await tab(A, "sessions");
  check("active sessions: Yaseen on the Android tablet is listed as active", await until(async () => { await tab(A, "sessions"); return (await rows(A)).some((x) => /Yaseen/.test(x) && /Android tablet/.test(x) && /نشطة/.test(x)); }, 25000));
  const tokB = await B.evaluate(() => JSON.parse(localStorage.getItem("l997_cloud_tokens") || "{}"));
  const oldBearer = Object.values(tokB)[0] && Object.values(tokB)[0].a;
  await A.click('[data-sess-revoke]'); await A.click("#quickFormSubmitBtn"); await a.wait(300);
  check("owner ends Yaseen's session → the tablet signs out by itself", await until(() => b.locked(), 30000));
  check("…with the notice that the session ended", /انته|أُنهي|إنهاء|revoked|الجلسة/.test(await B.textContent("#authCard")), (await B.textContent("#authCard")).slice(0, 80));
  await tab(A, "sessions");
  check("…and the session shows «revoked» with who ended it", (await rows(A)).some((x) => /Yaseen/.test(x) && /أُبطلت/.test(x) && /Owner/.test(x)));
  const oldUse = await A.evaluate(async ([u, t]) => { const r0 = await fetch(u + "/rest/v1/records?select=record_id&limit=1", { headers: { apikey: "k", Authorization: "Bearer " + t } }); return r0.status; }, [cloud.url, oldBearer]);
  check("the tablet's cloud session is invalid on the server after sign-out", oldUse === 401 || oldUse === 403, oldUse);
  await login(B, "yaseen", WORKER_PW); await B.waitForSelector("body:not(.auth-locked)", { timeout: 15000 }).catch(() => {});
  check("Yaseen can sign in again normally (new session)", !(await b.locked()));
  const forged = await B.evaluate(async (u) => {
    const tok = Object.values(JSON.parse(localStorage.getItem("l997_cloud_tokens") || "{}"))[0].a;
    const shop = JSON.parse(localStorage.getItem("l997_cloud")).shopId;
    const r0 = await fetch(u + "/rest/v1/records", { method: "POST", headers: { apikey: "k", Authorization: "Bearer " + tok, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify([{ shop_id: shop, collection: "sessions", record_id: "forged1", data: { id: "forged1", uid: "someone-else", name: "Owner" } }]) });
    return r0.status;
  }, cloud.url);
  check("server: a worker cannot write a session for another user", forged >= 400, forged);

  /* 3) two-step verification for the owner */
  await a.closeAll(); await a.nav("access"); await a.wait(300);
  await A.click("#secMfaOnBtn"); await A.waitForSelector("#au_mfa_secret", { timeout: 10000 });
  const secret = (await A.textContent("#au_mfa_secret")).replace(/\s+/g, "");
  await A.fill("#au_code", "000000"); await A.click("#au_form button[type=submit]"); await a.wait(400);
  check("MFA setup: wrong code refused", await A.isVisible("#au_mfa_secret") && (await A.textContent("#au_err")).length > 0);
  await A.fill("#au_code", cloud.totpNow(secret)); await A.click("#au_form button[type=submit]"); await a.wait(800);
  check("MFA turned on for the owner (scan / key + 6-digit code)", !(await a.locked()) && ((await a.ls("l997_employees")) || []).find((e) => e.username === "owner").mfaOn === true);
  await logout(A); await login(A, "owner", OWNER_PW);
  check("sign-in now asks for the 6-digit code after the password", await A.isVisible("#au_code") && /التحقق بخطوتين/.test(await A.textContent("#authCard")));
  await A.fill("#au_code", "123456"); await A.click("#au_form button[type=submit]"); await a.wait(500);
  check("wrong code → not signed in, logged as «mfa_fail»", await a.locked() && ((await a.ls("l997_audit")) || []).some((x) => x.meta && x.meta.sec === "mfa_fail"));
  await A.fill("#au_code", cloud.totpNow(secret)); await A.click("#au_form button[type=submit]"); await a.wait(800);
  check("correct code → signed in", !(await a.locked()));
  await tab(A, "sessions");
  check("the owner's session is marked as verified with 🔐", (await rows(A)).some((x) => /هذه الجلسة/.test(x) && /🔐/.test(x)));
  // «remember this device» (ticked by default): the next sign-in on this device does not ask for the code
  await logout(A); await login(A, "owner", OWNER_PW); await a.wait(700);
  check("trusted device: signing in again on this device skips the code", !(await a.locked()) && !(await A.isVisible("#au_code")));
  check("…and the sign-in is logged as «trusted device»", ((await a.ls("l997_audit")) || []).some((x) => x.meta && x.meta.sec === "login_ok" && /جهاز موثوق/.test(x.text || x.action || JSON.stringify(x))));
  const ownerRec = ((await a.ls("l997_employees")) || []).find((e) => e.username === "owner");
  check("the trusted device is recorded on the account (synced, can be revoked remotely)", (ownerRec.mfaTrust || []).length === 1 && ownerRec.mfaTrust[0].until > Date.now() + 29 * 864e5);
  // another device's sync overwrote the account's trusted-device list (what happened on the shop Mac) → still trusted
  await A.evaluate(() => { const em = JSON.parse(localStorage.getItem("l997_employees")); em.find((e) => e.username === "owner").mfaTrust = []; localStorage.setItem("l997_employees", JSON.stringify(em)); });
  await A.reload(); await A.waitForSelector("#au_user, body:not(.auth-locked)");
  if (!(await a.locked())) await logout(A);
  await login(A, "owner", OWNER_PW); await a.wait(700);
  check("trust survives another device overwriting the account's device list (no code asked)", !(await a.locked()) && !(await A.isVisible("#au_code")));
  await a.closeAll(); await tab(A, "overview"); await a.wait(200);
  await A.click("[data-forget-trust]"); await a.wait(200); await A.click("#quickFormSubmitBtn"); await a.wait(300);
  await logout(A); await login(A, "owner", OWNER_PW);
  check("after the owner revokes trusted devices in the Security Center, the code is asked again", await A.isVisible("#au_code"));
  await A.uncheck("#au_trust"); await A.fill("#au_code", cloud.totpNow(secret)); await A.click("#au_form button[type=submit]"); await a.wait(800);
  await logout(A); await login(A, "owner", OWNER_PW);
  check("unticking «remember this device» keeps asking for the code", await A.isVisible("#au_code"));
  await A.fill("#au_code", cloud.totpNow(secret)); await A.uncheck("#au_trust"); await A.click("#au_form button[type=submit]"); await a.wait(800);
  // require MFA for admin accounts
  await a.nav("access"); await a.wait(300);
  await A.check("#secMfaReq"); await A.click("#secSaveBtn"); await a.wait(400);
  check("owner turns on «MFA required for admin accounts»", (await a.ls("l997_security")).mfaRequired === true);
  await a.nav("access"); await A.click("#accessAddUserBtn");
  await A.fill("#qf_name", "Manager One"); await A.selectOption("#qf_role", "manager"); await A.fill("#qf_username", "manager1");
  const mgrPw = await A.inputValue("#qf_password"); await A.click("#quickFormSubmitBtn");
  await until(async () => (await cloud.query("select 1 from auth.users where email = 'manager1@997laundry.app'")).rowCount === 1);
  await A.waitForFunction(() => !document.getElementById("quickFormSubmitBtn").disabled, null, { timeout: 15000 }).catch(() => {});
  await a.wait(1200); await a.closeAll();
  await logout(A); await login(A, "manager1", mgrPw);
  if (await A.isVisible("#au_pw2")) { await A.fill("#au_pw", "Manager#2026x"); await A.fill("#au_pw2", "Manager#2026x"); await A.click("#au_form button[type=submit]"); await a.wait(800); }
  check("manager signing in is forced to set up MFA first (cannot skip into the system)", await A.isVisible("#au_mfa_qr") && await a.locked());
  await B.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  check("worker accounts are not asked for MFA", !(await b.locked()));

  /* 4) tamper-evident audit log */
  await A.goto(url); await A.waitForSelector("#au_user");
  await login(A, "owner", OWNER_PW); await A.fill("#au_code", cloud.totpNow(secret)); await A.click("#au_form button[type=submit]"); await A.waitForSelector("body:not(.auth-locked)");
  await a.closeAll(); await tab(A, "overview"); await A.click("#secVerify"); await a.wait(300);
  check("audit integrity check: all entries intact", /السجل سليم/.test(await A.textContent("#securityRoot")), (await A.textContent("#securityRoot")).match(/السجل سليم[^.]*/));
  await A.evaluate(() => { const l = JSON.parse(localStorage.getItem("l997_audit")); const i = l.findIndex((x) => x.h && /تسجيل دخول/.test(x.action)); l[i].action = "تعديل مزوّر"; l.splice(i + 2, 1); localStorage.setItem("l997_audit", JSON.stringify(l)); });
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)"); await a.wait(500); await a.closeAll();
  await tab(A, "overview"); await A.click("#secVerify"); await a.wait(300);
  const v = await A.textContent("#securityRoot");
  check("…an edited entry and a deleted entry are detected", /1<\/b>|1 قيد معدّل|قيد معدّل/.test(v) && /فجوة/.test(v), (v.match(/⚠[^—]*/) || [""])[0]);
  const patch = await A.evaluate(async (u) => {
    const tok = Object.values(JSON.parse(localStorage.getItem("l997_cloud_tokens") || "{}"))[0].a;
    const r0 = await fetch(u + "/rest/v1/records?collection=eq.audit", { method: "PATCH", headers: { apikey: "k", Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) });
    return r0.status;
  }, cloud.url);
  check("server: even the owner cannot edit or delete audit entries", patch >= 400, patch);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL SECURITY CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
