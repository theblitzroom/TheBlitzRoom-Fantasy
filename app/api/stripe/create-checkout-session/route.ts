import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAppUrl } from "@/lib/appUrl";
import { ensureBillingProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";
import { getStripePlanConfig, getStripePriceId, type CheckoutPlan } from "@/lib/stripePlans";
import { hasSupabaseAdminConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  try {
    const appUrl = getAppUrl(request);
    const body = await request.json().catch(() => ({})) as CheckoutBody;
    const plan = body.plan;

    if (!plan || !checkoutPlans.includes(plan)) {
      return NextResponse.json({ error: "A valid checkout plan is required." }, { status: 400 });
    }

    const supabase = hasSupabaseBrowserConfig() ? await createSupabaseServerClient() : null;
    const { data: userResult } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    const user = userResult.user;

    if (!user) {
      const pricingReturnPath = `/pricing?checkoutPlan=${encodeURIComponent(plan)}`;
      return NextResponse.json(
        {
          error: "Sign in or create an account before checkout so paid access can unlock on your account.",
          loginUrl: `/login?next=${encodeURIComponent(pricingReturnPath)}`
        },
        { status: 401 }
      );
    }

    const stripe = getStripe();
    const planConfig = getStripePlanConfig(plan);
    const price = getStripePriceId(plan);
    const profile = user && hasSupabaseAdminConfig()
      ? await ensureBillingProfile(user.id, user.email)
      : null;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: planConfig.checkoutMode,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        plan,
        access_plan: planConfig.accessPlan,
        access_ends_at: planConfig.accessEndsAt ?? "",
        source: "theblitzroom_fantasy"
      },
      success_url: `${appUrl}/account?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`
    };

    if (planConfig.checkoutMode === "subscription") {
      sessionConfig.subscription_data = {
        metadata: {
          plan,
          access_plan: planConfig.accessPlan,
          source: "theblitzroom_fantasy"
        }
      };
    } else {
      sessionConfig.payment_intent_data = {
        metadata: {
          plan,
          access_plan: planConfig.accessPlan,
          access_ends_at: planConfig.accessEndsAt ?? "",
          source: "theblitzroom_fantasy"
        }
      };

      if (!profile?.stripe_customer_id) {
        sessionConfig.customer_creation = "always";
      }
    }

    if (profile?.stripe_customer_id) {
      sessionConfig.customer = profile.stripe_customer_id;
    } else if (profile?.email || user?.email || body.email) {
      sessionConfig.customer_email = profile?.email ?? user?.email ?? body.email;
    }

    if (profile?.id ?? user?.id) {
      sessionConfig.client_reference_id = profile?.id ?? user?.id;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 500 });
  }
}
