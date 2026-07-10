import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BillingProfile = {
  id: string;
  email: string | null;
  stripe_customer_id: string | null;
};

export async function getBillingProfile(profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,stripe_customer_id")
    .eq("id", profileId)
    .maybeSingle<BillingProfile>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function ensureBillingProfile(profileId: string, email?: string | null) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: profileId,
        email: email ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("id,email,stripe_customer_id")
    .single<BillingProfile>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function attachStripeCustomerToProfile(profileId: string, stripeCustomerId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString()
    })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }
}
