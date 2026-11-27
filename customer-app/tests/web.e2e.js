// Browser test of the customer app's web build (dist/) with the customer-api mocked.
// Usage: npm run export:web && node tests/web.e2e.js [screenshots-dir]
const http = require("http"), fs = require("fs"), path = require("path");
const { launchBrowser } = require("../../tests/browser");
const DIST = path.join(__dirname, "..", "dist"), SHOTS = process.argv[2] || "";
let failures = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d !== undefined ? "  → " + String(d).slice(0, 200) : ""}`); if (!c) failures++; };
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith("/app")) p = p.slice(4) || "/";
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html"); // SPA fallback (like 404.html on GitHub Pages)
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(new Date());
const ORDERS = [
  { id: "o1", number: "00055", status: "received", createdAt: new Date().toISOString(), readyAt: "", deliveredAt: "", urgent: false, pieces: 25, total: 0, owed: 0, paid: true, payLater: false, fromPackage: true, delivery: { pickup: true, drop: true, address: "الرفاع — مجمع 921", date: "", slot: "", status: "pending" }, receipt: "" },
  { id: "o2", number: "00048", status: "ready", createdAt: new Date().toISOString(), readyAt: "", deliveredAt: "", urgent: true, pieces: 6, total: 2.4, owed: 2.4, paid: false, payLater: false, fromPackage: false, delivery: null, receipt: "https://997-laundry.github.io/r.html?t=x" },
  { id: "o3", number: "00031", status: "delivered", createdAt: "2026-11-01T10:00:00Z", readyAt: "", deliveredAt: "2026-11-03T10:00:00Z", urgent: false, pieces: 10, total: 5, owed: 0, paid: true, payLater: false, fromPackage: false, delivery: null, receipt: "" },
];
const calls = [];
function reply(body) {
  calls.push(body);
  switch (body.action) {
    case "catalog": return { shop: { nameAr: "مغسلة 997", nameEn: "997 Laundry", area: "الرفاع", address: "", phone: "97339599902", hours: "مفتوح 24 ساعة" },
      services: [{ id: "washiron", ar: "غسيل وكي", en: "Wash & Iron" }, { id: "iron", ar: "كي", en: "Iron" }, { id: "dryclean", ar: "تنظيف جاف", en: "Dry clean" }],
      items: [{ id: "thob_cotton", ar: "ثوب", en: "Thobe", cat: "", prices: { washiron: 0.5, iron: 0.2 } }, { id: "abaya_plain", ar: "عباية", en: "Abaya", cat: "", prices: { washiron: 1, iron: 0.5 } }, { id: "jacket", ar: "جاكيت", en: "Jacket", cat: "", prices: { washiron: 1, dryclean: 2 } }],
      packages: [{ id: "p1", name: "غسيل وكوي 50 قطعة", service: "washiron", pieces: 50, price: 16.9, perPiece: 0.338, validDays: 60, trips: 4, tripsPeriod: "total", bonus: "", itemsLimited: false },
        { id: "p2", name: "غسيل وكوي 100 قطعة", service: "washiron", pieces: 100, price: 30, perPiece: 0.3, validDays: 90, trips: 8, tripsPeriod: "total", bonus: "لحاف مجاني", itemsLimited: false }],
      delivery: { on: true, fee: 0.5, pkgFree: 4, pkgFee: 0.5, freeOver: 0, slots: ["morning", "noon", "evening", "night"] }, urgent: { hours: 6, normalHours: 24 } };
    case "login_start": return { code: "997-482913", nonce: "n", expiresAt: Date.now() + 600000, shopNumber: "97339599902", text: "رمز", link: "https://wa.me/97339599902?text=x" };
    case "login_check": return calls.filter((c) => c.action === "login_check").length >= 2 ? { ok: true, token: "tok", customer: { id: "c1", name: "أم أحمد", phone: "97339692392" } } : { ok: false, waiting: true };
    case "home": return { customer: { id: "c1", name: "أم أحمد", phone: "97339692392", area: "الرفاع", address: "منزل 1043 طريق 2120 مجمع 921" }, balance: -2.4, debt: 2.4, credit: 0,
      active: ORDERS.slice(0, 2), recent: ORDERS.slice(2), owedTotal: 2.4,
      packages: [{ id: "cp1", name: "غسيل وكوي 50 قطعة", service: "washiron", total: 50, left: 25, expiresAt: "2027-01-20", expired: false, trips: 4, tripsPeriod: "total", purchasedAt: "" }],
      requests: [], loyalty: { cardNo: "997-692392", points: 1240, value: 2, tier: "gold", tierAr: "ذهبي", tierEn: "Gold", commitment: 92, spent90: 70, next: { ar: "بلاتيني", en: "Platinum", need: 50 }, redeemPoints: 500, redeemValue: 1, perBD: 10 } };
    case "orders": return { orders: ORDERS };
    case "order": return { order: { ...ORDERS.find((o) => o.id === body.id), items: [{ ar: "ثوب", en: "Thobe", serviceAr: "غسيل وكي", serviceEn: "Wash & Iron", qty: 4, total: 2, fromPackage: false, value: 2, urgent: true }, { ar: "غترة", en: "Ghutra", serviceAr: "كي", serviceEn: "Iron", qty: 2, total: 0, fromPackage: true, value: 0.6, urgent: false }], extras: [], subtotal: 2.4, discount: 0, urgentFee: 0, packageValue: 0.6, history: [{ status: "received", at: new Date().toISOString() }] } };
    case "book_pickup": case "request_delivery": case "feedback": return { ok: true };
    default: return { error: "unknown" };
  }
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/app/`;
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, locale: "ar-BH", timezoneId: "Asia/Bahrain" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const opened = []; await page.exposeFunction("__opened", (u) => opened.push(u));
  await page.addInitScript(() => { window.open = (u) => { window.__opened(String(u)); return null; }; });
  await page.route(/functions\/v1\/customer-api/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "feedback" && !calls.some((call) => call.action === "feedback")) {
      calls.push(body);
      return route.abort("internetdisconnected");
    }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(reply(body)) });
  });
  await page.route(/wa\.me|google\.com/, (r) => r.fulfill({ status: 200, body: "ok" }));
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `app-${n}.png`) }); };
  const text = () => page.evaluate(() => document.body.innerText);
  const tap = (t) => page.getByText(t, { exact: false }).first().click();

  await page.goto(base);
  await page.getByText("الدخول عبر واتساب", { exact: true }).waitFor();
  check("signed-out customers land on the WhatsApp sign-in screen (Arabic first)", /حياك الله في مغسلة 997/.test(await text()) && /الدخول عبر واتساب/.test(await text()));
  await shot("1-login");
  await tap("الدخول عبر واتساب"); await page.waitForTimeout(1200);
  check("…it shows the code while waiting for the WhatsApp message", /997-482913/.test(await text()));
  await page.waitForTimeout(6500);
  check("after the code arrives on WhatsApp the customer is signed in (home)", /هلا والله أم/.test(await text()), (await text()).slice(0, 120));
  check("home shows the debt banner, active orders and the package", /عليك مبلغ متبقي/.test(await text()) && /#00055/.test(await text()) && /25/.test(await text()) && /قطعة متبقية/.test(await text()));
  check("💳 loyalty card on home: tier, points, card number", /ذهبي/.test(await text()) && /1,240/.test(await text()) && /997-692392/.test(await text()));
  await shot("2-home");
  await tap("#00048"); await page.waitForTimeout(1200);
  check("order details: items, package value, remaining, deliver-home button", /غترة/.test(await text()) && /0.600/.test(await text()) && /المتبقي/.test(await text()) && /وصّلوه لي البيت/.test(await text()));
  await shot("3-order");
  await tap("وصّلوه لي البيت"); await page.waitForTimeout(1000);
  await tap("تأكيد الحجز"); await page.waitForTimeout(1000);
  const dr = calls.find((c) => c.action === "request_delivery");
  check("delivery request sent with the order and the saved address", dr && dr.orderId === "o2" && dr.address === "منزل 1043 طريق 2120 مجمع 921", JSON.stringify(dr));
  await page.goto(base + "book"); await page.waitForTimeout(1500);
  check("booking screen pre-fills the customer's address", /احجز استلام من البيت/.test(await text()) && (await page.inputValue('[data-testid="address"]')) === "منزل 1043 طريق 2120 مجمع 921");
  await tap("ليلاً 8–12"); await page.fill('[data-testid="notes"]', "اتصل قبل"); await shot("4-book");
  await tap("تأكيد الحجز"); await page.waitForTimeout(1000);
  const bk = calls.find((c) => c.action === "book_pickup");
  check("pickup booked: today, night slot, note, deliver back", bk && bk.slot === "night" && bk.date === today && bk.notes === "اتصل قبل" && bk.drop === true, JSON.stringify(bk));
  check("…and the customer is told the shop will confirm", /أبشر! وصل طلبك/.test(await text()));
  await page.goto(base + "prices"); await page.waitForTimeout(1500);
  check("prices: live list and packages with per-piece price", /ثوب/.test(await text()) && /0.500/.test(await text()) && /0.338/.test(await text()) && /لحاف مجاني/.test(await text()));
  await shot("5-prices");
  await page.fill('input[placeholder*="ابحث"]', "عباية"); await page.waitForTimeout(400);
  check("search filters the price list", /عباية/.test(await text()) && !/جاكيت/.test(await text()));
  await page.goto(base + "account"); await page.waitForTimeout(1500);
  check("account shows the full card with the redeem button", /استبدال النقاط على واتساب/.test(await text()) && /التزامك بالدفع: 92%/.test(await text()));
  await shot("6a-account");
  await tap("English"); await page.waitForTimeout(600);
  check("English switch works everywhere", /Account/.test(await text()) && /Sign out/.test(await text()));
  await shot("6-account-en");
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("fits a phone screen (no sideways scroll)", over <= 1, over);
  await page.goto(base + "order/o3");
  await page.getByLabel("5", { exact: true }).click();
  await page.getByText("Send", { exact: true }).click();
  await page.getByText("No internet connection", { exact: true }).waitFor();
  check("rating failure shows a retryable error instead of losing the rating", !!(await page.getByText("Send", { exact: true }).isEnabled()));
  await page.getByText("Send", { exact: true }).click();
  await page.getByText("Thanks for your rating", { exact: false }).waitFor();
  const ratingCalls = calls.filter((call) => call.action === "feedback");
  check("retry submits the same rating for the delivered order", ratingCalls.length === 2 && ratingCalls.every((call) => call.orderId === "o3" && call.rating === 5));
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CUSTOMER-APP CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
