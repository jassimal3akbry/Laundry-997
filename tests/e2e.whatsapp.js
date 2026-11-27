// WhatsApp messages: the right message at each step of an order, with the right numbers — order total, paid,
// remaining (after later payments), the customer's balance in plain words, reminders that add up, and packages.
// Usage: node tests/e2e.whatsapp.js [path-to-html]
const path = require("path");
const fs = require("fs");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 400) : ""}`);
  if (!cond) failures++;
}
const prices = require("./fixtures/prices-v2.json");
const CATALOG = Number((/const CATALOG_VERSION = (\d+)/.exec(fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8")) || [])[1]) || 0;

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(([p, v]) => {
    window.print = () => {};
    // every WhatsApp link opened is recorded (kept across reloads)
    window.open = (url) => { if (/api\.whatsapp\.com\/send/.test(url)) { const a = JSON.parse(sessionStorage.getItem("__wa") || "[]"); a.push({ url, to: (/[?&]phone=(\d+)/.exec(url) || [])[1], text: decodeURIComponent(url.split("text=")[1] || "") }); sessionStorage.setItem("__wa", JSON.stringify(a)); } return { closed: false }; };
    if (!localStorage.getItem("l997_settings")) localStorage.setItem("l997_settings", JSON.stringify({ urgentPercent: 100, normalHours: 24, urgentHours: 6, prices: p, orderSeq: 1, catalogVersion: v, garmentActive: {}, serviceActive: { wash: true },
      packageDefs: [{ id: "pk_shirts", name: "باقة قمصان 10", serviceType: "washiron", pieceCount: 10, price: 1.5, bonus: "كوي غترة مجاناً", garments: ["shirt"] }] }));
  }, [prices, CATALOG]);
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const last = async () => { const a = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__wa") || "[]")); return a[a.length - 1] || { text: "" }; };
  const count = async () => (await page.evaluate(() => JSON.parse(sessionStorage.getItem("__wa") || "[]"))).length;
  const promptTitle = async () => { await page.waitForSelector("#quickFormSubmitBtn", { state: "visible", timeout: 3000 }); return page.textContent("#quickFormDialog"); };
  const sendPrompt = async () => { await promptTitle(); await submit(); };
  async function order(name, phone, shirts, pickExisting) {
    await closeAll(); await nav("new-order");
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(200);
    if (pickExisting) await page.click("#customerResults [data-pick]");
    else { await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", name); await page.fill("#customerPhone", phone); await page.click("#saveCustomerBtn"); }
    for (let i = 0; i < shirts; i++) await page.click('#posProductGrid [data-cloth="shirt"]');
    await page.click("#posSaveOrderMainBtn"); await wait(400);
    return (await ls("l997_orders"))[0];
  }
  const openOrder = async (id) => { await closeAll(); await nav("orders"); await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id); await wait(150); };

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");

  /* 1) order received → confirmation (mandatory) */
  const o1 = await order("Ali Test", "33445566", 5); // 5 × 0.200 = 1.000
  await sendPrompt();
  let m = await last();
  check("order saved → confirmation sent to the customer's number (973…)", m.to === "97333445566", m.to);
  check("WhatsApp link is api.whatsapp.com/send (wa.me turns emoji into � on some Android phones) and emoji arrive intact", /^https:\/\/api\.whatsapp\.com\/send\?phone=97333445566&text=/.test(m.url) && m.text.includes("🌸") && m.text.includes("💙") && !m.text.includes("\uFFFD"), m.url.slice(0, 60));
  check("confirmation: order number, 5 pieces, value 1.000", m.text.includes(`#${o1.number}`) && /عدد القطع: 5/.test(m.text) && /1\.000/.test(m.text), m.text);

  /* 2) ready with a partial payment 0.400 → ready message shows paid + remaining, no "24 hours" claim */
  await openOrder(o1.id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", "cash"); await page.fill("#qf_paid", "0.4"); await submit();
  const title = await promptTitle();
  check("ready prompt says what is still owed (not 'payment confirmed')", /متبقي 0\.600/.test(title), title.slice(0, 120));
  await submit(); m = await last();
  check("ready message: paid 0.400, remaining 0.600", /المدفوع: 0\.400/.test(m.text) && /المتبقي: 0\.600/.test(m.text), m.text);
  check("ready message: shop open 24 hours", /المحل مفتوح 24 ساعة/.test(m.text), m.text);

  /* 3) customer pays 0.300 of the remaining from the customer file → payment message, clear balance wording */
  const cust = (await ls("l997_customers")).find((c) => c.phone.includes("33445566"));
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), cust.id); await wait(200);
  await page.click("#cpSettle"); await page.fill("#qf_amount", "0.3"); await submit(); await wait(200);
  m = await last();
  check("payment message: 'received your payment 0.300' (not 'added to your balance')", /استلمنا دفعتك 0\.300/.test(m.text) && !/إضافة/.test(m.text), m.text);
  check("…and the balance in words: 'remaining on you 0.300' (no minus sign)", /المتبقي عليك: 0\.300/.test(m.text) && !/-0\.300/.test(m.text), m.text);

  /* 4) reminder from the customer file: lines add up to the total */
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), cust.id); await wait(200);
  await page.click("#cpRemind"); m = await last();
  check("reminder: order line 0.300 and total 0.300", /#0+1: 0\.300/.test(m.text) && /حسابك لدينا 0\.300/.test(m.text), m.text);

  /* 5) delivered → thank-you message with what is left on this order */
  const nd = await count();
  await openOrder(o1.id); await page.click("#advanceStatusBtn"); await page.fill("#qf_count", "5"); await submit(); await wait(600);
  m = await last();
  check("confirm delivery → WhatsApp opens on the customer's chat at once (same tap, no 'send?' question)", (await count()) === nd + 1 && m.to === "97333445566" && !(await page.isVisible("#quickFormSubmitBtn")), m.to);
  check("delivered message: thanks + remaining on this order 0.300 (no link)", /تم تسليم طلبك/.test(m.text) && /المتبقي على هذا الطلب 0\.300/.test(m.text) && !/r\.html/.test(m.text), m.text);
  const clip = await page.evaluate(async () => { try { const items = await navigator.clipboard.read(); const it = items.find((x) => x.types.includes("image/png")); if (!it) return null; const b = await it.getType("image/png"); const img = await createImageBitmap(b); return { w: img.width, h: img.height }; } catch (e) { return { err: e.message }; } });
  check("…and the receipt image is on the clipboard, ready to paste in WhatsApp", clip && clip.w === 760 && clip.h > 600, JSON.stringify(clip));
  await openOrder(o1.id); const n0 = await count(); await page.click("#dialogWhatsappBtn"); m = await last();
  check("WhatsApp button on a delivered order sends the delivered message (not 'your order is ready')", (await count()) === n0 + 1 && /تم تسليم طلبك/.test(m.text) && !/جاهز/.test(m.text), m.text);

  /* 6) a second order, pay on pickup → ready message shows the full amount; reminder now has both + 'ready for pickup' */
  const o2 = await order("", "33445566", 4, true); await sendPrompt(); // 0.800
  await openOrder(o2.id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", "later"); await submit();
  await sendPrompt(); m = await last();
  check("pay-on-pickup ready message: amount due 0.800", /المبلغ المستحق: 0\.800/.test(m.text), m.text);
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), cust.id); await wait(200);
  await page.click("#cpRemind"); m = await last();
  check("reminder lists both orders and the total 1.100 (0.300 + 0.800 ready for pickup)", /#0+1: 0\.300/.test(m.text) && /#0+2: 0\.800 د\.ب \(جاهز للاستلام\)/.test(m.text) && /1\.100/.test(m.text), m.text);
  await closeAll(); await nav("balances"); await wait(200); await page.click('[data-bact="tab"][data-id="debtors"]'); await wait(200);
  const rb = await page.$('[data-bact="remind"]');
  if (rb) { await rb.click(); m = await last(); }
  check("balances page reminder gives the same numbers as the customer file", !!rb && /1\.100/.test(m.text) && /#0+2: 0\.800/.test(m.text), m.text);

  /* 7) deposit for a new customer → 'deposited', balance 'your credit with us' */
  const o3 = await order("Sara Credit", "36667788", 1); await sendPrompt();
  const c3 = (await ls("l997_customers")).find((c) => c.phone.includes("36667788"));
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), c3.id); await wait(200);
  await page.click("#cpSettle"); await page.fill("#qf_amount", "5"); await submit(); await wait(200);
  m = await last();
  check("deposit message: 'deposited 5.000' + 'your credit with us 5.000'", /تم إيداع 5\.000/.test(m.text) && /رصيدك لدينا: 5\.000/.test(m.text), m.text);
  await openOrder(o3.id); await page.click("#advanceStatusBtn"); await page.selectOption("#qf_method", "later"); await submit();
  await sendPrompt(); m = await last();
  check("ready message reminds a customer with credit that it can be used", /المبلغ المستحق: 0\.200/.test(m.text) && /لك رصيد لدينا 5\.000/.test(m.text), m.text);

  /* 8) package sold → confirmation; an order from the package says 'covered by your package' + pieces left */
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), c3.id); await wait(200);
  await page.click("#cpSellPkg"); await wait(200); await submit();
  await sendPrompt(); m = await last();
  check("package message: name, 10 pieces, price 1.500, bonus", /باقة قمصان 10/.test(m.text) && /عدد القطع: 10/.test(m.text) && /1\.500/.test(m.text) && /كوي غترة مجاناً/.test(m.text), m.text);
  const o4 = await order("", "36667788", 3, true); await sendPrompt(); m = await last();
  check("order from the package: 'fully covered by your package' and 7 of 10 left", /مغطاة بالكامل من الباقة/.test(m.text) && /استُخدم 3 قطع — متبقي 7 من 10/.test(m.text) && o4.payment.total === 0, m.text);
  await closeAll(); await openOrder(o4.id); await wait(150);
  const dlgTxt = await page.textContent("#orderDialogContent");
  const it4 = (await ls("l997_orders")).find((o) => o.id === o4.id).items[0], val4 = (it4.listUnit * it4.qty).toFixed(3);
  check("order details show the package items' value and that the package covered it", it4.listUnit > 0 && dlgTxt.includes(val4) && /قيمة قطع الباقة بالسعر العادي/.test(dlgTxt) && /مغطاة من الباقة \(3 قطعة\)/.test(dlgTxt) && /قيمتها بسعر الباقة/.test(dlgTxt), val4);
  await closeAll();

  /* 9) statement on WhatsApp: balance in words */
  await closeAll(); await page.evaluate((id) => window.openCustomerProfile997(id), cust.id); await wait(200);
  await page.click("#cpStatement"); await wait(300);
  const sb = await page.$('[data-bact="wa"], [data-bact="stmtwa"]');
  if (sb) { await sb.click(); m = await last(); }
  check("statement: balance in words, and a debt payment is labelled 'payment' (not 'deposit')", !!sb && /المتبقي عليك: 0\.300/.test(m.text) && /دفعة سداد: \+0\.300/.test(m.text) && !/💳 -/.test(m.text), m.text);

  /* WhatsApp Business API errors from Meta → clear Arabic instructions */
  const hints = await page.evaluate(() => [
    window.waErrHint997({ error: "send failed — Error validating access token: Session has expired on Friday" }),
    window.waErrHint997({ error: "image upload failed — Unsupported post request. Object with ID '123' does not exist" }),
    window.waErrHint997({ error: "send failed — (#132001) Template name does not exist in the translation" }),
    window.waErrHint997({ error: "send failed — (#131030) Recipient phone number not in allowed list" }),
    window.waErrHint997({ error: "whatsapp not configured", status: 503 }),
    window.waErrHint997({ error: "x", status: 404 }),
  ]);
  check("Meta errors become clear instructions (token, phone ID, template, test mode, secrets, missing function)",
    /WA_TOKEN/.test(hints[0]) && /Phone number ID/.test(hints[1]) && /order_delivered/.test(hints[2]) && /وضع التجربة/.test(hints[3]) && /Secrets/.test(hints[4]) && /غير موجودة/.test(hints[5]), hints.join(" | "));

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL WHATSAPP CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
