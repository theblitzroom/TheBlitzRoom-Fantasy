"use client";

import { useState } from "react";

type ManageBillingButtonProps = {
  userId?: string;
};

export function ManageBillingButton({ userId }: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId })
      });

      const data = await response.json() as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Billing portal could not be opened.");
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing portal could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-action">
      <button className="premium-button premium-button-secondary" disabled={loading} onClick={openPortal}>
        {loading ? "Opening billing..." : "Manage billing"}
      </button>
      {error ? <small className="sync-error">{error}</small> : null}
    </div>
  );
}
