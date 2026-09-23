# 🌾 AgriLink — Smart Farmer Marketplace & AI Transaction Copilot

> **Live demo:** [linkagri.antideploy.com](https://linkagri.antideploy.com/) · [GitHub repository](https://github.com/tejasrajm46-strix/linkagri)

AgriLink is a role-based farm-to-market operating system for farmers, FPOs, buyers,
transporters and admins. It turns a noisy market decision into a traceable trade:
**read the market → compare net realisation → match with a buyer → manage the order → get paid**.

**SIH Problem Statement 26132 · Smart Farmer Market Intelligence, Price Discovery & Transaction Platform**

AgriLink connects **farmers, FPOs, verified buyers, transporters and admins** on one responsive
web app — from **market intelligence → AI decision support → lot creation → offers → orders →
logistics → payment → trust & grievance**.

The full demo loop works end-to-end on real seeded data:

```
Farmer → Market Prices → AI Recommendation → Net Realisation → Buyer Match
       → Lot → Offer → Accept → Order → Logistics → Delivery → Payment
```

---

## ✨ What's implemented

| Role            | Key screens                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🌾 Farmer / FPO | Dashboard (KPIs, price trend, AI sell/hold recommendation), Market Prices, Buyer Marketplace with explainable match %, My Lots + quality, Offer accept/counter/reject, Orders & Logistics, Payments, Net Realisation Calculator, **Crop Planner**, Lab & Crop Health, Grievances |
| 🛒 Buyer        | Dashboard, Produce Marketplace, Post requirements, Make offers, Orders, Pay                                                                                                                                                                                                      |
| 🚚 Transporter  | Job board — accept pickup jobs, update PICKED_UP → IN_TRANSIT → DELIVERED (proof + notes)                                                                                                                                                                                        |
| 🛡️ Admin        | Analytics, verification queue, dispute resolution, market-data freshness, high-value/risk monitoring                                                                                                                                                                             |
| 🤖 Everyone     | **AgriLink AI Copilot** (full-screen chat + floating button on every page)                                                                                                                                                                                                       |

Highlights that map to the SIH spec:

- **AI rules are enforced**: the copilot answers only from backend _tools_ reading the database.
  It never invents prices/buyers/payments/logistics. Every forecast shows a **range, confidence,
  timestamp and factors** — forecasting is a separate rule-based service, not the LLM.
- **Transaction actions need explicit confirmation**: create lot, send/accept/counter offers,
  schedule pickup, update delivery, raise grievance, post demand → the bot pauses and the user
  taps **Confirm / Cancel**.
- **Net realisation calculator** (gross − transport − handling − commission − storage − loss =
  the real ₹/kg) — the product's key differentiator.
- **Order lifecycle timeline** and **payment ledger** per order (advance, paid, pending, due date, ref).
- Fully **responsive + touch friendly**: desktop sidebar, mobile bottom navigation, bottom-sheet
  modals, full-screen chatbot on phones, scrollable tables. Includes a PWA `manifest.webmanifest`.
- **Notifications** go through an abstraction (`src/lib/notifications.ts`) so SMS / WhatsApp /
  push providers can be plugged in without touching app code.
- **Role-based access control** on every API, JWT httpOnly sessions, bcrypt passwords, audit log
  on all key actions, server-side validation (zod-style checks + Prisma), secrets only in `.env`.

## 🧪 Lab Testing & AI Crop Health (new)

A full lab-testing module wired into the existing app (nav → **Lab & Crop Health**):

- **Report a problem** — crop, variety, linked lot, problem category, description, symptoms, severity, affected area, photos-ready fields, preferred lab + date.
- **Lab directory** — 4 seeded demo labs with services, crops, tests, accreditation, rating, price, turnaround; filter by test type / crop / distance / price; _Contact Lab_ + _Request Test_.
- **Request lifecycle** — DRAFT → REQUESTED → LAB_ACCEPTED → SAMPLE_SUBMITTED → TESTING → REPORT_READY → COMPLETED (+ CANCELLED/REJECTED) with a visual timeline. Server-side state machine: illegal transitions return 409; demo mode lets the farmer simulate lab steps.
- **Private report upload** — PDF/JPG/PNG, max 5 MB, server-side MIME + magic-byte validation, stored in `.uploads/` (outside `public/`), delivered only through an ownership-checked download route. Reports are never publicly served.
- **AI report analysis** — structured A–G output (summary → abnormal findings → causes → crop impact → next steps → prevention → expert verification) with High/Medium/Low confidence + reason. Never fabricates values; chemical advice is category-level with verify-with-expert + follow-the-label language. Works offline in DEMO_MODE; uses OpenRouter when configured.
- **Crop health history** — cases auto-created from uploads, linked to requests/reports/analyses, with action tracking and status.
- **Ask an Expert** — farmer sends the case context + question; stored; admin answers via the consultations API; response lands in the case history.
- **AI Copilot** — asking about yellow leaves / pests / disease / lab reports now replies with your latest report + analysis and points to /lab-testing.
- **Notifications** — request submitted, lab status milestones, report uploaded, analysis ready, expert response.

Demo data (clearly marked **DEMO DATA**): AgriLab Testing Center + 3 more labs, request LT-1001 (tomato leaf spots, sample at lab), completed report LR-1001, a curated Medium-confidence AI analysis, crop-health case CH-1001 and an answered expert consultation.

New API routes: `/api/labs`, `/api/lab-tests(/:id)`, `/api/lab-reports(/:id, /file, /analyze)`, `/api/crop-health(/:id)`, `/api/expert-consultations(/:id)` — all ownership-scoped (farmers see only their own; admins see all; buyers/transporters see the lab directory only).

## 🌱 Crop Planner & dark theme (new)

Nav → **Crop Planner**. A season-long planning console, dark-first and theme-aware:

- **Popular crop selectors** — every crop in the catalogue with its live APMC index and week-on-week
  move, filterable by category (Vegetables / Fruits / Cash Crops / Cereals / Spices). Switching a crop
  re-plans the dossier, scanner and outlook.
- **Crop dossier** — family, cycle length, best season, soil & pH, planting guide (spacing, seed depth),
  water benchmark and the peak selling window with the current market range.
- **AI synthesis + suitability** — one grounded paragraph (free OpenRouter model, JSON-shaped request)
  plus a suitability index whose inputs are printed next to it: 7-day price momentum, live buyer demand
  and average plot health. Nothing is invented: no model answer → deterministic synthesis, labelled
  `OFFLINE ENGINE` in the UI. Leaked model reasoning is detected and rejected rather than shown.
- **Optical bio-scanner** — scroll scrubs the optical depth 1.8x → 3.5x and lights up the telemetry cards.
  The figures are the crop's **published quality profile** (Brix, lycopene, dry matter…) from
  `src/lib/cropGuide.ts`; the UI says so and points at the lab module for measured values.
- **Water & care protocols, pest & disease scan, market outlook** — curated agronomy plus live bazaar
  data (nearest mandi + distance, 7-day trajectory, active bidders, posted demand kg).
- **Module 2 — rotation & acreage allocation** — Kharif/Rabi/Zaid season clock with today's position,
  a five-stage lifecycle pipeline (day ranges, labour allocation, required inputs, current stage auto-derived
  from the sowing date) and the **field zoning table** (plot → crop → acreage → health → projected yield → log).
- **Net realisation forecast + field activity log** — projected yield at the live index through the same
  engine as `/calculator`, and an append-only log of every stage tick, plot action and scan capture.
- **Export Sowing Plan** — CSV of the plan, stages, plots and economics (`/api/planner/export`).
- **Add New Crop Zone** — projected yield is computed server-side from the crop's published per-acre yield
  and the plot health, so a client can never post a yield it likes.

New API routes: `/api/planner` (read), `/api/planner/synthesis` (AI upgrade, rate limited per user),
`/api/planner/zones`, `/api/planner/log`, `/api/planner/export` — ownership-scoped, same-origin checked,
role-gated for writes.

**Dark theme.** The palette is now CSS-variable driven (`surface` / `card` / `elevated` / `ink` / `line`)
with Tailwind `darkMode: "class"`, so every existing page follows the theme from its shared classes.
The header has a light/dark toggle that persists to `localStorage`, and a blocking script in the root
layout applies it before the first paint so dark mode never flashes.

## 🧱 Tech stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS — responsive, mobile-first
- **Backend**: Next.js Route Handlers (REST) + business logic in `src/lib`
- **Database**: PostgreSQL via Prisma (27 tables — users, profiles, lots, offers, orders,
  logistics, payments, disputes, chat, audit, notifications, market prices & arrivals,
  crop plans, crop plan zones, planner activity…)
- **AI**: OpenRouter chat completions with **function/tool calling**; deterministic
  forecasting service; offline rule-based fallback when no API key is set
- **Charts**: dependency-free server-rendered SVG (works offline, tiny bundle)

```
prisma/            schema.prisma + seed.ts (realistic demo data)
src/app/           pages (login, dashboards, prices, buyers, lots, orders, payments,
                   calculator, planner, lab-testing, disputes, notifications, chat,
                   admin) + /api/* routes
src/lib/           auth, chat engine + tools, forecast, matching, net realisation,
                   planner (indices, suitability, synthesis), cropGuide (agronomy),
                   ai (free-model guard), notifications, ids, format, nav config
src/components/    app shell (sidebar/bottom-nav), charts, modals, dashboards
```

---

## 🚀 Quick start (local)

**Prerequisites:** Node.js ≥ 18 and Docker Desktop **or** a running PostgreSQL 16.

```bash
# 1. install dependencies
npm install

# 2. create your env file (values already match local docker-compose)
cp .env.example .env        # then set JWT_SECRET to a long random string

# 3. start PostgreSQL and prepare + seed the database (idempotent)
npm run db:setup            # = docker compose up -d && prisma db push && prisma db seed

# 4. run the app
npm run dev                 # http://localhost:3000 — pick a role on /login
```

Local development defaults to demo mode (`DEMO_MODE` unset + `NODE_ENV=development`), so the role
picker works and the seeder runs. Add `OPENROUTER_API_KEY` to `.env` to switch the copilot from its
offline engine to live answers — free models only, no card required.

> A real environment variable always beats `.env`. If AI calls suddenly return 401, check for a
> stale exported `OPENROUTER_API_KEY` in your shell (`echo ${OPENROUTER_API_KEY:+set}`).

Or run individual steps: `npm run db:up`, `npm run db:push`, `npm run db:seed`, `npx prisma studio`.

### Antideploy deployment

`.antideploy.json` pins the Antideploy application id, and `.env` is **not** part of the pushed
archive — configuration reaches the container as Antideploy secrets. Set these before deploying:

| Secret                       | Value                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                 | A unique random value, at least 32 chars (`openssl rand -base64 48`). Sessions cannot be signed without it. |
| `DEMO_MODE`                  | `true` for this demo build — it enables the passwordless role picker. `false` once real accounts exist.     |
| `DEMO_SEED_ON_START`         | `true` to load the demo data into an empty database on first boot; `false` for real data.                   |
| `OPENROUTER_API_KEY`         | Optional. Free OpenRouter key for live AI answers; without it the copilot stays on its offline engine.      |
| `OPENROUTER_MODEL`           | Optional. A `:free` model id (defaults to a free one).                                                      |
| `OPENROUTER_FALLBACK_MODELS` | Optional. Comma-separated `:free` ids tried when the primary is busy.                                       |

Antideploy injects `DATABASE_URL` (and the `PG*` set) for the app's Postgres. `npm run build` runs
`prisma generate && next build`, and `npm start` (`scripts/start.mjs`) applies the Prisma schema on
boot, optionally seeds the demo data, then serves on the platform's `PORT`. The schema sync and the
seed are non-fatal by design: if the database is briefly unavailable the app still listens, so the
logs show the real error instead of a container that never came up.

The health check is `GET /api/health` — HTTP 200 only when Next.js **and** Postgres answer. Do not
add a client-side keepalive: it cannot stop a hosting plan from suspending an idle container. Select
Antideploy's always-on option if it is offered, or point an external uptime monitor at `/api/health`
according to their terms (`GET /api/v1/health` on the Antideploy API reports what they last saw).

#### Free AI models, and what that means in production

The copilot and the lab-report analyser are restricted to **free OpenRouter models**
(`src/lib/ai.ts` rejects any id not ending in `:free`). Free accounts are capped by OpenRouter
(currently 50 free requests/day) and shared models are often briefly rate limited, so:

- every request walks `OPENROUTER_MODEL` → `OPENROUTER_FALLBACK_MODELS` until a model answers, and
- when the whole chain is busy the copilot degrades to its offline rule-based engine over real
  database data, and lab analysis degrades to its offline analyser — a user never sees a 500.

For heavier traffic, put credits on the OpenRouter account and relax the `:free` rule deliberately
(it is enforced in one place, on purpose).

Private lab reports currently use the local `.uploads/` adapter. This directory is excluded from
git and is never publicly served, but files are lost when a container is replaced. Configure the
S3-compatible storage variables below and replace the adapter before relying on report persistence
in production.

> Re-running `npm run db:seed` resets all demo data to a clean state (used during the SIH demo).

### Choosing a role — no credentials anywhere

There is **no password login in this build**. Open `/` (or `/login`) and pick a profile; the server
attaches a normal httpOnly session for the seeded account behind that role:

| Role        | Persona                                             |
| ----------- | --------------------------------------------------- |
| Farmer      | **Ravi Kumar** — Farmer, Ramanagara (the demo hero) |
| FPO         | Ramanagara Fresh FPO (8.4 t onion bulk lot)         |
| Buyer       | **ABC Foods Pvt Ltd** — verified buyer              |
| Transporter | Veeresh Kumar — transporter                         |
| Admin       | Platform admin                                      |

The sidebar **Farmer/Buyer pill** switches persona instantly, and **Log out** returns to the picker.

Why it is built this way: this repository carries no credential at all. There is no shared password,
no demo password in the source, and the seeded accounts get unguessable random password hashes
(`DEMO_SEED_PASSWORD` can force one if you ever need it). Entry is decided server-side in
`/api/auth/enter`, gated by `DEMO_MODE`, so it cannot survive as a backdoor once real accounts exist —
set `DEMO_MODE=false` and this route answers 403.

> **Before real users:** role entry is passwordless by design, so anyone who reaches the URL can
> enter as Admin. Add a signup + password (or OTP) flow, then set `DEMO_MODE=false`.

### Suggested demo script (matches the SIH story)

1. Enter as **Farmer** → dashboard shows ₹28/kg avg, ▲ rising trend, **WAIT 2–3 DAYS** AI card, ABC Foods as best buyer, net ₹29.1/kg.
2. Open **AI Copilot** → _"What is today's tomato price near me?"_ → real APMC data. Then _"Should I sell today?"_ → forecast + buyers.
3. **My Lots → AG12452** → counter or **Accept** GreenMart's offer → an **order** is created automatically.
4. **Orders & Logistics** → **Arrange pickup** → a job appears for the transporter.
5. Switch to **Transporter** (the role pill, or the picker) → **Orders & Logistics → Job board** → Accept → Picked up → In transit → Delivered.
6. Buyer **GreenMart** pays → order becomes **PAID**; Ravi sees the payment in his **Payments** page + notification.
7. Raise a **grievance** → admin verifies & resolves in **Admin Panel**.

---

## 🔑 What you need for a fully functional production app — API keys & services

The app is **fully functional for demo/offline right now** (seeded data + offline copilot).
These are the keys/services to switch on for production-grade, live functionality. Everything is
configured through `.env` — **never commit keys**, and never put them in frontend code.

### 1. Required for live AI answers (chatbot / recommendations)

| Key                                       | Where                | Purpose                                                                                                                                                                                                    |
| ----------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`                      | OpenRouter           | Powers the AI Market & Transaction Copilot and lab analysis. Without it the bot runs in **offline mode** — still reads real DB data and can still execute confirmed actions, but responses are rule-based. |
| `OPENROUTER_MODEL`                        | OpenRouter model id  | **Free models only** — the id must end in `:free` or `src/lib/ai.ts` refuses it, so a priced model can never be billed. Defaults to `nvidia/nemotron-3-ultra-550b-a55b:free`.                              |
| _(optional)_ `OPENROUTER_FALLBACK_MODELS` | OpenRouter model ids | Comma-separated free models tried in order when the primary is rate limited or overloaded. No model in the chain ever costs money.                                                                         |

### 2. Required for live market data (replaces seeded mandi feeds)

| Service                                                                                      | Purpose                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| State **e-mandi / eNAM API** (e.g., eNAM API key, Karnataka APMC data partner, ONDC network) | Live market prices, arrivals and trends. Wire into a cron that writes to `market_prices` / `market_arrivals` with source + timestamp. |
| **Weather API** (OpenWeatherMap / IMD / IBM GRAF)                                            | Weather signals for the forecasting service (optional, improves the model).                                                           |

### 3. Required for real payments

| Key                                                               | Purpose                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (or Cashfree/Instamojo) | Replace the demo “Pay” button with real UPI/cards — creates orders, webhooks mark `payments.status = PAID`. |

### 4. Required for real logistics (optional but recommended)

| Service                                            | Purpose                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Map API** — `GOOGLE_MAPS_API_KEY` or Mapbox/OSRM | Real distance & ETA between farm and delivery location (currently a static demo distance table) + geocoding. |
| **Telematics / tracking provider** (optional)      | Live vehicle tracking on the Orders page.                                                                    |

### 5. SMS / WhatsApp notifications (optional — switch later via the abstraction)

The app writes in-app notifications and calls `notifyExternal()` in `src/lib/notifications.ts` —
add a provider there and set one of:

| Key                                                             | Provider                                |
| --------------------------------------------------------------- | --------------------------------------- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Twilio SMS / WhatsApp                   |
| `MSG91_AUTH_KEY`                                                | Msg91 SMS                               |
| `GUPSHUP_APP_NAME`, `GUPSHUP_APP_KEY`, `GUPSHUP_NUMBER`         | Gupshup WhatsApp                        |
| _FCM / OneSignal_                                               | Mobile push (when the PWA is published) |

### 6. Object storage for photos & documents (lot photos, quality, dispute evidence)

| Key                                                                       | Purpose                                                                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Any S3-compatible store (AWS S3, MinIO, Cloudflare R2). Upload endpoints should return signed URLs; currently lot photo URLs are optional text inputs for the demo. |

### 7. Email (optional)

Resend / SendGrid / Nodemailer key — for OTPs, verification emails and alerts. (OTP flow: add
`POST /api/auth/otp` + a `verification_codes` table when you go live.)

### Production hardening before launch

- Set a real `JWT_SECRET` (`openssl rand -base64 48`), HTTPS everywhere, rate-limit APIs
  (e.g., `rate-limiter-flexible` behind the route handlers), upload validation/scanning,
  DB backups, and move secrets to a secret manager.

---

## 📜 Available scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm start            # serve production build
npm run typecheck    # tsc --noEmit
npm run db:setup     # docker compose up + prisma db push + seed
npm run db:seed      # reset demo data (idempotent)
npm run db:push      # apply schema to Postgres
npx prisma studio    # browse the database
```

## 🧪 Verified end-to-end

The complete lifecycle was smoke-tested against the live app + PostgreSQL:
login → dashboard → market prices → AI copilot (read + confirm/cancel actions) →
offer accept (order auto-created) → pickup request → transporter accept →
PICKED_UP → IN_TRANSIT → DELIVERED (final payment auto-created) → buyer pays → order `PAID`.
