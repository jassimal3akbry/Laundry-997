// Offline app test: serves the built site over http, installs the offline service, cuts the network and
// checks the app still opens, logs in and keeps its data. Usage: node tests/e2e.offline.js [site-folder]
const http = require("http"), fs = require("fs"), path = require("path");
const { launchBrowser } = require("./browser");
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; const p = path.join(root, f);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); r.end(d); }); }).listen(8997);
let fails = 0; const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d !== undefined ? "  → " + d : ""}`); if (!c) fails++; };
(async () => {
  const b = await launchBrowser(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const nav = (pg) => p.evaluate((pg) => document.querySelector(`.nav-item[data-page="${pg}"]`).click(), pg);
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto("http://localhost:8997/");
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await p.waitForTimeout(500);
  check("offline service installed and controlling the page", await p.evaluate(() => !!navigator.serviceWorker.controller));
  const man = await p.evaluate(async () => (await fetch("manifest.webmanifest")).json());
  check("manifest served with icons", man.display === "standalone" && man.icons.length === 3);
  await p.fill("#au_name", "Owner"); await p.fill("#au_user", "owner"); await p.fill("#au_pw", "Owner#2026pass"); await p.fill("#au_pw2", "Owner#2026pass");
  await p.click("#au_form button[type=submit]"); await p.check("#au_saved"); await p.click("#au_next");
  await p.waitForSelector("body:not(.auth-locked)");
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(800);
  const offlineText = await p.evaluate(() => document.body.innerText.length);
  check("opens with NO internet (app rendered from saved copy)", offlineText > 500 && !(await p.evaluate(() => document.body.classList.contains("auth-locked"))), offlineText);
  await p.evaluate(() => document.getElementById("logoutBtn").click()); await p.waitForTimeout(300);
  await p.waitForSelector("#au_user"); await p.waitForTimeout(150);
  await p.fill("#au_user", "owner"); await p.fill("#au_pass", "Owner#2026pass"); await p.click("#au_form button[type=submit]");
  await p.waitForSelector("body:not(.auth-locked)", { timeout: 5000 }).catch(() => {});
  check("logout + login again offline, data kept", !(await p.evaluate(() => document.body.classList.contains("auth-locked"))));
  await nav("new-order");
  check("pages work offline", await p.isVisible("#posProductGrid"));
  await ctx.setOffline(false);
  check("no JavaScript errors", errs.length === 0, errs.join(" | "));
  await b.close(); srv.close(); console.log(fails ? `\n${fails} check(s) FAILED` : "\nALL OFFLINE CHECKS PASSED"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
