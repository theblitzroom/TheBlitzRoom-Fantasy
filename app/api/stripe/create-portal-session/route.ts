import { NextResponse } from "next/server";
import { getBillingProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";
import { hasSupabaseAdminConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await request.json().catch(() => ({}));

    if (!hasSupabaseBrowserConfig()) {
      return NextResponse.json({ error: "Account login is not configured yet." }, { status: 401 });
    }

    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json({ error: "Billing profile access is not configured yet." }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    const profile = user ? await getBillingProfile(user.id) : null;

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer is connected yet. Choose a plan first, then return here to manage billing." },
        { status: 401 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/account`
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing portal failed" },
      { status: 500 }
    );
  }
}
