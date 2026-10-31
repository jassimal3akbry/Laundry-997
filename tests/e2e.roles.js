// Roles + backup test: worker account limits, supervisor override, backup export → restore round trip.
// Usage: node tests/e2e.roles.js [path-to-html]
const path = require("path");
const fs = require("fs");
const os = require("os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await require("./fixed-prices")(page); // flow test: fixed test prices, independent of the shop's price list
  await page.goto(await serve(file));
  const OWNER_PW = "Owner#2026pass", WORKER_PW = "Worker#2026pass";
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const later = async () => { await page.waitForTimeout(250); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); } };
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeDialogs = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));

  // Owner setup
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", OWNER_PW); await page.fill("#au_pw2", OWNER_PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  // Owner creates a worker account
  await nav("access");
  await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Worker One");
  await page.selectOption("#qf_role", "worker");
  await page.fill("#qf_username", "worker1");
  const tempPw = await page.inputValue("#qf_password");
  await submit();
  await later(); // credentials notice
  const emps = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_employees")));
  check("worker account created", emps.some((e) => e.username === "worker1" && e.role === "worker" && e.passHash && e.passHash !== tempPw), tempPw ? "temp pw issued" : "no pw");
  check("passwords are stored hashed, never in plain text", !JSON.stringify(emps).includes(tempPw) && !JSON.stringify(emps).includes(OWNER_PW));

  // Owner seeds a customer and an order
  await nav("new-order");
  await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33001122");
  await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Ali"); await page.fill("#customerPhone", "33001122"); await page.click("#saveCustomerBtn");
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="shirt"]');
  await page.click("#posSaveOrderMainBtn"); await later();

  // Export a backup (real download)
  await nav("profile");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBackupBtn")]);
  const backupPath = path.join(os.tmpdir(), "l997-roles-backup.json");
  await dl.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  check("backup contains orders, customers, employees", ["l997_orders", "l997_customers", "l997_employees"].every((k) => backup.data[k]));

  // Log out, log in as worker, change temp password
  await closeDialogs();
  await page.click("#logoutBtn");
  await page.waitForSelector("#au_user"); await page.waitForTimeout(150); // let the login screen finish its auto-focus
  await page.fill("#au_user", "worker1"); await page.fill("#au_pass", tempPw);
  await page.click("#au_form button[type=submit]");
  await page.waitForSelector("#au_pw2"); await page.waitForTimeout(150); // let the change-password screen finish its auto-focus
  await page.fill("#au_pw", WORKER_PW); await page.fill("#au_pw2", WORKER_PW);
  await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)", { timeout: 15000 }).catch(async (err) => {
    // show what the login screen says instead of a bare timeout
    console.log("DIAG login screen:", await page.evaluate(() => ({ error: document.getElementById("au_err")?.textContent, screen: document.getElementById("authCard")?.innerText.slice(0, 200) })), "page errors:", errors);
    throw err;
  });
  // employees start their shift right after logging in (attendance + cash custody)
  await page.waitForSelector("#qf_opening", { timeout: 3000 }).then(async () => { await page.fill("#qf_opening", "0"); await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); }).catch(() => {}); // shifts are optional
  check("worker logs in with forced password change", true);

  // Worker must not see money figures or restricted pages
  await nav("dashboard");
  check("worker cannot open the home page (money figures) at all", !(await page.evaluate(() => document.getElementById("page-dashboard").classList.contains("active"))) && !(await page.isVisible('.nav-item[data-page="dashboard"]')));
  for (const pg of ["reports", "finance", "closures", "settings", "access", "audit", "employees"]) {
    await nav(pg);
    const active = await page.evaluate(() => document.querySelector(".page.active")?.id);
    check(`worker blocked from ${pg}`, active !== "page-" + pg, active);
  }

  // Worker tries credit → needs supervisor; self-approval refused; owner approval works
  await nav("orders");
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await page.click("#advanceStatusBtn");
  await page.selectOption("#qf_method", "unpaid");
  await submit();
  await later();
  let o = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0]);
  const cust = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_customers"))[0]);
  check("credit (pay later) needs no supervisor and is recorded under the worker", o.status === "ready" && o.debtRecorded && o.paymentBy === "Worker One" && cust.balance === -0.4, JSON.stringify([o.status, o.paymentBy, cust.balance]));
  // Supervisor override still guards cancellations: self-approval and wrong password refused, owner approves
  await closeDialogs();
  await page.click("#ordersBody tr:nth-child(1) [data-view]");
  await page.click("#cancelOrderBtn");
  await page.waitForTimeout(300);
  const title = await page.textContent("#quickFormTitle");
  check("cancellation by worker asks for supervisor approval", /موافقة مشرف/.test(title), title);
  await page.fill("#qf_u", "worker1"); await page.fill("#qf_p", WORKER_PW);
  await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250);
  check("worker cannot approve own action", /موافقة مشرف/.test(await page.textContent("#quickFormTitle")));
  await page.fill("#qf_u", "owner"); await page.fill("#qf_p", "wrong-password");
  await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250);
  check("wrong supervisor password rejected", /موافقة مشرف/.test(await page.textContent("#quickFormTitle")));
  await page.fill("#qf_u", "owner"); await page.fill("#qf_p", OWNER_PW);
  await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(400);
  await page.fill("#qf_reason", "customer request"); await submit();
  o = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0]);
  check("owner approval lets the worker cancel (debt written off)", o.status === "cancelled" && o.cancelApprovedBy === "Owner", JSON.stringify([o.status, o.cancelApprovedBy]));
  const audit = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_audit")));
  check("audit log records the failed and approved attempts", audit.some((a) => /موافقة مشرف فاشلة/.test(a.action)) && audit.some((a) => /موافقة مشرف: Owner/.test(a.action)));

  // Back to owner: restore the earlier backup → order returns to its pre-credit state
  await closeDialogs();
  await page.click("#logoutBtn");
  if (await page.isVisible("#qf_what").catch(() => false)) { await page.selectOption("#qf_what", "break"); await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); } // worker has an open shift
  await page.waitForSelector("#au_user"); await page.waitForTimeout(150); // let the login screen finish its auto-focus
  await page.fill("#au_user", "owner"); await page.fill("#au_pass", OWNER_PW);
  await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)");
  await nav("profile");
  // a corrupted file must change nothing
  const badPath = path.join(os.tmpdir(), "l997-bad-backup.json");
  fs.writeFileSync(badPath, JSON.stringify({ data: { l997_orders: "[]", l997_customers: "{broken" } }));
  await page.setInputFiles("#importBackupInput", badPath);
  await page.waitForTimeout(300);
  await page.fill("#qf_confirm", "تأكيد"); await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300);
  const afterBad = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders")).length);
  check("corrupted backup is rejected without touching data", afterBad === 1, afterBad);
  await closeDialogs();
  await page.setInputFiles("#importBackupInput", backupPath);
  await page.waitForTimeout(300);
  await page.fill("#qf_confirm", "تأكيد");
  await Promise.all([page.waitForEvent("load"), page.click("#quickFormSubmitBtn")]);
  const restored = await page.evaluate(() => ({ o: JSON.parse(localStorage.getItem("l997_orders"))[0], c: JSON.parse(localStorage.getItem("l997_customers"))[0] }));
  check("backup restore brings data back exactly", restored.o.status === "received" && restored.c.balance === 0, JSON.stringify([restored.o.status, restored.c.balance]));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL ROLE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
