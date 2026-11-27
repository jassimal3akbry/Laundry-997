// Owner password recovery by email + "has a login" badge for staff who log in on other devices (cloud stand-in).
// Usage: node tests/e2e.recovery.js [path-to-html]   (needs a local PostgreSQL server, run as root)
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const { startStandin } = require("./supabase-standin");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ").slice(0, 220) : ""}`);
  if (!cond) failures++;
}
const OWNER_PW = "Owner#2026pass", NEW_PW = "Fresh#2027pass", NEW_PW2 = "Again#2028pass", WORKER_PW = "Worker#2026new", MAIL = "jassim.owner@gmail.com";

(async () => {
  const cloud = await startStandin({ latencyMs: 40 });
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  async function device(tag) {
    const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
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
  });
  const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 300)); } return false; };
  const login = async (P, user, pw) => { await P.fill("#au_user", user); await P.fill("#au_pass", pw); await P.click("#au_form button[type=submit]"); };
  const logout = async (P) => { await P.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())); await P.click("#logoutBtn"); await P.waitForTimeout(400); if (await P.isVisible("#quickFormSubmitBtn")) { await P.click("#quickFormSubmitBtn"); await P.waitForTimeout(300); } await P.waitForSelector("#au_user"); };

  /* owner A: shop + cloud + a worker who logs in on device B */
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
  const B = await device("B"); const b = H(B);
  await B.goto(url); await B.waitForSelector("#au_cloud_join"); await B.click("#au_cloud_join");
  await B.fill("#au_user", "yaseen"); await B.fill("#au_pass", tempPw);
  await Promise.all([B.waitForEvent("load", { timeout: 40000 }), B.click("#au_form button[type=submit]")]);
  await B.waitForSelector("#au_user"); await b.wait(150); await login(B, "yaseen", tempPw);
  await B.waitForSelector("#au_pw2"); await b.wait(150);
  await B.fill("#au_pw", WORKER_PW); await B.fill("#au_pw2", WORKER_PW); await B.click("#au_form button[type=submit]");
  await B.waitForSelector("body:not(.auth-locked)");

  /* 1) owner's device: Yaseen logged in elsewhere → "has a login", not "no login" */
  await until(async () => ((await a.ls("l997_employees")) || []).some((e) => e.username === "yaseen" && e.lastLogin), 25000);
  // like the shop: Yaseen's password lives on his own device only (the owner's device has none for him)
  await A.evaluate(() => { const l = JSON.parse(localStorage.getItem("l997_employees")); l.forEach((e) => { if (e.username === "yaseen") { delete e.passHash; delete e.salt; } }); localStorage.setItem("l997_employees", JSON.stringify(l)); });
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)"); await a.wait(600); await a.closeAll();
  const yA = ((await a.ls("l997_employees")) || []).find((e) => e.username === "yaseen");
  check("owner's device has no copy of Yaseen's password", yA && !yA.passHash);
  await a.nav("employees"); await a.wait(400);
  const rowE = await A.evaluate(() => { const r = [...document.querySelectorAll("#page-employees tr")].find((tr) => /Yaseen/.test(tr.textContent)); return r ? r.textContent : ""; });
  check("employees page: Yaseen shows «has a login»", /له حساب دخول/.test(rowE) && !/بدون دخول/.test(rowE), rowE.replace(/\s+/g, " ").slice(0, 120));
  await a.nav("access"); await a.wait(400);
  const rowU = await A.evaluate(() => { const r = [...document.querySelectorAll("#page-access tr")].find((tr) => /Yaseen/.test(tr.textContent)); return r ? r.textContent : ""; });
  check("users & permissions: Yaseen is not marked «no login»", rowU && !/بدون حساب دخول/.test(rowU), rowU.replace(/\s+/g, " ").slice(0, 120));

  /* 2) owner adds a recovery email (asks for the current password) */
  await a.nav("profile"); await a.wait(300);
  await A.click("#cloudEmailBtn"); await A.fill("#qf_email", MAIL); await A.fill("#qf_pw", "wrong-pass1"); await A.click("#quickFormSubmitBtn"); await a.wait(300);
  check("wrong current password → email not saved", (await cloud.query("select 1 from auth.users where email = $1", [MAIL])).rowCount === 0 && await A.isVisible("#quickFormSubmitBtn"));
  // like the video: this device's copy of the owner's password is out of date (changed on another device)
  await a.closeAll();
  await A.evaluate(() => { const l = JSON.parse(localStorage.getItem("l997_employees")); const o = l.find((e) => e.username === "owner"); o.passHash = "0".repeat(64); localStorage.setItem("l997_employees", JSON.stringify(l)); });
  await A.reload(); await A.waitForSelector("body:not(.auth-locked)"); await a.wait(600); await a.closeAll();
  await a.nav("profile"); await a.wait(300); await A.click("#cloudEmailBtn"); await A.fill("#qf_email", MAIL);
  check("current-password field is marked as such (browsers don't offer a «new password» there)", (await A.getAttribute("#qf_pw", "autocomplete")) === "current-password");
  await A.fill("#qf_pw", OWNER_PW); await A.click("#quickFormSubmitBtn"); await a.wait(1200);
  check("recovery email saved as the owner's cloud email", (await cloud.query("select 1 from auth.users where email = $1", [MAIL])).rowCount === 1);
  check("…shown in the cloud panel and recorded in the activity log", /jassim\.owner@gmail\.com/.test(await A.textContent("#cloudPanel")) && (await a.ls("l997_audit")).some((x) => /بريد استرداد/.test(x.action || "")));
  check("…and reaches the other devices (employee record)", await until(async () => ((await b.ls("l997_employees")) || []).some((e) => e.username === "owner" && e.cloudEmail === MAIL), 25000));

  /* 3) the owner still signs in with the username */
  await logout(A); await login(A, "owner", OWNER_PW); await A.waitForSelector("body:not(.auth-locked)", { timeout: 15000 }).catch(() => {});
  check("after adding the email the owner still signs in with «owner» + password", await A.evaluate(() => !document.body.classList.contains("auth-locked")));

  /* 4) forgot password → email link → new password (same device) */
  await logout(A); await A.click("#au_forgot"); await a.wait(200);
  const before = cloud.outbox.length;
  await A.fill("#au_email", "someone.else@gmail.com"); await A.click("#au_email_send"); await a.wait(600);
  check("unknown email: same neutral message, no email sent", await A.isVisible("#au_email_ok") && cloud.outbox.length === before);
  await A.fill("#au_email", MAIL); await A.click("#au_email_send"); await a.wait(800);
  const mail = cloud.outbox[cloud.outbox.length - 1];
  check("owner's email receives a reset link back to the system", mail && mail.to === MAIL && mail.link.startsWith(new URL(url).origin) && /type=recovery/.test(mail.link), mail && mail.link.slice(0, 80));
  await A.goto(mail.link); await a.wait(800);
  check("opening the link shows «set a new password» (link removed from the address bar)", await A.isVisible("#au_pw2") && /تعيين كلمة مرور جديدة/.test(await A.textContent("#authCard")) && !(await A.evaluate(() => location.hash)), await A.evaluate(() => location.hash));
  await A.fill("#au_pw", "short"); await A.fill("#au_pw2", "short"); await A.click("#au_form button[type=submit]"); await a.wait(300);
  check("weak new password refused", await A.isVisible("#au_pw2") && (await A.textContent("#au_err")).length > 0);
  await A.fill("#au_pw", NEW_PW); await A.fill("#au_pw2", NEW_PW); await A.click("#au_form button[type=submit]"); await a.wait(1200);
  check("new password saved → back to the sign-in screen", await A.isVisible("#au_user") && !(await A.isVisible("#au_pw2")));
  await login(A, "owner", OWNER_PW); await a.wait(1500);
  check("old password no longer works", await A.evaluate(() => document.body.classList.contains("auth-locked")));
  await login(A, "owner", NEW_PW); await A.waitForSelector("body:not(.auth-locked)", { timeout: 15000 }).catch(() => {});
  check("new password works", await A.evaluate(() => !document.body.classList.contains("auth-locked")));

  /* 5) the link opened on a brand-new device → set password → download the shop with the email */
  await logout(A); await A.click("#au_forgot"); await A.fill("#au_email", MAIL); await A.click("#au_email_send"); await a.wait(800);
  const mail2 = cloud.outbox[cloud.outbox.length - 1];
  const C = await device("C"); const c = H(C);
  await C.goto(mail2.link); await c.wait(800);
  await C.fill("#au_pw", NEW_PW2); await C.fill("#au_pw2", NEW_PW2); await C.click("#au_form button[type=submit]"); await c.wait(1200);
  check("new device: after the new password it offers «sign in from the cloud» with the email filled in", (await C.inputValue("#au_user").catch(() => "")) === MAIL);
  await C.fill("#au_pass", NEW_PW2);
  await Promise.all([C.waitForEvent("load", { timeout: 40000 }), C.click("#au_form button[type=submit]")]);
  await C.waitForSelector("#au_user"); await c.wait(300);
  await login(C, MAIL, NEW_PW2); await C.waitForSelector("body:not(.auth-locked)", { timeout: 20000 }).catch(() => {});
  check("…shop downloaded and the owner signs in on the new device with email + new password", await C.evaluate(() => !document.body.classList.contains("auth-locked")) && ((await c.ls("l997_employees")) || []).some((e) => e.username === "yaseen"));

  /* 6) the worker is unaffected */
  await logout(B); await login(B, "yaseen", WORKER_PW); await B.waitForSelector("body:not(.auth-locked)", { timeout: 15000 }).catch(() => {});
  check("worker still signs in normally", await B.evaluate(() => !document.body.classList.contains("auth-locked")));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close(); await cloud.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL RECOVERY CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
