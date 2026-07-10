import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getBillingProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";
import { getStripePlanConfig, getStripePriceId, type CheckoutPlan } from "@/lib/stripePlans";

type CheckoutBody = {
  plan?: CheckoutPlan;
  email?: string;
  userId?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const body = await request.json().catch(() => ({})) as CheckoutBody;
    const plan = body.plan === "dynasty_elite_season" ||
      body.plan === "draft_pro_monthly" ||
      body.plan === "dynasty_elite_monthly"
      ? body.plan
      : "draft_pro_season";
    const planConfig = getStripePlanConfig(plan);
    const price = getStripePriceId(plan);
    const profile = body.userId ? await getBillingProfile(body.userId) : null;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: planConfig.checkoutMode,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        plan,
        access_plan: planConfig.accessPlan,
        access_ends_at: planConfig.accessEndsAt ?? "",
        source: "twobros_fantasy"
      },
      success_url: `${appUrl}/account?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`
    };

    if (planConfig.checkoutMode === "subscription") {
      sessionConfig.subscription_data = {
        metadata: {
          plan,
          access_plan: planConfig.accessPlan,
          source: "twobros_fantasy"
        }
      };
    } else {
      sessionConfig.payment_intent_data = {
        metadata: {
          plan,
          access_plan: planConfig.accessPlan,
          access_ends_at: planConfig.accessEndsAt ?? "",
          source: "twobros_fantasy"
        }
      };

      if (!profile?.stripe_customer_id) {
        sessionConfig.customer_creation = "always";
      }
    }

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
