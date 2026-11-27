# 997 Laundry — instructions for Claude Code

The owner (Jassim) runs **997 Laundry, Riffa, Bahrain**, and is not a programmer. Talk to him in Arabic (Gulf/Bahraini is fine), short and practical; he may write quickly with typos or mixed Arabic/English. Act as lead engineer: decide, build, test, publish, then tell him plainly what changed and what (if anything) he must do. Never ask him for passwords, API keys or tokens in chat — keys go only into Supabase → Edge Functions → Secrets.

## Owner directive

Follow [AGENTS.md](AGENTS.md), [SPEC.md](SPEC.md) and [OWNER-DECISIONS.md](OWNER-DECISIONS.md). Record verified work in [PROGRESS.md](PROGRESS.md) and [TEST-REPORT.md](TEST-REPORT.md). Use an isolated branch and draft pull request. Production access, merging, deployment, live integrations and paid commitments require specific owner approval.

## The three parts
| Part | Folder | Live at | Users |
|---|---|---|---|
| Management system (single-page app) | `src/` → built by `tools/build.js` into `index.html`, `laundry-997-full.html`, `r.html` | https://997-laundry.github.io/ | owner + staff |
| Customer app (Expo / React Native, iPhone + Android + web) | `customer-app/` | https://997-laundry.github.io/app/ (web build in `app/`) | customers |
| Server (Supabase project `szlfvwzuyllitqkdysju`) | `supabase/` (SQL + Edge Functions) | Supabase | both |

Edge Functions (the owner pastes the code in Supabase → Edge Functions → *name* → Code → Deploy; there is no CLI deploy from here):
- `whatsapp-bot` — WhatsApp AI assistant (Meta webhook + Claude). Bahraini tone, books pickup/delivery **requests** (staff confirm), hands chats to staff, confirms customer-app sign-in codes. Verify JWT: OFF.
- `whatsapp-send` — sends receipts/templates from the system.
- `customer-api` — the customer app's only door to data. Sign-in = the customer sends a one-time code (`997-123456`) to the shop's WhatsApp; the function finds that message in `wa_messages` and issues a signed session. Returns ONLY that customer's orders/packages/balance + the public price list; writes pickup (`kind: "pickup"`) and delivery (`kind: "dropreq"`) requests into `suspended_orders` with `source: "app"`, `needsConfirm: true`. Verify JWT: OFF.

Data model: every business record lives in table `records` (`shop_id`, `collection`, `record_id`, `data` JSON, `version`, `seq`). Collections: `orders`, `customers`, `ledger`, `customer_packages`, `suspended_orders` (held orders + pickup/delivery requests), `settings` (doc `_`: prices, packageDefs, delivery policy, waBot…), `profile`, `custom_garments`, etc. The service role can only **insert/select** `records` from functions (no update) — so functions add requests; staff confirm them in the system.

## Rules that matter
- **When the owner expressly approves publication, publish only after tests pass**: `npm run check` and `npm run check:cloud` (run `service postgresql start` first). Then `git push origin main` and `git push site HEAD:main` (the `site` remote is the GitHub Pages repo), and verify the live site with curl.
- Customer app: `cd customer-app && npx tsc --noEmit && npm run publish:web && npm run test:web` before committing a change to it. Read `customer-app/AGENTS.md` (Expo SDK 58 — use `npx expo install`, Expo Router in `src/app/`).
- Never run destructive SQL on production (no `golive_reset.sql`), never commit customer data or backups, never put model names in commit messages or code comments.
- Money is always BHD with 3 decimals. Arabic RTL first, English second (Urdu in the system).
- Every sensitive action in the system: permission check `can()`, `logActivity()`, `requireOverride()` for supervisor approval, money figures from `L997Finance` only.
- WhatsApp bookings from the bot or the app must never create duplicates: the system links a new order to an open pickup booking automatically (`openPickupFor`), and both servers refuse a second open booking.
- Private packages (`packageDefs[].private`) are never shown to customers (bot, app).

## Prices & packages (published on Instagram)
Iron-only: pick-up at shop 50/100/150 pcs = 8.500/15.900/22.500 BD (60/90/120 days, no deliveries); with delivery = 10.900/19.900/27.900 (4/6/8 deliveries).
Wash & iron: 50=16.900 (60d, 4) · 80=25 (75d, 6) · 100=30 (90d, 8, + comforter) · 120=35 (105d, 8, + comforter) · 150=42 (120d, 10, + comforter) · 200=54 (150d, 12, + 2 comforters).
Abaya/jalabiya = 2 pieces; comforter & double sheet = 2 when ironing; shoes outside packages. One-tap apply: Settings → Packages → «تطبيق الباقات المنشورة».

## Contacts / identity
Shop WhatsApp +973 3959 9902 (Business app on the shop phone + Cloud API coexistence). CR 88745-2. Brand: navy #0f2a44, blue #2f8eb8, sky #5587c6, font Tajawal; logo in `src/pwa/icon-512.png`, app assets in `customer-app/assets/`.

More history: `PROJECT_CONTEXT.md`, `docs/` (WhatsApp setup, go-live, audits), `customer-app/README.md` (app roadmap & store publishing).
