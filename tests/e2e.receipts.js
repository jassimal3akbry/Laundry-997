// Receipt image / PDF sharing on every kind of device:
//  • Android (share sheet with files + caption)      • iPhone / iPad (share sheet with the file only — WhatsApp drops
//    the image when text is attached)                   • share refused (NotAllowedError) → in-app preview
//  • phone without file sharing → in-app preview (no download)   • computer → download + preview
// Also checks the files themselves: a real PNG and a valid one-page PDF (pdfinfo / pdftoppm when installed).
// Usage: node tests/e2e.receipts.js [path-to-html]
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const { launchBrowser } = require("./browser");
const serve = require("./serve");

const file = path.resolve(process.argv[2] || path.join(__dirname, "..", "laundry-997-full.html"));
let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  → " + String(detail).slice(0, 300) : ""}`);
  if (!cond) failures++;
}
const UA = {
  android: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

(async () => {
  const url = await serve(file);
  const browser = await launchBrowser();
  const errors = [];
  // one device = one context; `share`: "ok" | "deny" | "none"
  async function device(kind, share) {
    const mobile = kind !== "desktop";
    const ctx = await browser.newContext({ timezoneId: "Asia/Bahrain", userAgent: UA[kind], viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile, isMobile: kind === "android" || kind === "iphone", acceptDownloads: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`[${kind}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript(([share, touch]) => {
      window.print = () => {};
      window.__shares = []; window.__wa = [];
      window.open = (u) => { window.__wa.push(u); return { closed: false }; };
      if (touch) Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
      if (share === "none") { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (e) { /* ignore */ } Object.defineProperty(navigator, "share", { value: undefined }); Object.defineProperty(navigator, "canShare", { value: undefined }); }
      else {
        navigator.canShare = (d) => !!(d && d.files && d.files.length && d.files.every((f) => /^(image\/png|application\/pdf)$/.test(f.type)));
        navigator.share = async (d) => {
          window.__shares.push({ t: performance.now() - (window.__clickAt || 0), n: d.files.length, type: d.files[0].type, name: d.files[0].name, size: d.files[0].size, text: d.text || "", title: d.title || "", head: Array.from(new Uint8Array(await d.files[0].slice(0, 8).arrayBuffer())) });
          if (share === "deny") { const e = new Error("not allowed"); e.name = "NotAllowedError"; throw e; }
        };
      }
    }, [share, mobile]);
    await page.goto(url);
    const PW = "Owner#2026pass";
    await page.fill("#au_name", "Owner"); await page.fill("#au_user", "owner"); await page.fill("#au_pw", PW); await page.fill("#au_pw2", PW);
    await page.click("#au_form button[type=submit]"); await page.check("#au_saved"); await page.click("#au_next");
    await page.waitForSelector("body:not(.auth-locked)");
    // one order, ready & paid
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    await page.evaluate(() => document.querySelector('.nav-item[data-page="new-order"]').click());
    await page.click("#posCustomerBarBtn"); await page.fill("#orderCustomerPhone", "33445566"); await page.waitForTimeout(150);
    await page.click("#newCustomerFromNoResultBtn"); await page.fill("#customerName", "Ali"); await page.fill("#customerPhone", "33445566"); await page.click("#saveCustomerBtn");
    await page.click('#posProductGrid [data-cloth="shirt"]'); await page.click('#posProductGrid [data-cloth="shirt"]');
    await page.click("#posSaveOrderMainBtn"); await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0].id);
    await page.evaluate(() => document.querySelector('.nav-item[data-page="orders"]').click());
    await page.evaluate((id) => document.querySelector(`#ordersBody [data-view="${id}"]`).click(), id);
    await page.waitForTimeout(900); // receipt files prepared in the background while the order is on screen
    return page;
  }
  const tap = async (page, sel) => { await page.evaluate(() => { window.__clickAt = performance.now(); }); await page.click(sel); await page.waitForTimeout(700); };
  const shares = (page) => page.evaluate(() => window.__shares);
  const preview = (page) => page.evaluate(() => { const d = document.getElementById("receiptPreviewDialog"); return d && d.open ? { img: !!d.querySelector("#rpImg") && d.querySelector("#rpImg").naturalWidth, dl: !!d.querySelector("#rpDownload"), wa: !!d.querySelector("#rpWa"), text: d.textContent } : null; });

  /* Android */
  let p = await device("android", "ok");
  await tap(p, "#dialogReceiptImgBtn");
  let s = await shares(p);
  check("Android: image opens the share sheet with ONE PNG and no extra text (WhatsApp duplicated the file when text was attached)", s.length === 1 && s[0].type === "image/png" && s[0].n === 1 && !s[0].text && !s[0].title && s[0].head[1] === 0x50, JSON.stringify(s[0] && { ...s[0], head: undefined }));
  check("Android: file is ready before the tap (share sheet opens immediately)", s.length === 1 && s[0].t < 60, s[0] && Math.round(s[0].t) + " ms");
  await tap(p, "#dialogReceiptPdfBtn"); s = await shares(p);
  check("Android: PDF opens the share sheet with a PDF file", s.length === 2 && s[1].type === "application/pdf" && String.fromCharCode(...s[1].head.slice(0, 5)) === "%PDF-", JSON.stringify(s[1] && { type: s[1].type, size: s[1].size }));
  check("Android: no preview / download needed when sharing works", !(await preview(p)));
  // the files themselves
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rcpt-"));
  const png = await p.evaluate(async (id) => (await window.receiptFile997(id, "image")), await p.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0].id));
  fs.writeFileSync(path.join(tmp, "r.png"), Buffer.from(png.split(",")[1], "base64"));
  const pdfBytes = await p.evaluate(async (id) => Array.from(new Uint8Array(await (await window.receiptFile997(id, "pdf")).arrayBuffer())), await p.evaluate(() => JSON.parse(localStorage.getItem("l997_orders"))[0].id));
  fs.writeFileSync(path.join(tmp, "r.pdf"), Buffer.from(pdfBytes));
  let pdfOk = null;
  try { const info = execFileSync("pdfinfo", [path.join(tmp, "r.pdf")]).toString(); execFileSync("pdftoppm", ["-png", "-r", "50", "-singlefile", path.join(tmp, "r.pdf"), path.join(tmp, "out")]); pdfOk = /Pages:\s+1/.test(info) && fs.statSync(path.join(tmp, "out.png")).size > 2000; } catch (e) { pdfOk = e.code === "ENOENT" ? "skipped" : false; }
  check("PDF is a valid one-page document that renders (pdfinfo/pdftoppm)", pdfOk === true || pdfOk === "skipped", pdfOk);
  await p.context().close();

  /* iPhone */
  p = await device("iphone", "ok");
  await tap(p, "#dialogReceiptImgBtn"); s = await shares(p);
  check("iPhone: share sheet gets the image only — no text (WhatsApp would drop the picture)", s.length === 1 && s[0].type === "image/png" && !s[0].text && !s[0].title, JSON.stringify(s[0] && { text: s[0].text, title: s[0].title }));
  check("iPhone: share starts right away after the tap (iOS refuses a late share)", s.length === 1 && s[0].t < 60, s[0] && Math.round(s[0].t) + " ms");
  await tap(p, "#dialogReceiptPdfBtn"); s = await shares(p);
  check("iPhone: PDF shared alone too", s.length === 2 && s[1].type === "application/pdf" && !s[1].text);
  await p.context().close();

  /* iPad (reports itself as a Mac) */
  p = await device("ipad", "ok");
  await tap(p, "#dialogReceiptImgBtn"); s = await shares(p);
  check("iPad (desktop-mode Safari): treated as Apple — image only", s.length === 1 && !s[0].text);
  await p.context().close();

  /* share refused → preview */
  p = await device("iphone", "deny");
  await tap(p, "#dialogReceiptImgBtn");
  let pv = await preview(p);
  check("share refused by the phone → receipt preview opens (long-press to save/share)", pv && pv.img > 0 && pv.dl && pv.wa && /اضغط مطوّلاً/.test(pv.text), JSON.stringify(pv && { img: pv.img, dl: pv.dl, wa: pv.wa }));
  await p.click("#rpWa"); await p.waitForTimeout(200);
  check("preview: 'open customer chat' opens WhatsApp to the customer", (await p.evaluate(() => window.__wa)).some((u) => /api\.whatsapp\.com\/send\?phone=97333445566/.test(u)));
  await p.context().close();

  /* phone without file sharing → preview only, no automatic download */
  p = await device("android", "none");
  let dl = 0; p.on("download", () => { dl++; });
  await tap(p, "#dialogReceiptPdfBtn"); pv = await preview(p);
  check("phone without file sharing: PDF preview shown (image of the receipt), no automatic download", pv && pv.img > 0 && dl === 0, JSON.stringify({ img: pv && pv.img, dl }));
  const [d1] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.click("#rpDownload")]);
  check("…'Download' button saves the PDF", d1 && /997-laundry-receipt-\d+\.pdf$/.test(d1.suggestedFilename()), d1 && d1.suggestedFilename());
  await p.context().close();

  /* Android tablet browser that can't send images (no file sharing, no image copy) → clear Chrome guidance */
  p = await device("android", "none");
  await p.evaluate(() => { try { delete window.ClipboardItem; } catch (e) { /* ignore */ } window.ClipboardItem = undefined; });
  await tap(p, "#dialogReceiptImgBtn"); pv = await preview(p);
  const chrome = await p.evaluate(() => { const a = [...document.querySelectorAll("#receiptPreviewDialog a")].find((x) => /Chrome/.test(x.textContent)); return a ? a.getAttribute("href") : ""; });
  check("weak Android browser: preview says to open the system in Google Chrome (one-tap link)", /Google Chrome/.test(pv && pv.text) && /^intent:\/\/127\.0\.0\.1:\d+\/.*package=com\.android\.chrome/.test(chrome), chrome.slice(0, 90));
  check("…and shows the 3 steps: save image → open chat → 📎 Gallery", /حفظ الصورة/.test(pv.text) && /فتح محادثة العميل/.test(pv.text) && /المعرض/.test(pv.text));
  await p.context().close();
  p = await device("android", "deny");
  await tap(p, "#dialogReceiptImgBtn"); pv = await preview(p);
  check("capable Android (Chrome): no Chrome warning, and a Share button in the preview", pv && !/Google Chrome/.test(pv.text) && await p.isVisible("#rpShare"));
  await p.context().close();

  /* computer without sharing → download + preview */
  p = await device("desktop", "none");
  const [d2] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), tap(p, "#dialogReceiptImgBtn")]);
  pv = await preview(p);
  check("computer: image downloads automatically and the preview explains how to attach it", d2 && /\.png$/.test(d2.suggestedFilename()) && pv && /تم تنزيل الملف/.test(pv.text), d2 && d2.suggestedFilename());
  await p.context().close();

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL RECEIPT-SHARING CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
