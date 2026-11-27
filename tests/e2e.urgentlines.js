// Urgent pieces inside one order: the cashier marks only some pieces ⚡ urgent; the urgent fee is charged on
// those pieces only, the receipt and order window mark them, the order shows two ready times, and the
// "whole order urgent" switch still marks every piece. Older orders (urgent with no marked pieces) keep
// charging the fee on all pieces.
// Usage: node tests/e2e.urgentlines.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`);
  if (!cond) failures++;
}

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {}; window.open = () => ({ closed: false });
    if (localStorage.getItem("l997_customers")) return;
    localStorage.setItem("l997_customers", JSON.stringify([{ id: "c1", name: "Mixed Cust", phone: "97333990011", balance: 0, createdAt: new Date().toISOString() }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const tap = (id) => page.click(`#posProductGrid [data-cloth="${id}"]`);
  const pick = async () => { await closeAll(); await nav("new-order"); await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33990011"); await wait(200); await page.click("#customerResults [data-pick]"); await wait(150); };
  const saveOrder = async () => { await page.click("#posSaveOrderMainBtn"); await wait(400); await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 2000 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); await closeAll(); return (await ls("l997_orders"))[0]; };
  const lineOf = (cloth) => page.evaluate((c) => { const rows = [...document.querySelectorAll("#orderItemsBody .pos-cart-row")]; const r = rows.find((x) => x.querySelector(".pos-cart-row-title").textContent.trim().length && x.innerHTML.includes(c)); return r ? r.querySelector("[data-urgent-line]").dataset.urgentLine : null; }, cloth);

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  const st = await ls("l997_settings");
  const P = (k) => st.prices[k];
  const fixedGhatra = (st.urgentPrices || {}).ghatra;

  // 1) mixed order: 3 shirts urgent, 2 thobes normal
  await pick();
  await tap("shirt"); await tap("shirt"); await tap("shirt"); await tap("thob_cotton"); await tap("thob_cotton");
  const rows = await page.$$eval("#orderItemsBody [data-urgent-line]", (bs) => bs.map((b) => b.dataset.urgentLine));
  const items0 = await page.evaluate(() => [...document.querySelectorAll("#orderItemsBody .pos-cart-row")].map((r) => r.querySelector(".pos-cart-row-title").textContent));
  const shirtRow = rows[items0.findIndex((t) => /قميص|Shirt/i.test(t))];
  await page.click(`[data-urgent-line="${shirtRow}"]`); await wait(150);
  const hint = await page.textContent("#posUrgentHint");
  const tog = await page.evaluate(() => { const t = document.getElementById("orderPriorityToggle"); return { checked: t.checked, ind: t.indeterminate }; });
  check("⚡ on one line: hint shows 3 urgent · 2 normal and the whole-order switch is half-on", /3/.test(hint) && /2/.test(hint) && tog.ind && !tog.checked, JSON.stringify({ hint, tog }));
  const o1 = await saveOrder();
  const shirtTotal = Math.round(3 * P("shirt_washiron") * 1000) / 1000, thobTotal = Math.round(2 * P("thob_cotton_washiron") * 1000) / 1000;
  const expFee = Math.round(shirtTotal * st.urgentPercent / 100 * 1000) / 1000;
  check("saved as urgent, with only the shirts marked", o1.priority === "urgent" && o1.items.find((i) => i.clothingId === "shirt").urgent === true && o1.items.find((i) => i.clothingId === "thob_cotton").urgent === false, JSON.stringify(o1.items.map((i) => [i.clothingId, i.urgent])));
  check("urgent fee charged on the urgent pieces only", Math.abs(o1.payment.urgentFee - expFee) < 0.0005 && Math.abs(o1.payment.total - (shirtTotal + thobTotal + expFee)) < 0.0005, JSON.stringify({ fee: o1.payment.urgentFee, expFee, total: o1.payment.total }));

  // order window: ⚡ on the shirts only, two ready times
  await nav("orders"); await wait(200);
  await page.click(`#ordersBody tr:has-text("#${o1.number}") [data-view]`); await wait(300);
  const dlg = await page.textContent("#orderDialog");
  check("order window: two ready times (urgent and normal) and ⚡ on the urgent line only", /قطعة مستعجلة — جاهزة قبل/.test(dlg) && /⚡ (قميص|Shirt)/.test(dlg) && !/⚡ (ثوب|Thob)/.test(dlg), dlg.replace(/\s+/g, " ").slice(0, 300));

  // edit: switching the whole order to normal clears the fee; back to urgent marks every piece
  await page.click("#editOrderBtn"); await page.selectOption("#qf_priority", "normal"); await page.fill("#qf_reason", "customer not in a hurry"); await page.click("#quickFormSubmitBtn"); await wait(400);
  let o1b = (await ls("l997_orders")).find((o) => o.id === o1.id);
  check("edit to normal: no urgent pieces, no fee", o1b.priority === "normal" && !o1b.items.some((i) => i.urgent) && !(o1b.payment.urgentFee > 0), JSON.stringify({ p: o1b.priority, fee: o1b.payment.urgentFee }));
  await closeAll();

  // edit: add new item types (a new kind + more of an existing one, merged into its line)
  await nav("orders"); await wait(200);
  await page.click(`#ordersBody tr:has-text("#${o1.number}") [data-view]`); await wait(300);
  await page.click("#editOrderBtn"); await wait(150);
  await page.selectOption("#qf_add0", "pants_long|washiron"); await page.fill("#qf_addq0", "2");
  await page.selectOption("#qf_add1", "shirt|washiron"); await page.fill("#qf_addq1", "1");
  await page.fill("#qf_reason", "customer brought more"); await page.click("#quickFormSubmitBtn"); await wait(400);
  const o1c = (await ls("l997_orders")).find((o) => o.id === o1.id);
  const pants = o1c.items.find((i) => i.clothingId === "pants_long"), shirts = o1c.items.find((i) => i.clothingId === "shirt");
  const exp1c = Math.round((4 * P("shirt_washiron") + 2 * P("thob_cotton_washiron") + 2 * P("pants_long_washiron")) * 1000) / 1000;
  check("edit adds a new item type and merges more of an existing one; total recalculated", pants && pants.qty === 2 && shirts.qty === 4 && o1c.items.length === 3 && Math.abs(o1c.payment.total - exp1c) < 0.0005, JSON.stringify({ items: o1c.items.map((i) => [i.clothingId, i.qty]), total: o1c.payment.total, exp1c }));
  check("…the addition is recorded in the order's edit history", (o1c.editHistory || []).length === 2 && o1c.editHistory[1].after.pieces === 8, JSON.stringify(o1c.editHistory && o1c.editHistory[1]));
  await closeAll();

  // 2) the whole-order switch still marks everything (and new pieces added after it)
  await pick();
  await page.check("#orderPriorityToggle"); await wait(100);
  await tap("shirt"); await tap("thob_cotton"); await wait(150);
  const on = await page.$$eval("#orderItemsBody .pos-urgent-chip.on", (x) => x.length);
  const o2 = await saveOrder();
  const full = Math.round((P("shirt_washiron") + P("thob_cotton_washiron")) * st.urgentPercent / 100 * 1000) / 1000;
  check("whole order urgent: every piece marked and charged", on === 2 && o2.items.every((i) => i.urgent) && Math.abs(o2.payment.urgentFee - full) < 0.0005, JSON.stringify({ on, fee: o2.payment.urgentFee, full }));

  // 3) an older urgent order without marked pieces keeps charging the fee on all pieces when edited
  await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("l997_orders")); const o = l.find((x) => x.items.length === 2 && x.items.every((i) => i.urgent)); o.items.forEach((i) => delete i.urgent); o.id = o.id; localStorage.setItem("l997_orders", JSON.stringify(l)); });
  await page.reload(); await page.waitForSelector("body:not(.auth-locked)").catch(() => {});
  if (await page.isVisible("#au_user").catch(() => false)) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("orders"); await wait(200);
  await page.click(`#ordersBody tr:has-text("#${o2.number}") [data-view]`); await wait(200);
  await page.click("#editOrderBtn"); await page.fill("#qf_q0", "2"); await page.fill("#qf_reason", "one more"); await page.click("#quickFormSubmitBtn"); await wait(400);
  const o2b = (await ls("l997_orders")).find((o) => o.id === o2.id);
  const exp2 = Math.round(((2 * o2b.items[0].unit) + o2b.items[1].unit) * st.urgentPercent / 100 * 1000) / 1000;
  check("older urgent order (no marked pieces): fee still on all pieces after an edit", Math.abs(o2b.payment.urgentFee - exp2) < 0.0005, JSON.stringify({ fee: o2b.payment.urgentFee, exp2 }));
  await closeAll();

  // 4) an item with no urgent service cannot be marked
  if (st.urgentPrices && st.urgentPrices.shoes === 0) {
    await pick(); await tap("shoes"); await wait(150);
    check("item without urgent service: ⚡ is disabled", await page.$eval("#orderItemsBody [data-urgent-line]", (b) => b.disabled));
    await closeAll();
  }
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL URGENT-LINE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
