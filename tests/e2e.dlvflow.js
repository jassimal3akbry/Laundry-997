// 🚚 WhatsApp bookings never get duplicated, and the delivery team works from one screen:
// a WhatsApp pickup shows an alert on every page; booking the same customer again is blocked; a new order for that
// customer links to the booking automatically (and can be split off); today's trips list with navigation and a full
// route; driver assignment; "collected" with bag count; missed attempts with reschedule; WhatsApp delivery requests.
// Usage: node tests/e2e.dlvflow.js [path-to-html]
const path = require("path");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).replace(/\n/g, " ⏎ ").slice(0, 320) : ""}`); if (!cond) failures++; }

(async () => {
  const browser = await launchBrowser();
  const page = await (await browser.newContext({ timezoneId: "Asia/Bahrain", viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    window.print = () => {};
    window.open = (url) => { const a = JSON.parse(sessionStorage.getItem("__open") || "[]"); a.push(String(url || "")); sessionStorage.setItem("__open", JSON.stringify(a)); return { closed: false }; };
    if (localStorage.getItem("l997_customers")) return;
    const now = new Date().toISOString(), today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(new Date());
    localStorage.setItem("l997_customers", JSON.stringify([
      { id: "c_um", name: "Um Ahmed", phone: "97339692392", balance: 0, area: "الرفاع", address: "منزل 1043 طريق 2120 مجمع 921", createdAt: now },
      { id: "c_x", name: "Other Guy", phone: "97333220002", balance: 0, createdAt: now }]));
    localStorage.setItem("l997_suspended_orders", JSON.stringify([
      { id: "wa1", kind: "pickup", source: "whatsapp", needsConfirm: true, customerId: "c_um", customerName: "Um Ahmed", address: "الرفاع — https://maps.google.com/?q=26.1301,50.5552", date: today, slot: "evening", drop: true, notes: "ثياب - العميلة تفضل الساعة 4 عصراً", status: "new", items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: "WhatsApp" }]));
  });
  await page.goto(await serve(file));
  const PW = "Owner#2026pass";
  const wait = (ms) => page.waitForTimeout(ms);
  const nav = (pg) => page.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const closeAll = () => page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  const submit = async () => { await page.click("#quickFormSubmitBtn"); await wait(250); };
  const later = async () => { await page.waitForSelector("#quickFormCancelBtn", { state: "visible", timeout: 1500 }).catch(() => {}); if (await page.isVisible("#quickFormCancelBtn")) await page.click("#quickFormCancelBtn"); await wait(150); };
  const pick = async (phone) => { await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", phone); await wait(200); await page.click("#customerResults [data-pick]"); await wait(150); };
  const fresh = async () => { await closeAll(); await nav("new-order"); await wait(150); while (await page.$("#orderItemsBody [data-remove]")) { await page.click("#orderItemsBody [data-remove]"); await wait(40); } };
  const saveOrder = async () => { await page.click("#posSaveOrderMainBtn"); await wait(400); await later(); await closeAll(); return (await ls("l997_orders"))[0]; };
  const opened = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("__open") || "[]"));

  await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
  await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
  await page.waitForSelector("body:not(.auth-locked)");
  await closeAll(); await nav("dashboard"); await wait(200);

  /* 1) WhatsApp booking → alert on every page */
  check("📲 a WhatsApp booking shows an alert chip outside the delivery page", await page.isVisible("#waIntakeChip") && /Um Ahmed/.test(await page.textContent("#waIntakeChip")));
  await nav("delivery"); await wait(200);
  check("…and it disappears on the delivery page", !(await page.isVisible("#waIntakeChip")));
  check("the WhatsApp card is marked and waits for confirmation", /واتساب/.test(await page.textContent('[data-card="wa1"]')) && await page.isVisible('[data-req-confirm="wa1"]'));

  /* 2) booking the same customer again is blocked */
  await page.click("#newPickupBtn"); await page.waitForSelector("#qf_cust");
  await page.fill("#qf_cust", "Um Ahm"); await wait(150);
  check("search marks the customer as already booked (📥)", /📥/.test(await page.textContent(".dlv-suggest")));
  await page.click(".dlv-hit"); await wait(150);
  check("picking them warns: already booked — don't book twice", await page.isVisible(".dlv-dup"));
  await submit();
  check("a second booking is refused", (await ls("l997_suspended_orders")).filter((r) => r.kind === "pickup").length === 1 && await page.isVisible("#quickFormSubmitBtn"));
  await closeAll();

  /* 3) a new order for that customer links to the booking (no duplicate), and can be split off */
  await fresh(); await pick("39692392");
  check("the new order is linked to the WhatsApp booking automatically", await page.isVisible(".pos-dlv-link") && await page.isChecked("#dlvPickup"));
  check("…and the booking's note is carried to the order", /الساعة 4/.test(await page.inputValue("#orderNotes")));
  await page.click("#dlvUnlink"); await wait(150);
  check("«separate order» unlinks it", !(await page.isVisible(".pos-dlv-link")) && !(await page.isChecked("#dlvPickup")));
  await pick("33220002"); await pick("39692392");
  check("…choosing the customer again links again", await page.isVisible(".pos-dlv-link"));
  await page.click('#posProductGrid [data-cloth="thob_cotton"]'); await wait(100);
  const o1 = await saveOrder();
  check("saving the order uses up the booking (nothing left to book twice)", !(await ls("l997_suspended_orders")).some((r) => r.id === "wa1"), JSON.stringify(await ls("l997_suspended_orders")));
  check("the order keeps pickup + delivery back and the WhatsApp source", o1.delivery && o1.delivery.pickup && o1.delivery.drop && o1.delivery.source === "whatsapp" && o1.delivery.reqId === "wa1", JSON.stringify(o1.delivery));

  /* 4) driver flow: go to pickup → collected (bags) → missed attempt → reschedule */
  const today = await page.evaluate(() => window.L997Finance.todayStr());
  await page.evaluate((today) => { const a = JSON.parse(localStorage.getItem("l997_suspended_orders") || "[]"); a.unshift({ id: "p2", kind: "pickup", customerId: "c_x", customerName: "Other Guy", address: "سند مجمع 743", date: today, slot: "morning", drop: true, notes: "", status: "new", items: [], extras: [], createdAt: new Date().toISOString(), suspendedAt: new Date().toISOString(), createdBy: "Owner" }); localStorage.setItem("l997_suspended_orders", JSON.stringify(a)); }, today);
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("delivery"); await wait(200);
  check("🧭 today's trips list the pickup with a Go (navigation) button", /Other Guy/.test(await page.textContent(".dlv-route")) && (await page.getAttribute(".dlv-stop .primary-btn", "href")).includes("google.com/maps/dir/"));
  check("🗺 full-route button opens Google Maps directions", (await page.getAttribute("#dlvRouteBtn", "href") || "").includes("maps/dir/?api=1"));
  await page.selectOption('[data-drv="req|p2"]', { index: 1 }); await wait(150);
  check("driver can be assigned", !!(await ls("l997_suspended_orders")).find((r) => r.id === "p2").driverId);
  await page.click('[data-req-onway="p2"]'); await wait(250);
  check("«go to pickup» marks on the way and opens navigation", (await ls("l997_suspended_orders")).find((r) => r.id === "p2").status === "onway" && (await opened()).some((u) => u.includes("maps/dir/") && u.includes(encodeURIComponent("سند"))));
  await page.click('[data-req-collected="p2"]'); await page.waitForSelector("#qf_bags"); await page.fill("#qf_bags", "3"); await page.fill("#qf_pcs", "20"); await submit();
  const p2 = (await ls("l997_suspended_orders")).find((r) => r.id === "p2");
  check("«collected» records 3 bags and ~20 pieces, waiting at the shop", p2.status === "collected" && p2.bags === 3 && p2.pcsEst === 20, JSON.stringify(p2));
  check("…and the card now asks to add the items at the shop", await page.isVisible('[data-card="p2"] [data-req-done="p2"]'));
  await page.evaluate(() => { const a = JSON.parse(localStorage.getItem("l997_suspended_orders")); a.find((r) => r.id === "p2").status = "onway"; localStorage.setItem("l997_suspended_orders", JSON.stringify(a)); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("delivery"); await wait(200);
  await page.click('[data-req-miss="p2"]'); await page.waitForSelector("#qf_reason"); await page.selectOption("#qf_reason", "away"); await page.selectOption("#qf_notify", "no"); await submit();
  const p2b = (await ls("l997_suspended_orders")).find((r) => r.id === "p2");
  check("⚠ missed attempt is recorded with its reason and the visit moves to tomorrow", p2b.attempts && p2b.attempts.length === 1 && p2b.status === "new" && p2b.date > today, JSON.stringify(p2b));
  check("…and the card shows the missed attempt", /محاولات لم تتم: 1/.test(await page.textContent('[data-card="p2"]')));

  /* 5) WhatsApp delivery request for a ready order → confirmed onto the order */
  await page.evaluate((oid) => { const os = JSON.parse(localStorage.getItem("l997_orders")); const o = os.find((x) => x.id === oid); o.status = "ready"; o.delivery = { pickup: true, drop: false, address: "" }; localStorage.setItem("l997_orders", JSON.stringify(os));
    const a = JSON.parse(localStorage.getItem("l997_suspended_orders")); a.unshift({ id: "dr1", kind: "dropreq", source: "whatsapp", needsConfirm: true, customerId: "c_um", customerName: "Um Ahmed", orderId: oid, orderNumber: o.number, address: "الرفاع مجمع 921", date: "", slot: "night", notes: "", status: "new", items: [], extras: [], createdAt: new Date().toISOString(), suspendedAt: new Date().toISOString(), createdBy: "WhatsApp" }); localStorage.setItem("l997_suspended_orders", JSON.stringify(a)); }, o1.id);
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("delivery"); await wait(200);
  check("the WhatsApp delivery request appears in «to deliver» with the order number", await page.isVisible(`[data-dreq-ok="dr1|${o1.id}"]`));
  await page.click(`[data-dreq-ok="dr1|${o1.id}"]`); await wait(300);
  const o1b = (await ls("l997_orders")).find((x) => x.id === o1.id);
  check("confirming sets home delivery on the order and removes the request", o1b.delivery.drop && o1b.delivery.address === "الرفاع مجمع 921" && o1b.delivery.slot === "night" && !(await ls("l997_suspended_orders")).some((r) => r.id === "dr1"), JSON.stringify(o1b.delivery));
  check("…and the order is now on the delivery board, ready to go", await page.isVisible(`[data-drop-onway="${o1.id}"]`));
  await page.click(`[data-drop-onway="${o1.id}"]`); await wait(250);
  check("«go to deliver» marks out for delivery and opens navigation", (await ls("l997_orders")).find((x) => x.id === o1.id).delivery.dropStatus === "onway" && (await opened()).filter((u) => u.includes("maps/dir/")).length >= 2);
  await page.click(`[data-drop-miss="${o1.id}"]`); await page.waitForSelector("#qf_reason"); await page.selectOption("#qf_notify", "no"); await submit();
  const o1c = (await ls("l997_orders")).find((x) => x.id === o1.id);
  check("a missed delivery goes back to pending with the attempt logged", o1c.delivery.dropStatus === "pending" && o1c.delivery.attempts.length === 1);
  await page.click("#dlvPrintBtn").catch(() => {}); await wait(400);
  check("🖨 trip sheet prints without errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  /* 5b) a booking made in the customer app: same alert, marked 📱 App */
  await page.evaluate(() => { const a = JSON.parse(localStorage.getItem("l997_suspended_orders")); a.unshift({ id: "ap1", kind: "pickup", source: "app", needsConfirm: true, customerId: "c_x", customerName: "Other Guy", address: "سند", date: "", slot: "noon", drop: true, notes: "", status: "new", items: [], extras: [], createdAt: new Date().toISOString(), suspendedAt: new Date().toISOString(), createdBy: "التطبيق" }); localStorage.setItem("l997_suspended_orders", JSON.stringify(a.filter((r) => r.id !== "p2"))); });
  await page.reload(); await page.waitForSelector("#au_user, body:not(.auth-locked)");
  if (await page.isVisible("#au_user")) { await page.fill("#au_user", "owner"); await page.fill("#au_pass", PW); await page.click("#au_form button[type=submit]"); await page.waitForSelector("body:not(.auth-locked)"); }
  await closeAll(); await nav("dashboard"); await wait(200);
  check("📱 a booking from the customer app raises the alert («from the app»)", await page.isVisible("#waIntakeChip") && /التطبيق/.test(await page.textContent("#waIntakeChip")));
  await nav("delivery"); await wait(200);
  check("…and its card is marked 📱 App with a confirm button", /التطبيق/.test(await page.textContent('[data-card="ap1"]')) && await page.isVisible('[data-req-confirm="ap1"]'));

  /* 6) phone */
  await page.setViewportSize({ width: 390, height: 844 }); await wait(200);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("works on a phone (no sideways scroll)", over <= 1, over);

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL DELIVERY-FLOW CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
