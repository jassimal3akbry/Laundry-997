// Employees ↔ users consistency test: one list, one form, rank rules on both pages,
// demo employees cleanup, login-less employees, and the accountant (payroll-only) path.
// Usage: node tests/e2e.people.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + detail : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(await serve(file));
  const OWNER_PW = "Owner#2026pass", ACC_PW = "Accnt#2026pass";
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(250); };
  const later = async () => { await page.waitForTimeout(250); if (await page.isVisible("#quickFormCancelBtn")) { await page.click("#quickFormCancelBtn"); await page.waitForTimeout(150); } else if (await page.isVisible("#quickFormSubmitBtn") && /واتساب|WhatsApp/.test(await page.textContent("#quickFormSubmitBtn"))) { await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(200); } };
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const emps = () => page.evaluate(() => JSON.parse(localStorage.getItem("l997_employees")));
  const login = async (u, p) => {
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    if (await page.isVisible("#logoutBtn")) await page.click("#logoutBtn");
    await page.waitForSelector("#au_user"); await page.waitForTimeout(150); // let the login screen finish its auto-focus
    await page.fill("#au_user", u); await page.fill("#au_pass", p);
    await page.click("#au_form button[type=submit]");
  };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", OWNER_PW); await page.fill("#au_pw2", OWNER_PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  let list = await emps();
  check("new install: only the owner, no ghost demo employees", list.length === 1 && list[0].role === "owner" && list[0].employeeNumber, list.map((e) => e.name).join(","));

  // Old installs: the two untouched demo employees are removed on next start; a used one is kept
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("l997_employees"));
    l.push({ id: "demo1", name: "مدير المغسلة", role: "manager", salary: 350, commission: 0 });
    l.push({ id: "demo2", name: "عامل 1", role: "worker", salary: 180, commission: 0 });
    l.push({ id: "demo3", name: "عامل 1", role: "worker", salary: 180, commission: 0 }); // has payroll → keep
    localStorage.setItem("l997_employees", JSON.stringify(l));
    localStorage.setItem("l997_payroll", JSON.stringify([{ id: "p1", employeeId: "demo3", type: "bonus", amount: 5, net: 5, date: new Date().toISOString() }]));
  });
  await page.reload();
  await page.waitForSelector("body:not(.auth-locked)");
  list = await emps();
  check("old demo employees removed, used one kept, numbers assigned", !list.some((e) => e.id === "demo1" || e.id === "demo2") && list.some((e) => e.id === "demo3" && e.employeeNumber), list.map((e) => `${e.name}#${e.employeeNumber}`).join(","));

  // Employees page "+ employee" → unified form; employee without login
  await nav("employees");
  await page.click("#addEmployeeBtn");
  check("employees page opens the unified form with the login choice", await page.isVisible("#qf_login"));
  await page.fill("#qf_name", "Ironer Ahmed");
  await page.selectOption("#qf_login", "no");
  await page.fill("#qf_salary", "200");
  await page.fill("#qf_commission", "15");
  await submit();
  list = await emps();
  const ironer = list.find((e) => e.name === "Ironer Ahmed");
  check("login-less employee saved with number, salary, commission, no password", ironer && !ironer.passHash && !ironer.username && ironer.employeeNumber && ironer.salary === 200 && ironer.commission === 15, JSON.stringify(ironer && [ironer.employeeNumber, ironer.salary, ironer.commission]));
  await nav("access");
  const accessText = await page.textContent("#accessUsersBody");
  check("users page shows the same employee as 'without login'", /Ironer Ahmed[\s\S]*بدون حساب دخول/.test(accessText));

  // Create a login for him from the users page → he can log in
  await page.click(`[data-uact="reset"][data-id="${ironer.id}"]`);
  await page.fill("#qf_username", "ahmed");
  const tmp = await page.inputValue("#qf_password");
  await submit(); await later();
  list = await emps();
  check("login created later from the users page", list.find((e) => e.id === ironer.id).passHash && list.find((e) => e.id === ironer.id).username === "ahmed");

  // Owner creates an accountant (payroll yes, manage_users no)
  await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Accountant Sara");
  await page.selectOption("#qf_role", "accountant");
  await page.fill("#qf_username", "sara");
  const accTmp = await page.inputValue("#qf_password");
  await submit(); await later();
  // Disable Ahmed → excluded from employee counts and payroll lists
  await page.click(`[data-uact="toggle"][data-id="${ironer.id}"]`);
  await page.waitForTimeout(200);
  if (await page.isVisible("#quickFormSubmitBtn")) await submit();
  await nav("employees");
  const metrics = (await page.textContent("#employeeMetrics")).replace(/\s+/g, " ");
  check("disabled employee excluded from counts", /عدد الموظفين ?3/.test(metrics), metrics.slice(0, 80));

  // Accountant: cannot add employees or raise roles; can only edit salary/commission
  await login("sara", accTmp);
  await page.waitForSelector("#au_pw2"); await page.waitForTimeout(150); // let the change-password screen finish its auto-focus
  await page.fill("#au_pw", ACC_PW); await page.fill("#au_pw2", ACC_PW);
  await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)", { timeout: 15000 }).catch(async (err) => {
    console.log("DIAG login screen:", await page.evaluate(() => ({ error: document.getElementById("au_err")?.textContent, screen: document.getElementById("authCard")?.innerText.slice(0, 200), pw: document.getElementById("au_pw")?.value.length })));
    throw err;
  });
  // employees start their shift right after logging in (attendance + cash custody)
  await page.waitForSelector("#qf_opening", { timeout: 3000 }).then(async () => { await page.fill("#qf_opening", "0"); await page.click("#quickFormSubmitBtn"); await page.waitForTimeout(300); }).catch(() => {}); // shifts are optional
  await nav("employees");
  const before = (await emps()).length;
  await page.click("#addEmployeeBtn");
  await page.waitForTimeout(300);
  check("accountant cannot add employees (no role escalation)", !(await page.isVisible("#qf_role")) && (await emps()).length === before);
  await page.click(`[data-emp-edit="demo3"]`);
  await page.waitForTimeout(200);
  check("accountant edit = salary/commission only (no role field)", (await page.isVisible("#qf_salary")) && !(await page.isVisible("#qf_role")));
  await page.fill("#qf_salary", "190");
  await submit();
  list = await emps();
  check("accountant salary change saved", list.find((e) => e.id === "demo3").salary === 190);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PEOPLE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
