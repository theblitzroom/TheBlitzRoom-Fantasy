# TheBlitzRoom Fantasy App

A dynamic Next.js foundation for the premium fantasy football draft tool. The static demo remains in `../fantasy-draft-tool`; this app is the path toward real accounts, paid subscriptions, saved leagues, and read-only Sleeper live sync.

## What Is Included

- Multi-page Next.js App Router structure.
- Premium purple/gold design system in `app/globals.css`.
- Route-based product areas for command center, league hub, power rankings, rosters, trade value, draft room, pricing, FAQ, and account.
- Subscription gate components ready to connect to Supabase membership state.
- Read-only Sleeper API proxy routes using official public endpoints.
- Stripe checkout, customer portal, and webhook routes.
- Supabase browser/server client helpers.
- Login, account creation, auth callback, and signed-in account hub pages.
- Account-level Yahoo and ESPN league connection foundation.
- Shared format-aware fantasy model for redraft, dynasty, superflex dynasty, Half PPR, Full PPR, and TE premium logic. See `RANKING_METHODOLOGY.md`.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploy On Vercel

This app is ready for Vercel. See `VERCEL_DEPLOYMENT.md` for the full checklist.

For the simplest setup, publish this folder as its own GitHub repository, then import that repo into Vercel as a Next.js project.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in your Supabase, Stripe, and platform OAuth keys.

## Account Setup

Accounts use Supabase Auth plus the tables in `supabase-schema.sql`.

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Add these variables locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=owner@example.com
```

4. In Supabase Auth settings, add your site URL and redirect URL:

```text
https://theblitzroom.com
https://theblitzroom.com/auth/callback
```

The live account routes are:

- `/login` for sign in and account creation.
- `/account` for signed-in subscription status, billing, and saved league foundations.
- `/admin` for approved admin emails to preview paid tools without Stripe checkout.
- `/reset-password` for Supabase password recovery links.
- `/auth/callback` for Supabase email confirmation links.

## Stripe Setup

Create two one-time season pass prices in Stripe:

- TheBlitzRoom Draft Pro 2026 Season Pass: live draft support, Sleeper sync, rankings, and draft recommendations.
- TheBlitzRoom Fantasy Elite 2026 Season Pass: Draft Pro plus redraft and dynasty modes, league hub, power rankings, rosters, and trade value.

Create two monthly subscription prices in Stripe:

- TheBlitzRoom Draft Pro Monthly: $7.99 per month.
- TheBlitzRoom Fantasy Elite Monthly: $14.99 per month.

Paste the price IDs into `.env.local`:

```bash
STRIPE_DRAFT_PRO_SEASON_PRICE_ID=price_...
STRIPE_DYNASTY_ELITE_SEASON_PRICE_ID=price_...
STRIPE_DRAFT_PRO_PRICE_ID=price_...
STRIPE_DYNASTY_ELITE_PRICE_ID=price_...
```

The app creates Stripe Checkout Sessions from `/api/stripe/create-checkout-session`. Season passes use one-time payment Checkout Sessions and grant access through February 15, 2027. Monthly plans use subscription Checkout Sessions and renew through Stripe Billing.

Stripe webhooks should point to `/api/stripe/webhook` and listen for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`

Run the schema in `supabase-schema.sql` before relying on paid access in production. One-time season pass purchases are stored in `access_grants`; recurring plans are stored in `subscriptions`.

Billing routes now derive the user from the Supabase server session. When a signed-in user checks out, Stripe is tied back to that account through the profile row and webhook sync.

### Stripe Test Mode Checkout

Use `/test-checkout` for no-money payment QA. This hidden route is disabled unless all test-mode environment variables are present.

Required test env vars:

- `STRIPE_TEST_MODE_ENABLED=true`
- `STRIPE_TEST_SECRET_KEY=sk_test_...`
- `STRIPE_TEST_WEBHOOK_SECRET=whsec_...`
- `STRIPE_TEST_DRAFT_PRO_SEASON_PRICE_ID=price_...`
- `STRIPE_TEST_DYNASTY_ELITE_SEASON_PRICE_ID=price_...`
- `STRIPE_TEST_DRAFT_PRO_PRICE_ID=price_...`
- `STRIPE_TEST_DYNASTY_ELITE_PRICE_ID=price_...`

Create matching products/prices in Stripe test mode:

- TheBlitzRoom Draft Pro Season: one-time `$39.99`
- TheBlitzRoom Fantasy Elite Season: one-time `$59.99`
- Draft Pro Monthly: recurring monthly `$7.99`
- Fantasy Elite Monthly: recurring monthly `$14.99`

Use Stripe's successful test card:

```text
4242 4242 4242 4242
Any future expiration date
Any 3-digit CVC
Any ZIP code
```

For a full entitlement test, point a Stripe test-mode webhook at `/api/stripe/webhook` and add its signing secret as `STRIPE_TEST_WEBHOOK_SECRET`. Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on live values in production.

### Vercel Preview Billing QA

Vercel Preview is configured as the safe Stripe sandbox lane. In Preview, the normal `/pricing` checkout route uses Stripe test-mode keys and test prices, so you can exercise the same customer flow without charging real cards.

- Production `/pricing`: live Stripe keys and live prices
- Preview `/pricing`: test Stripe keys and test prices
- Preview `/test-checkout`: hidden test route, also test mode
- Stripe test webhooks: delivered to `/api/stripe/webhook`
- Preview deployments may be protected by Vercel Authentication; use `vercel curl` for API checks or open the deployment while signed into Vercel.

Use `4242 4242 4242 4242` with any future date, any 3-digit CVC, and any ZIP code for no-money Stripe tests.

## Yahoo Fantasy OAuth Setup

Yahoo league access uses official read-only Yahoo OAuth. The app stores Yahoo tokens encrypted server-side and never stores Yahoo client secrets in the browser or Chrome extension.

1. Create a Yahoo Developer app with Fantasy Sports read access.
2. Add this redirect URL to the Yahoo app:

```text
https://theblitzroom.com/api/platforms/yahoo/callback
```

3. Add these variables locally and in Vercel:

```bash
YAHOO_CLIENT_ID=
YAHOO_CLIENT_SECRET=
YAHOO_REDIRECT_URI=https://theblitzroom.com/api/platforms/yahoo/callback
YAHOO_OAUTH_STATE_SECRET=
PLATFORM_TOKEN_ENCRYPTION_KEY=
```

`YAHOO_OAUTH_STATE_SECRET` and `PLATFORM_TOKEN_ENCRYPTION_KEY` should each be long random values. `PLATFORM_TOKEN_ENCRYPTION_KEY` must be at least 32 bytes.

Sleeper sync uses only official read-only endpoints:

- `GET https://api.sleeper.app/v1/user/<username>`
- `GET https://api.sleeper.app/v1/draft/<draft_id>`
- `GET https://api.sleeper.app/v1/draft/<draft_id>/picks`
- `GET https://api.sleeper.app/v1/league/<league_id>`
- `GET https://api.sleeper.app/v1/league/<league_id>/rosters`
- `GET https://api.sleeper.app/v1/league/<league_id>/users`
- `GET https://api.sleeper.app/v1/league/<league_id>/matchups/<week>`

Yahoo sync uses official OAuth. ESPN remains manual/visible league context only because ESPN does not provide a documented public third-party fantasy account API.

## ESPN Public League Access

ESPN access supports public leagues by league ID and season from the signed-in account page. The app validates the league with ESPN's fantasy endpoint and stores the league metadata in `platform_connections`.

Private ESPN leagues can be connected by manually entering the user's own `SWID` and `espn_s2` values from an active ESPN browser session. Those values are encrypted server-side in `platform_connections`. The app never asks for an ESPN password and does not auto-extract cookies.

The app does not auto-draft, does not collect ESPN passwords, and does not auto-extract or scrape private cookies.

## Next Build Steps

1. Create Supabase tables for leagues, drafts, picks, platform connections, and saved rankings.
2. Wire signed-in account plan state into `lib/subscription.ts` gates.
3. Replace demo data with database-backed league and draft records.
4. Add saved Sleeper and Yahoo league connections per user.
5. Add a client-side Sleeper sync controller that polls every second while a draft room is open.
