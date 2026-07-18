import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getStripePlanConfig, getStripeTestPriceId, type CheckoutPlan } from "@/lib/stripePlans";

type CheckoutBody = {
  plan?: CheckoutPlan;
  email?: string;
};

export const runtime = "nodejs";

const checkoutPlans: CheckoutPlan[] = [
  "draft_pro_season",
  "dynasty_elite_season",
  "draft_pro_monthly",
  "dynasty_elite_monthly"
];

function isTestCheckoutEnabled() {
  return process.env.STRIPE_TEST_MODE_ENABLED === "true";
}

export async function POST(request: Request) {
  try {
    if (!isTestCheckoutEnabled()) {
      return NextResponse.json({ error: "Stripe test checkout is disabled." }, { status: 404 });
    }

    const testSecretKey = process.env.STRIPE_TEST_SECRET_KEY;
    if (!testSecretKey || !testSecretKey.startsWith("sk_test_")) {
      return NextResponse.json({ error: "Stripe test checkout requires STRIPE_TEST_SECRET_KEY with an sk_test_ key." }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const body = await request.json().catch(() => ({})) as CheckoutBody;
    const plan = body.plan;

    if (!plan || !checkoutPlans.includes(plan)) {
      return NextResponse.json({ error: "A valid checkout plan is required." }, { status: 400 });
    }

    const stripe = getStripe(testSecretKey);
    const planConfig = getStripePlanConfig(plan);
    const price = getStripeTestPriceId(plan);
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: planConfig.checkoutMode,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        plan,
        access_plan: planConfig.accessPlan,
        access_ends_at: planConfig.accessEndsAt ?? "",
        source: "theblitzroom_fantasy_test_checkout",
        test_mode: "true"
      },
      success_url: `${appUrl}/account?checkout=test-success`,
      cancel_url: `${appUrl}/test-checkout?checkout=cancelled`
    };

    if (body.email) {
      sessionConfig.customer_email = body.email;
    }

    if (planConfig.checkoutMode === "subscription") {
      sessionConfig.subscription_data = {
        metadata: {
          plan,
          access_plan: planConfig.accessPlan,
          source: "theblitzroom_fantasy_test_checkout",
          test_mode: "true"
        }
      };
    } else {
      sessionConfig.customer_creation = "always";
      sessionConfig.payment_intent_data = {
        metadata: {
          plan,
          access_plan: planConfig.accessPlan,
          access_ends_at: planConfig.accessEndsAt ?? "",
          source: "theblitzroom_fantasy_test_checkout",
          test_mode: "true"
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url, mode: "test" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Test checkout failed" }, { status: 500 });
  }
}
