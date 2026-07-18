import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan } from "@/lib/subscription";

type AccessGrantUpsert = {
  stripeCustomerId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null;
  stripePriceId: string | null;
  profileId?: string | null;
  plan: Exclude<SubscriptionPlan, "preview">;
  accessEndsAt: string;
};

export async function upsertAccessGrantFromStripe({
  stripeCustomerId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  stripePriceId,
  profileId,
  plan,
  accessEndsAt
}: AccessGrantUpsert) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("access_grants")
    .upsert(
      {
        stripe_customer_id: stripeCustomerId,
        stripe_checkout_session_id: stripeCheckoutSessionId,
        stripe_payment_intent_id: stripePaymentIntentId ?? null,
        stripe_price_id: stripePriceId,
        profile_id: profileId ?? null,
        plan,
        status: "active",
        access_ends_at: accessEndsAt,
        updated_at: new Date().toISOString()
      },
      { onConflict: "stripe_checkout_session_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAccessGrantStatusFromPaymentIntent(stripePaymentIntentId: string | null | undefined, status: "active" | "refunded" | "disputed") {
  if (!stripePaymentIntentId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("access_grants")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("stripe_payment_intent_id", stripePaymentIntentId);

  if (error) {
    throw new Error(error.message);
  }
}
