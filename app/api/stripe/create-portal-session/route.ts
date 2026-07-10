import { NextResponse } from "next/server";
import { getBillingProfile } from "@/lib/billingProfiles";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const body = await request.json().catch(() => ({})) as { userId?: string };
    const profile = body.userId ? await getBillingProfile(body.userId) : null;

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer is connected yet. Wire this to the signed-in Supabase user." },
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
