"use client";

import { useEffect, useRef, useState } from "react";

const checkoutPlans = new Set([
  "draft_pro_season",
  "dynasty_elite_season",
  "draft_pro_monthly",
  "dynasty_elite_monthly"
]);

type CheckoutResponse = {
  url?: string;
  loginUrl?: string;
  error?: string;
};

export function PricingCheckoutLauncher({ endpoint = "/api/stripe/create-checkout-session" }: { endpoint?: string }) {
  const startedRef = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("checkoutPlan");

    if (!plan || !checkoutPlans.has(plan) || startedRef.current) {
      return;
    }

    startedRef.current = true;
    setMessage("Opening secure Stripe checkout...");
    setError("");

    async function startCheckout() {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan })
        });
        const data = await response.json() as CheckoutResponse;

        if (response.status === 401) {
          const next = `/pricing?checkoutPlan=${encodeURIComponent(plan ?? "")}`;
          window.location.assign(data.loginUrl ?? `/login?next=${encodeURIComponent(next)}`);
          return;
        }

        if (!response.ok || !data.url) {
          throw new Error(data.error ?? "Checkout could not be started.");
        }

        window.location.assign(data.url);
      } catch (caught) {
        setMessage("");
        setError(caught instanceof Error ? caught.message : "Checkout could not be started.");
        startedRef.current = false;
      }
    }

    void startCheckout();
  }, [endpoint]);

  if (!message && !error) {
    return null;
  }

  return (
    <div className={error ? "test-checkout-card" : "test-checkout-card ready"} role="status">
      <span className="eyebrow">Checkout</span>
      <p>{error || message}</p>
    </div>
  );
}
