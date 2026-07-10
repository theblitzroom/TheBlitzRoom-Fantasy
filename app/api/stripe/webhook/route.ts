import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { attachStripeCustomerToProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";
import { getPrimaryPriceId, upsertSubscriptionFromStripe } from "@/lib/stripeSubscriptionSync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;

      await upsertSubscriptionFromStripe({
        stripeCustomerId: String(subscription.customer),
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        priceId: getPrimaryPriceId(subscription),
        currentPeriodEnd: subscription.current_period_end ?? null
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        const profileId = session.client_reference_id ?? null;
        const stripeCustomerId = String(subscription.customer);

        if (profileId) {
          await attachStripeCustomerToProfile(profileId, stripeCustomerId);
        }

        await upsertSubscriptionFromStripe({
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          priceId: getPrimaryPriceId(subscription),
          currentPeriodEnd: subscription.current_period_end ?? null,
          profileId
        });
      }
    }

    return NextResponse.json({ received: true, type: event.type });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Stripe webhook" }, { status: 400 });
  }
}
