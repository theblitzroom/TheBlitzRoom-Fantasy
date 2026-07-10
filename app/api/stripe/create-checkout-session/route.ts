import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getBillingProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";
import { getStripePriceId, type PaidPlan } from "@/lib/stripePlans";

type CheckoutBody = {
  plan?: PaidPlan;
  email?: string;
  userId?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const body = await request.json().catch(() => ({})) as CheckoutBody;
    const plan = body.plan === "dynasty_elite" ? "dynasty_elite" : "draft_pro";
    const price = getStripePriceId(plan);
    const profile = body.userId ? await getBillingProfile(body.userId) : null;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        plan,
        source: "twobros_fantasy"
      },
      subscription_data: {
        metadata: {
          plan,
          source: "twobros_fantasy"
        }
      },
      success_url: `${appUrl}/account?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`
    };

    if (profile?.stripe_customer_id) {
      sessionConfig.customer = profile.stripe_customer_id;
    } else if (profile?.email || body.email) {
      sessionConfig.customer_email = profile?.email ?? body.email;
    }

    if (profile?.id ?? body.userId) {
      sessionConfig.client_reference_id = profile?.id ?? body.userId;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 500 });
  }
}
