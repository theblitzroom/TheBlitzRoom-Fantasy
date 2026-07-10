"use client";

import { useState } from "react";
import type { PaidPlan } from "@/lib/stripePlans";

type CheckoutButtonProps = {
  plan: PaidPlan;
  children: React.ReactNode;
  highlighted?: boolean;
};

export function CheckoutButton({ plan, children, highlighted }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan })
      });

      const data = await response.json() as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout could not be started.");
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-action">
      <button
        className={highlighted ? "premium-button premium-button-primary" : "premium-button premium-button-secondary"}
        disabled={loading}
        onClick={startCheckout}
      >
        {loading ? "Opening checkout..." : children}
      </button>
      {error ? <small className="sync-error">{error}</small> : null}
    </div>
  );
}
