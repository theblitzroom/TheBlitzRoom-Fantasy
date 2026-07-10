"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.assign("/account");
  }

  return (
    <button className="premium-button premium-button-secondary" disabled={loading} onClick={signOut} type="button">
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
