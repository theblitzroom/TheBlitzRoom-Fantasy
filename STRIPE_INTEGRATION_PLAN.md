# Stripe Integration Plan

Business: TwoBros Fantasy is an all-in-one fantasy football dashboard for league analysis, power rankings, roster strategy, trade value, and live draft support.

Stripe products:

- Billing for recurring subscription access.
- Payments through Stripe Checkout.
- Customer Portal for self-serve plan and payment management.

## Recommended Model

Use Stripe-hosted Checkout for subscription signup. It is the lowest-maintenance path and gives the app a secure payment surface without storing card details.

Create two recurring prices:

- Draft Pro: live Sleeper draft sync, full draft command center, saved league settings.
- TwoBros Fantasy Elite: Draft Pro plus redraft and dynasty modes, league hub, power rankings, rosters, and trade value.

Keep Preview as an app-side free tier, not a Stripe product.

## Access Control

Use Supabase as the app source of truth after Stripe webhooks land.

Store:

- Stripe customer ID.
- Stripe subscription ID.
- Active Stripe price ID.
- App plan: `preview`, `draft_pro`, or `dynasty_elite`.
- Subscription status.
- Current period end.

Gate feature access from Supabase subscription state, not from a client-side flag.

## Checkout Flow

1. User chooses Draft Pro or TwoBros Fantasy Elite on `/pricing`.
2. App calls `POST /api/stripe/create-checkout-session`.
3. Server maps plan to the correct Stripe price ID.
4. Server creates a subscription Checkout Session.
5. User completes checkout on Stripe.
6. Stripe redirects to `/account?checkout=success`.
7. Webhook updates Supabase subscription state.

## Billing Portal Flow

1. Signed-in user clicks Manage Billing on `/account`.
2. Server looks up the user's Stripe customer ID.
3. Server creates a Stripe billing portal session.
4. User manages cards, invoices, cancellations, upgrades, or downgrades in Stripe.
5. Webhooks update Supabase after changes.

## Webhooks

Register `/api/stripe/webhook` for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Treat webhooks as the authority for paid access. The redirect back from Checkout is only a UX event.

## Security Rules

- Never expose `STRIPE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Store keys in `.env.local` locally and hosting environment variables in production.
- Verify every webhook with `STRIPE_WEBHOOK_SECRET`.
- Derive billing portal customer IDs from the authenticated user before production launch.
- Do not trust client-sent plan or customer IDs without server-side validation.

## Current Implementation Status

Done:

- Plan-aware Checkout Session route.
- Stripe Customer Portal route.
- Stripe webhook route with subscription persistence helper.
- Checkout customer reuse when a Supabase profile has a Stripe customer ID.
- Checkout-to-profile linking through `client_reference_id`.
- Supabase schema starter.
- Client checkout buttons on pricing cards.
- Account billing button placeholder.

Still needed:

- Supabase auth UI.
- Profile creation on signup.
- Pass the signed-in Supabase user ID into Checkout and Billing Portal calls.
- Enforce server-side auth before accepting a user ID in billing routes.
- Hosted webhook endpoint configuration in the Stripe Dashboard.
