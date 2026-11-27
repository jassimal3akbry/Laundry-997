// Phone numbers from Bahrain, the Gulf and the rest of the world: stored in full international form (= WhatsApp form),
// Gulf lengths checked, local "0" after the country code removed, duplicates detected per country (not by the last
// 8 digits), search by any way of typing, WhatsApp opens on the right number, unclear numbers refused with a hint.
// Usage: node tests/e2e.phones.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 220) : ""}`);
  if (!cond) failures++;
}
const CASES = [
  // [typed, expected stored digits or null (refused), label]
  ["33445566", "97333445566", "Bahrain local 8 digits"],
  ["3344 5566", "97333445566", "Bahrain with a space"],
  ["+973 3344 5566", "97333445566", "Bahrain with +973"],
  ["0097333445566", "97333445566", "Bahrain with 00973"],
  ["٣٣٤٤٥٥٦٦", "97333445566", "Bahrain in Arabic digits"],
  ["+966 50 123 4567", "966501234567", "Saudi"],
  ["+966 0501234567", "966501234567", "Saudi with local 0 after the code"],
  ["00966501234567", "966501234567", "Saudi with 00"],
  ["966501234567", "966501234567", "Saudi without +"],
  ["+971 50 123 4567", "971501234567", "UAE mobile"],
  ["+971 050 123 4567", "971501234567", "UAE with local 0"],
  ["+965 9123 4567", "96591234567", "Kuwait"],
  ["+974 5512 3456", "97455123456", "Qatar"],
  ["+968 9123 4567", "96891234567", "Oman"],
  ["+20 010 1234 5678", "201012345678", "Egypt with local 0"],
  ["+91 98765 43210", "919876543210", "India"],
  ["+92 300 1234567", "923001234567", "Pakistan"],
  ["+63 917 123 4567", "639171234567", "Philippines"],
  ["+44 07700 900123", "447700900123", "UK with local 0"],
  ["+1 415 555 2671", "14155552671", "USA"],
  ["0501234567", null, "Saudi number without country code (unclear) — refused"],
  ["+966 5012345", null, "Saudi number too short — refused"],
  ["+973 3344556", null, "Bahrain 7 digits — refused"],
  ["1234", null, "too short — refused"],
  ["973", null, "country code only — refused"],
];

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { window.print = () => {}; window.__wa = []; window.open = (u) => { window.__wa.push(u); return { closed: false }; }; });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const toast = () => page.evaluate(() => [...document.querySelectorAll(".toast, #toast, [class*=toast]")].map((e) => e.textContent).join(" "));
  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  /* 1) normalisation rules */
  const res = await page.evaluate((cases) => cases.map(([t]) => window.normPhone997(t)), CASES);
  CASES.forEach(([typed, want, label], i) => {
    const r = res[i];
    check(`${label}: «${typed}»`, want ? r.ok && r.digits === want : !r.ok, JSON.stringify(r));
  });
  const fmt = await page.evaluate(() => ["33445566", "+966501234567", "+44 7700 900123"].map((x) => window.fmtPhone997(x)));
  check("display format: +973 3344 5566 · +966 501234567 · +447700900123", fmt[0] === "+973 3344 5566" && fmt[1] === "+966 501234567" && fmt[2] === "+447700900123", fmt.join(" | "));

  /* 2) customers from different countries through the real form */
  async function addCustomer(name, phone) {
    await closeAll(); await nav("customers"); await page.click("#addCustomerBtn");
    await page.fill("#customerName", name); await page.fill("#customerPhone", phone); await page.click("#saveCustomerBtn"); await wait(250);
    return (await ls("l997_customers") || []).find((c) => c.name === name);
  }
  const bh = await addCustomer("Bahrain One", "12345678");
  const kw = await addCustomer("Kuwait One", "+965 1234 5678");
  check("Bahrain 12345678 and Kuwait +965 12345678 are two different customers (not the same last 8 digits)", bh && kw && bh.phone === "97312345678" && kw.phone === "96512345678", JSON.stringify([bh && bh.phone, kw && kw.phone]));
  const sa = await addCustomer("Saudi One", "+966 0501234567");
  check("Saudi customer saved as 966501234567", sa && sa.phone === "966501234567", sa && sa.phone);
  const dup = await addCustomer("Saudi Again", "00966 50 123 4567");
  check("the same Saudi number typed another way is detected as a duplicate", !dup && /مسجّل مسبقاً/.test(await toast()), await toast());
  await closeAll();
  const bad = await addCustomer("Unclear", "0501234567");
  check("a number without country code that is not Bahraini is refused with a clear hint", !bad && /\+966/.test(await toast()), await toast());
  await closeAll();

  /* 3) search finds them however the number is typed */
  const found = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("l997_customers")).find((x) => x.name === "Saudi One");
    return ["0501234567", "501234567", "+966 050 123 4567", "966501", "4567"].map((q) => window.phoneMatches997(c.phone, q));
  });
  check("search finds the Saudi customer by 0501234567 / 501234567 / +966 050… / 966501 / 4567", found.every(Boolean), JSON.stringify(found));
  await nav("customers"); await page.fill("#customerSearch", "0501234567"); await wait(200);
  const rows = await page.$$eval("#customersBody tr", (trs) => trs.map((tr) => tr.textContent));
  check("customers page: searching 0501234567 shows the Saudi customer with +966 formatting", rows.length === 1 && /Saudi One/.test(rows[0]) && /\+966 501234567/.test(rows[0]), rows.join(" | ").slice(0, 120));
  await page.fill("#customerSearch", "");

  /* 4) WhatsApp opens on the right international number */
  // order for the Saudi customer → confirmation WhatsApp to 966…
  await nav("new-order"); await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "+966 050 123 4567"); await wait(250);
  await page.click("#customerResults [data-pick]");
  await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click("#posSaveOrderMainBtn"); await wait(500);
  await page.click("#quickFormSubmitBtn"); await wait(200);
  const wa = await page.evaluate(() => window.__wa.concat([]));
  check("order confirmation WhatsApp goes to +966 501234567", wa.some((u) => /api\.whatsapp\.com\/send\?phone=966501234567&/.test(u)), wa.slice(-1)[0]);
  check("…(POS search by +966 050… found the customer)", (await ls("l997_orders"))[0].customerId === sa.id);

  /* 5) editing a number to another country works and keeps duplicate checks */
  await closeAll(); await nav("customers");
  const editBtn = await page.$(`[data-edit="${bh.id}"], [data-edit-customer="${bh.id}"]`);
  if (editBtn) {
    await editBtn.click(); await wait(150);
    await page.fill("#qf_phone", "+971 050 999 8877"); await page.click("#quickFormSubmitBtn"); await wait(200);
    check("edit: Bahrain customer moved to a UAE number (971509998877)", (await ls("l997_customers")).find((c) => c.id === bh.id).phone === "971509998877");
  } else check("edit button found on the customers page", false);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PHONE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
