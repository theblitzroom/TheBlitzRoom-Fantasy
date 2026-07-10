# Vercel Deployment Checklist

## Upload Shape

The easiest deployment path is to make this folder the GitHub repository root:

```text
dynasty-command-center-app/
```

If you upload the larger parent folder instead, set the Vercel root directory to:

```text
outputs/dynasty-command-center-app
```

## Required Vercel Settings

- Framework preset: Next.js
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave blank

## Environment Variables

Set these in Vercel under Project Settings -> Environment Variables.

```bash
NEXT_PUBLIC_APP_URL=https://twobrosfantasy.com

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_DRAFT_PRO_SEASON_PRICE_ID=
STRIPE_DYNASTY_ELITE_SEASON_PRICE_ID=
STRIPE_DRAFT_PRO_PRICE_ID=
STRIPE_DYNASTY_ELITE_PRICE_ID=
```

For a temporary Vercel URL before the custom domain is ready:

```bash
NEXT_PUBLIC_APP_URL=https://your-vercel-project.vercel.app
```

## Stripe Review Pages

These public pages are included for business review:

- `/pricing`
- `/contact`
- `/privacy`
- `/terms`
- `/refund-policy`
- `/faq`

## Stripe Webhook

After deployment, set the Stripe webhook endpoint to:

```text
https://your-domain.com/api/stripe/webhook
```

Listen for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Pre-Deploy Check

Run:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```
