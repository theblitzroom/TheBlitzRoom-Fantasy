import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanFromPriceId } from "@/lib/stripePlans";

type SubscriptionUpsert = {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: Stripe.Subscription.Status;
  priceId: string | null;
  currentPeriodEnd: number | null;
  profileId?: string | null;
};

function unixToIso(value: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

export async function upsertSubscriptionFromStripe({
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  priceId,
  currentPeriodEnd,
  profileId
}: SubscriptionUpsert) {
  const supabase = createSupabaseAdminClient();
  const plan = getPlanFromPriceId(priceId);

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: priceId,
        profile_id: profileId ?? null,
        plan,
        status,
        current_period_end: unixToIso(currentPeriodEnd),
        updated_at: new Date().toISOString()
      },
      { onConflict: "stripe_subscription_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export function getPrimaryPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price.id ?? null;
}
