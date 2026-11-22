# InsurePress Studio

A full-stack workspace where insurance brokers, risk advisors and financial educators can research, write, design and publish insurance books and workbooks. The books are built to earn money twice: once from sales, and again from brokerage leads that come in through QR codes printed in the book.

It is set up for Nigeria out of the box: NAICOM and **Nigerian Insurance Industry Reform Act 2025 (NIIRA 2025)** compliance checks, **₦ NGN** pricing by default, and **Selar / Paystack / WhatsApp** offers. It also handles international publishing (Amazon KDP, Apple Books, Kobo, USD pricing).

> **Regulatory note.** The compliance rules, glossary, sample disclaimer and statutory references are educational starting points. Before you publish, have your compliance officer check the wording against current NAICOM circulars and the text of NIIRA 2025.

---

## What's inside

| Module | Where | Highlights |
|---|---|---|
| **A. AI Pain-Point Architect** | Library → *AI Blueprint Wizard*, or Studio navigator | 7 preset audiences plus your own. Generates 6–8 pain points (fear, trigger, myth, financial consequence), matches each to recommended policies and flags statutory covers. Offers 5 title/subtitle options and a front-matter → chapters → case study → workbook → back-matter outline. **Populate Manuscript** turns it into a full book in one click. |
| **B. Tri-pane Book Studio** | `/books/:id` | **Left:** collapsible manuscript sections, drag-to-reorder (`@dnd-kit`), status dots, word counts, book progress bar against the target, one-click front/back matter generators, move between sections. **Centre:** TipTap editor with a chapter goal header, formatting toolbar that appears on text selection, `/` command menu, autosave, and **7 insurance visual blocks**. **Right:** live typesetting preview (6×9 print spread, A5, e-reader, tablet × 5 themes, with page breaks, running heads and page numbers) and the AI Co-Pilot (6 one-click actions including the NAICOM & NIIRA 2025 compliance check). Version history drawer with named snapshots and safe restore. |
| **C. Cover Studio & 3D mockup** | `/books/:id/cover` | 5 cover templates. Edit title, subtitle, author, brokerage badge, icon, colours, back-cover blurb, author bio, ISBN, QR offer and price. Views: front, full wrap (back + spine sized to the page count + front), and a CSS 3D book with optional tablet. Download PNGs for Selar, WhatsApp and social posts. |
| **D. Income & lead engine** | `/books/:id/monetize`, Library | Manager for CTAs and QR codes (Selar, Paystack, WhatsApp pre-filled quote, policy audit, calculator, lead magnet), with UTM-tracked links and promo codes. Lead-magnet extractor. AI Selar sales page and 5-slide LinkedIn/Instagram carousel. **Revenue & brokerage commission planner** (₦/USD toggle with an exchange-rate field; digital, print and corporate bulk sales; commission by class of business). |
| **E. Publishing pipeline** | Studio → *Publish & Export* | Print-ready **PDF** (Puppeteer + pdf-lib: exact trim, mirrored margins, chapters start on right-hand pages, contents page with real page numbers, running heads, page numbers, cover and back cover). Reflowable **EPUB 3.0** (cover image, NAV/NCX contents, styled callouts, embedded QR images). Editable **DOCX**. **Lead-magnet mini-PDF**. |

### The 7 visual blocks
Pain-Point Spotlight · Real-World Claim Case Study (Incident | Uninsured vs Insured with ₦ amounts | Broker's Lesson) · Jargon → Plain English · Policy Comparison Matrix (editable rows and columns) · Myth vs Fact · Risk Audit Checklist (printable tick boxes) · Monetization & QR Action Card (linked to a saved offer, with a live QR code).

Every block is drawn by **one shared renderer** (`shared/render.js`). The editor, live preview, PDF, EPUB and lead magnet all use it, so a block looks the same everywhere. DOCX has its own converter that maps each block to styled Word tables.

---

## Tech stack

- **Client:** React 18 + Vite 5, Tailwind CSS 3, Lucide icons, TipTap 2 (custom React node views + `@tiptap/suggestion` slash menu), `@dnd-kit`, `html-to-image`.
- **Server:** Node 20+ / Express 4 (ES modules), `mysql2/promise`, `@anthropic-ai/sdk`, `puppeteer`, `pdf-lib`, `epub-gen-memory`, `docx`, `qrcode`.
- **Database:** MySQL 8.0 (`database/schema.sql`; also runs on MariaDB 10.6+).

```
insurepress-studio/
├─ package.json            # npm run dev → API + Vite together (concurrently)
├─ .env.example
├─ database/schema.sql     # 8 tables: users, brand_kits, books, chapters, chapter_versions,
│                          #   pain_point_blueprints, monetization_ctas, export_jobs
├─ shared/                 # used by BOTH client and server
│  ├─ constants.js         # NGN/USD, trim sizes, audiences, CTA types, NAICOM disclaimer
│  ├─ render.js            # TipTap JSON + 7 blocks → HTML, word counts, AI-block → doc builder
│  ├─ themes.js            # 5 publishing themes, print/ebook CSS, chapter/TOC assembly
│  └─ cover.js             # cover templates (front, back, spine)
├─ server/
│  ├─ index.js             # Express app (auto-migrates on start, serves client/dist in prod)
│  ├─ db/                  # pool, migrate.js, seed.js, seedContent.js
│  ├─ lib/                 # repo helpers, front/back-matter generators, audience library
│  ├─ routes/              # books+chapters+versions, brand, ctas, ai+blueprints, exports
│  └─ services/            # aiService, compliance (rule engine), pdf/epub/docx, qr, browser
├─ client/src/
│  ├─ pages/               # Dashboard, Studio, CoverStudio, Monetize, BrandKit
│  └─ components/          # BlueprintWizard, RevenuePlanner, studio/*, blocks/*
└─ exports/                # generated files (served at /exports/…)
```

---

## Setup

**Prerequisites:** Node.js 20+, MySQL 8.0 (or MariaDB 10.6+), and a Chrome/Chromium for Puppeteer. Puppeteer downloads one on `npm install` unless you set `PUPPETEER_SKIP_DOWNLOAD=true` and point `PUPPETEER_EXECUTABLE_PATH` at an existing browser.

```bash
cd insurepress-studio
cp .env.example .env          # set DB_* (and optionally ANTHROPIC_API_KEY)
npm run install:all           # root + server + client dependencies

# create a MySQL user that can create the database, e.g.
#   CREATE USER 'insurepress'@'localhost' IDENTIFIED BY 'insurepress';
#   GRANT ALL ON insurepress_studio.* TO 'insurepress'@'localhost';

npm run migrate               # applies database/schema.sql (also runs on every server start)
npm run seed                  # Sparklight brand kit, 3 CTAs and the "Sleep Soundly" starter book
npm run dev                   # API on :5050, app on http://localhost:5173
```

Production: `npm run build && npm start`. Express serves the built client and the API from one port (`PORT`, default 5050).

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5050` | API port (Vite proxies `/api` and `/exports` here in dev) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `127.0.0.1` / `3306` / `insurepress` / `insurepress` / `insurepress_studio` | MySQL connection |
| `ANTHROPIC_API_KEY` | *(empty)* | Turns on live Claude output. **Empty = mock mode:** realistic sample output so every feature can be tested offline |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Any Claude model ID |
| `ANTHROPIC_EFFORT` | `medium` | `low`–`max`: trades depth for speed and cost |
| `PUPPETEER_EXECUTABLE_PATH` | *(bundled)* | Use a system Chrome/Chromium |
| `EXPORT_DIR` | `../exports` | Where generated files are written |

### AI behaviour
- Calls use `@anthropic-ai/sdk` with streaming and server-side refusal fallback. Answers come back as structured JSON blocks that `shared/render.js` turns into editor content, so the AI can write the visual blocks too.
- The **compliance check always runs a rule-based guardrail**: guaranteed payouts, "always pays", "risk-free", "best/cheapest insurer", "cover now, pay later", missing "No Premium, No Cover", missing prompt-notification guidance, ₦ case studies not marked illustrative. When an API key is set, Claude's review is added on top. The result is a 0–100 score, flagged excerpts with suggested fixes, and a recommended disclaimer you can insert with one click.

---

## First run: what to try
1. **Library:** open *Sleep Soundly* (₦7,500 digital / ₦15,000 print) and scroll down to the revenue & commission planner.
2. **Studio:** type `/` in a chapter to insert a block. Double-click a block to edit it. Open **AI Co-Pilot → NAICOM & NIIRA 2025 Compliance Check**. Switch the preview between *6×9 Print Spread*, *E-Reader* and the five themes.
3. **Versions:** save a snapshot, edit, then restore. The current text is backed up automatically before a restore.
4. **Cover Studio:** switch templates, pick the Selar offer for the back-cover QR, open *3D Mockup* and download the PNG.
5. **Publish & Export:** PDF (about 30–40 s for the sample: 45 pages at 6×9), EPUB, DOCX, Lead-magnet PDF.
6. **AI Blueprint Wizard:** choose *Commercial Fleet & Logistics Operators* → Discover → Generate → **Populate manuscript**.

## API (summary)
`GET /api/health` · `GET|POST /api/books` · `GET /api/books/:id/full` · `PUT|DELETE /api/books/:id` · `POST /api/books/:id/chapters` · `POST /api/books/:id/chapters/reorder` · `POST /api/books/:id/matter {subtype}` · `GET|PUT|DELETE /api/chapters/:id` · `GET|POST /api/chapters/:id/versions` · `GET /api/versions/:id` · `POST /api/versions/:id/restore` · `GET|POST /api/brand-kits` · `PUT|DELETE /api/brand-kits/:id` · `GET|PUT /api/me` · `GET|POST /api/books/:id/ctas` · `PUT|DELETE /api/ctas/:id` · `POST /api/qr` · `GET /api/ai/status` · `POST /api/ai/pain-points` · `POST /api/ai/outline` · `POST /api/ai/copilot` · `POST /api/ai/sales-copy` · `POST /api/blueprints/populate` · `POST /api/books/:id/exports {format: pdf|epub|docx|lead_magnet_pdf, theme?, trim?, chapterIds?, ctaId?}` · `GET /api/books/:id/exports` · `GET /api/books/:id/cover.png?part=front|back`

## Known limitations
- **Single-workspace mode:** every request acts as the first user in `users`. Add authentication (JWT or sessions) before a multi-user deployment. Ownership checks are already scoped by `user_id`.
- Export runs synchronously within the request. For heavy use, move `export_jobs` onto a queue.
- Web fonts load from Google Fonts. Offline, PDFs fall back to system serif and sans fonts.
- The live print preview paginates in the browser to approximate the final layout. The exported PDF is authoritative.
