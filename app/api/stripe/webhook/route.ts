import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { attachStripeCustomerToProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";
import { updateAccessGrantStatusFromPaymentIntent, upsertAccessGrantFromStripe } from "@/lib/stripeAccessGrants";
import { getPlanFromPriceId, getSeasonAccessEndFromPriceId } from "@/lib/stripePlans";
import { getPrimaryPriceId, upsertSubscriptionFromStripe } from "@/lib/stripeSubscriptionSync";

export const runtime = "nodejs";

function constructStripeEvent(payload: string, signature: string) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const testWebhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return { event, stripe };
  } catch (liveError) {
    if (!testWebhookSecret) {
      throw liveError;
    }

    const event = stripe.webhooks.constructEvent(payload, signature, testWebhookSecret);
    const testSecretKey = process.env.STRIPE_TEST_SECRET_KEY;
    const eventStripe = !event.livemode && testSecretKey?.startsWith("sk_test_") ? getStripe(testSecretKey) : stripe;

    return { event, stripe: eventStripe };
  }
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  try {
    const { event, stripe } = constructStripeEvent(payload, signature);

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

      if (session.mode === "payment" && session.payment_status === "paid") {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data[0]?.price?.id ?? null;
        const plan = getPlanFromPriceId(priceId);
        const accessEndsAt = getSeasonAccessEndFromPriceId(priceId) ?? session.metadata?.access_ends_at ?? null;
        const profileId = session.client_reference_id ?? null;
        const stripeCustomerId = String(session.customer);

        if (profileId && stripeCustomerId) {
          await attachStripeCustomerToProfile(profileId, stripeCustomerId);
        }

        if (plan !== "preview" && accessEndsAt && stripeCustomerId) {
          await upsertAccessGrantFromStripe({
            stripeCustomerId,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
            stripePriceId: priceId,
            profileId,
            plan,
            accessEndsAt
          });
        }
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      await updateAccessGrantStatusFromPaymentIntent(
        typeof charge.payment_intent === "string" ? charge.payment_intent : null,
        "refunded"
      );
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      await updateAccessGrantStatusFromPaymentIntent(
        typeof dispute.payment_intent === "string" ? dispute.payment_intent : null,
        "disputed"
      );
    }

    return NextResponse.json({ received: true, type: event.type });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Stripe webhook" }, { status: 400 });
  }
}
