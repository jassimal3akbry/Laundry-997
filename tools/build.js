// Builds the single-file app: inlines src/styles.css and every <script src> into laundry-997-full.html.
// Usage: node tools/build.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");

let html = src("index.html");
html = html.replace('  <link rel="stylesheet" href="styles.css" />', () => "  <style>\n" + src("styles.css") + "\n</style>");
html = html.replace(/    <script src="([\w.-]+)"><\/script>/g, (_, f) => "    <script>\n" + src(f) + "\n</script>");
if (/<script src=|href="styles\.css"/.test(html)) throw new Error("build: an asset reference was not inlined");
// شعار المحل داخل الملف نفسه (يعمل بدون إنترنت وفي النسخة ذات الملف الواحد)
const LOGO = "data:image/png;base64," + fs.readFileSync(path.join(root, "brand", "logo-997-ui.png")).toString("base64");
html = html.split("__LOGO_997__").join(LOGO);

const out = path.join(root, "laundry-997-full.html");
fs.writeFileSync(out, html);
// نسخة باسم index.html ليفتحها رابط الموقع (GitHub Pages) مباشرة من الجوال
fs.writeFileSync(path.join(root, "index.html"), html);
// ملفات التطبيق على الجوال (العمل بدون إنترنت + الأيقونة) تُنسخ بجانب index.html
for (const f of fs.readdirSync(path.join(root, "src", "pwa"))) fs.copyFileSync(path.join(root, "src", "pwa", f), path.join(root, f));
console.log(`built ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
