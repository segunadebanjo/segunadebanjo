# Insurance Ad Manager

Multi-platform ad management and campaign automation for an insurance brokerage. You create, compliance-check, publish and optimize ads for six insurance classes on **Facebook, Instagram, Google Ads (Search + Display) and LinkedIn**. The goal is qualified traffic and completed policy purchases.

- **Stack:** React (Vite + TypeScript, Tailwind, lucide-react, Recharts) · Express + TypeScript · MySQL 8.0 via Prisma (`provider = "mysql"`) · node-cron · `@anthropic-ai/sdk`
- **Architecture, schema, compliance rules and API reference:** see [`CLAUDE.md`](./CLAUDE.md)

## Quick start

Prerequisites: Node 20+ and Docker (or any MySQL 8.0 server).

```bash
# 1. Database: MySQL 8.0 on localhost:3307
docker compose up -d
cp server/.env.example server/.env        # SANDBOX_MODE=true by default
cp client/.env.example client/.env
npm run install:all
npm --prefix server run db:wait

# 2. Schema + seed data (8 products across all 6 classes, rules, 5 demo campaigns, 30 days of metrics)
npm run setup        # prisma migrate deploy → prisma generate → prisma db seed

# 3a. Development (two terminals): open the UI at http://localhost:5173
npm run dev:server   # API  → http://localhost:4100/api
npm run dev:client   # UI   → http://localhost:5173  (proxies /api to :4100)

# 3b. Or one server for everything: open http://localhost:4100
npm run build && npm start
```

Which address to open:
- **Development** (`dev:server` + `dev:client`): use `http://localhost:5173`. Port 4100 is the API only; its root page just says where the UI is.
- **After `npm run build`**: the API server also serves the UI, so `http://localhost:4100` opens the app and every page link works.

### Logging in

There is no login. The app opens straight to the dashboard, and anyone who can reach the server can use it. Only the conversion webhook is protected, by the `x-api-key` header set from `WEBHOOK_SECRET_KEY`. Run it on your own machine or behind your company VPN/SSO until user accounts are added.

During development, run `npm --prefix server run db:migrate` (`prisma migrate dev`) after you edit `prisma/schema.prisma`. To rebuild the demo data, run `npm --prefix server run db:reset`.

If you don't use Docker, point `DATABASE_URL` in `server/.env` at your own MySQL 8 server. As an alternative to Prisma migrations, you can load the raw DDL with `npm --prefix server run db:apply-sql`, or with `mysql -u root -p < database/schema.sql`. Use one method or the other on a given database, not both.

## Build, typecheck and test

```bash
npm run typecheck                  # server (src + tests + seed) and client, tsc --noEmit
npm run build                      # server → server/dist, client → client/dist
npm test                           # vitest unit tests (no DB needed)
npm --prefix server run test:db    # + MySQL-backed webhook integration tests (uses DATABASE_URL)
npm --prefix server start          # run the compiled API (node dist/index.js)
```

The tests cover:
- the compliance guardrail validator (personal attributes, guaranteed returns, license disclosure, Special Ad Category targeting, and a check that the built-in templates are compliant for every class and platform)
- Google's 30/90-character RSA limits, plus trimming and auto-fix
- conversion attribution: click-id detection, utm parsing, funnel stitching and the platform/deployment match
- webhook auth, idempotency and exact DECIMAL revenue roll-up against real MySQL
- the optimization rules and budget splitting

## Workflow

1. **Products** (`/products`). Manage the catalog: selling points, starting premium, quote URL and regulatory license number.
2. **New campaign** (`/campaigns/new`):
   1. Choose the product, objective, locations and daily budget, and split the budget across platforms.
   2. Generate creatives with Claude, or with built-in templates when there's no API key:
      - Facebook/Instagram: 3 hook angles, each with a Reels or carousel brief
      - Google: a Responsive Search Ad pack of 10 headlines (≤30 chars) and 4 descriptions (≤90 chars), plus keywords
      - LinkedIn: B2B posts with job-title and industry targeting
   3. Run compliance. Meta placements are tagged with a Special Ad Category: `FINANCIAL_PRODUCTS_SERVICES`, or `HOUSING` for property. ZIP, small-radius and age/gender targeting is blocked, along with personal-attribute and guaranteed-return copy. The license disclosure is enforced. Auto-fix handles the mechanical issues, and you can turn on an optional AI pre-flight review.
   4. Publish. Every platform object is created **PAUSED**.
3. **Campaign page.** Activate or pause all platforms, see per-platform performance, and find the `utm_campaign` value to send back from the ERP.
4. **Dashboard** (`/`). Shows Spend, Clicks, CTR, Quotes, Cost/Quote, Policies, Cost/Policy and Policy ROAS, filterable by insurance class, platform and date range. It also has the automated optimization rules panel.
5. **Optimization** (`/optimization`). Review recommendations, then apply or dismiss them: pause zero-quote spenders, raise budgets 15% on ROAS winners, flag high cost per policy. Rules also run on a schedule via node-cron, either as recommendations or in auto-apply mode.
6. **Conversions** (`/conversions`). An event log with the CAPI dispatch status of each event. In sandbox mode you can also send test events from this page.

## ERP / quote portal webhook

```bash
curl -X POST http://localhost:4100/api/webhooks/conversions \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WEBHOOK_SECRET_KEY" \
  -d '{"eventId":"erp-000123","gclid":"Cj0KCQ...","utm_campaign":"ins-1-motor-q4-lagos-abuja",
       "eventType":"POLICY_PURCHASED","policyPremiumValue":87500.00,"currency":"NGN","email":"customer@example.com"}'
```

Each event goes through these steps:
1. **Persist:** the event is saved to `conversion_events`.
2. **Attribute:** the event is matched to a campaign and deployment using the click id and `utm_campaign`. When a later event has no utm data, it is matched to the campaign of an earlier event with the same click id.
3. **Roll up:** the event is added to the attributed deployment's daily `performance_metrics`.
4. **Dispatch:** a server-side conversion is sent to Meta CAPI, Google Enhanced Conversions and LinkedIn CAPI. Email and phone are SHA-256 hashed first.

`eventId` makes the call idempotent.

## Going live

Set `SANDBOX_MODE=false` and fill in the platform credentials in `server/.env`. Each platform switches to its live adapter only when its own credentials are present; otherwise it stays in sandbox. `GET /api/platforms/status` and the sidebar show which mode each platform is in. Even in live mode, publishing creates **PAUSED** campaigns.

The live adapters (Meta Graph API v21, Google Ads REST v18, LinkedIn versioned REST 202410) follow the public API shapes, but they have only run against the sandbox in this repository. Test them against a real ad account before you rely on them. In particular, check API version drift and Google Display image assets, which need uploading before a responsive display ad can be attached.

> The admin API (everything under `/api` except the webhook) has no user authentication. Deploy it behind your SSO/VPN, or add an auth layer, before you expose it.
