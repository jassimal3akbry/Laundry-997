// Pages & permissions: the matrix is split into Pages and Actions (Orders, Customers and Delivery included),
// a worker sees Delivery by default, the owner can hide/show pages per role, and give one employee an
// exception from the users table. Works in English too.
// Usage: node tests/e2e.pages.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");
const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`); if (!cond) failures++; }
(async () => {
  const b = await launchBrowser();
  const page = await (await b.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.open = () => ({ closed: false }); window.print = () => {}; });
  await page.goto(await serve(file));
  const OWNER_PW = "Owner#2026pass", WORKER_PW = "Worker#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const visibleNav = () => page.$$eval(".nav-item", (n) => n.filter((x) => x.offsetParent !== null).map((x) => x.dataset.page));
  const login = async (u, pw) => { await page.waitForSelector("#au_user"); await wait(150); await page.fill("#au_user", u); await page.fill("#au_pass", pw); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); await closeAll(); };
  const logout = async () => { await closeAll(); await page.click("#logoutBtn"); await wait(300); if (await page.isVisible("#quickFormSubmitBtn")) { await page.click("#quickFormSubmitBtn"); await wait(200); } await page.waitForSelector("#au_user"); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", OWNER_PW); await page.fill("#au_pw2", OWNER_PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next"); await page.waitForSelector("body:not(.auth-locked)");
  await nav("access"); await page.click("#accessAddUserBtn");
  await page.fill("#qf_name", "Yaseen"); await page.selectOption("#qf_role", "worker"); await page.fill("#qf_username", "yaseen");
  const tempPw = await page.inputValue("#qf_password"); await page.click("#quickFormSubmitBtn"); await wait(300); await closeAll();

  // matrix: two groups, the new pages are there
  await nav("access"); await wait(200);
  const mx = await page.textContent("#permMatrixBody");
  check("matrix is split into «Pages» and «Actions»", /📄 الصفحات/.test(mx) && /⚙️ الإجراءات/.test(mx));
  check("Orders, Customers and Delivery pages are in the matrix", await page.$('[data-perm="view_orders"][data-role="worker"]') && await page.$('[data-perm="view_customers"][data-role="worker"]') && await page.$('[data-perm="delivery"][data-role="worker"]') && /التوصيل والاستلام/.test(mx));
  check("users table has a «Pages & permissions» button for the worker", /الصفحات والصلاحيات/.test(await page.textContent("#accessUsersBody")));

  // worker: first login (change temp password) — sees Delivery
  await logout();
  await page.fill("#au_user", "yaseen"); await page.fill("#au_pass", tempPw); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("#au_pw2"); await wait(150); await page.fill("#au_pw", WORKER_PW); await page.fill("#au_pw2", WORKER_PW); await page.click("#au_form button[type=submit]");
  await page.waitForSelector("body:not(.auth-locked)"); await closeAll();
  let navs = await visibleNav();
  check("worker sees New order, Orders, Customers and Delivery", ["new-order", "orders", "customers", "delivery"].every((x) => navs.includes(x)) && !navs.includes("balances") && !navs.includes("reports"), navs.join(","));
  await nav("delivery"); await wait(200);
  check("worker can open the Delivery page and book a pickup", await page.evaluate(() => document.getElementById("page-delivery").classList.contains("active")) && await page.isVisible("#newPickupBtn"));

  // owner hides Delivery from workers
  await logout(); await login("owner", OWNER_PW);
  await nav("access"); await wait(200);
  await page.uncheck('[data-perm="delivery"][data-role="worker"]'); await wait(200);
  await logout(); await login("yaseen", WORKER_PW);
  navs = await visibleNav();
  check("after the owner unticks it, the worker no longer sees Delivery", !navs.includes("delivery"), navs.join(","));
  await nav("delivery").catch(() => {});
  await page.evaluate(() => window.L997CloudHost && 0);
  // owner gives Yaseen alone the Delivery page and the Balances page (exception)
  await logout(); await login("owner", OWNER_PW);
  await nav("access"); await wait(200);
  const emp = (await page.evaluate(() => JSON.parse(localStorage.getItem("l997_employees")))).find((e) => e.username === "yaseen");
  await page.click(`[data-uact="perms"][data-id="${emp.id}"]`); await page.waitForSelector("#qf_p_delivery");
  await page.selectOption("#qf_p_delivery", "allow"); await page.selectOption("#qf_p_view_balances", "allow"); await page.click("#quickFormSubmitBtn"); await wait(300);
  await logout(); await login("yaseen", WORKER_PW);
  navs = await visibleNav();
  check("exception for one employee: Yaseen sees Delivery and Balances again", navs.includes("delivery") && navs.includes("balances"), navs.join(","));
  // a worker without the Orders page still saves orders (lands on an allowed page, no error)
  await logout(); await login("owner", OWNER_PW); await nav("access"); await wait(200);
  await page.uncheck('[data-perm="view_orders"][data-role="worker"]'); await wait(200);
  await logout(); await login("yaseen", WORKER_PW);
  navs = await visibleNav();
  check("Orders page can be hidden from workers", !navs.includes("orders"), navs.join(","));
  await nav("new-order"); await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33009988"); await wait(150);
  await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Test"); await page.fill("#customerPhone", "33009988"); await page.click("#saveCustomerBtn");
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click("#posSaveOrderMainBtn"); await wait(500); await closeAll();
  const saved = (await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders") || "[]"))).length;
  check("…and can still save orders (no page error)", saved === 1 && !(await page.evaluate(() => document.getElementById("page-orders").classList.contains("active"))), saved);

  // a worker edits an unpaid order and reduces the pieces without a supervisor (permission «edit order», on by default)
  const twoShirts = async () => {
    await nav("new-order"); await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33009988"); await wait(250);
    await page.click("#customerResults [data-pick]"); await wait(150);
    await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click("#posSaveOrderMainBtn"); await wait(500); await closeAll();
    return (await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders") || "[]"))).filter((o) => o.items.some((it) => it.qty === 2)).pop();
  };
  const reduceToOne = async (o) => {
    await nav("orders"); await wait(200);
    await page.click(`#ordersBody tr:has-text("#${o.number}") [data-view]`); await page.click("#editOrderBtn");
    await page.fill("#qf_q0", "1"); await page.fill("#qf_reason", "customer took one back"); await page.click("#quickFormSubmitBtn"); await wait(500);
    const askedSup = await page.isVisible("#qf_p").catch(() => false);
    const after = (await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders") || "[]"))).find((x) => x.id === o.id);
    await closeAll(); return { askedSup, qty: after.items[0].qty, edits: (after.editHistory || []).length };
  };
  await logout(); await login("owner", OWNER_PW); await nav("access"); await wait(200);
  check("«edit order» is an action in the matrix, allowed for workers by default", await page.isChecked('[data-perm="edit_order"][data-role="worker"]'));
  await page.check('[data-perm="view_orders"][data-role="worker"]'); await wait(200);
  await logout(); await login("yaseen", WORKER_PW);
  const r1 = await reduceToOne(await twoShirts());
  check("worker reduces an unpaid order's pieces with no supervisor prompt", !r1.askedSup && r1.qty === 1 && r1.edits === 1, JSON.stringify(r1));
  await logout(); await login("owner", OWNER_PW); await nav("access"); await wait(200);
  await page.uncheck('[data-perm="edit_order"][data-role="worker"]'); await wait(200);
  await logout(); await login("yaseen", WORKER_PW);
  const r2 = await reduceToOne(await twoShirts());
  check("…when the owner turns it off, reducing needs a supervisor again", r2.askedSup && r2.qty === 2, JSON.stringify(r2));

  // English labels
  await logout(); await login("owner", OWNER_PW);
  await page.selectOption("#langSelect", "en"); await wait(900); await page.waitForSelector("body:not(.auth-locked)").catch(() => {});
  if (await page.isVisible("#au_user").catch(() => false)) await login("owner", OWNER_PW);
  await nav("access"); await wait(300);
  const mxe = await page.textContent("#permMatrixBody");
  check("English matrix: «Pages» / «Actions» and «Pickup & delivery»", /Pages — what each role sees/.test(mxe) && /Pickup & delivery/.test(mxe) && !/[؀-ۿ]{4,}/.test(mxe), mxe.slice(0, 200));
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await b.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PAGE-PERMISSION CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
