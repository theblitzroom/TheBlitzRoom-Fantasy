# TwoBros Fantasy App

A dynamic Next.js foundation for the premium fantasy football draft tool. The static demo remains in `../fantasy-draft-tool`; this app is the path toward real accounts, paid subscriptions, saved leagues, and read-only Sleeper live sync.

## What Is Included

- Multi-page Next.js App Router structure.
- Premium purple/gold design system in `app/globals.css`.
- Route-based product areas for command center, league hub, power rankings, rosters, trade value, draft room, pricing, FAQ, and account.
- Subscription gate components ready to connect to Supabase membership state.
- Read-only Sleeper API proxy routes using official public endpoints.
- Stripe checkout, customer portal, and webhook routes.
- Supabase browser/server client helpers.

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

Copy `.env.example` to `.env.local` and fill in your Supabase and Stripe keys.

## Stripe Setup

Create two recurring subscription prices in Stripe:

- Draft Pro: live draft support and saved league settings.
- TwoBros Fantasy Elite: Draft Pro plus redraft and dynasty modes, league hub, power rankings, rosters, and trade value.

Paste the price IDs into `.env.local`:

```bash
STRIPE_DRAFT_PRO_PRICE_ID=price_...
STRIPE_DYNASTY_ELITE_PRICE_ID=price_...
```

The app creates Stripe Checkout Sessions from `/api/stripe/create-checkout-session`.
Stripe webhooks should point to `/api/stripe/webhook` and listen for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Run the schema in `supabase-schema.sql` before relying on paid access in production.

For production, make the billing routes derive the user ID from Supabase auth on the server.
The current scaffold accepts a `userId` body field so the billing flow can be wired before auth UI exists.

Sleeper sync uses only official read-only endpoints:

- `GET https://api.sleeper.app/v1/user/<username>`
- `GET https://api.sleeper.app/v1/draft/<draft_id>`
- `GET https://api.sleeper.app/v1/draft/<draft_id>/picks`

The app does not auto-draft and does not use private APIs.

## Next Build Steps

1. Create Supabase tables for profiles, leagues, subscriptions, drafts, picks, and saved rankings.
2. Wire account state into `lib/subscription.ts`.
3. Create Stripe products and paste price IDs into `.env.local`.
4. Replace demo data with database-backed league and draft records.
5. Add a client-side Sleeper sync controller that polls every second while a draft room is open.
