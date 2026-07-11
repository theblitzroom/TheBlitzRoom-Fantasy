import { NextResponse } from "next/server";
import type Stripe from "stripe";
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
    const supabase = hasSupabaseBrowserConfig() ? await createSupabaseServerClient() : null;
    const { data: userResult } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    const user = userResult.user;
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
