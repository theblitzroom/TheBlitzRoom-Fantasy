"use client";

import { useState } from "react";
import { plans } from "@/config/pricing";
import type { CheckoutPlan } from "@/lib/stripePlans";
import { CheckoutButton } from "./CheckoutButton";
import { PremiumButton } from "./PremiumButton";

type BillingMode = "season" | "monthly";
type PaidPlan = (typeof plans)[number] & { id: CheckoutPlan };

const previewPlan = plans.find((plan) => plan.id === "preview");
const trustNotes = ["Read-only Sleeper sync", "No auto-drafting", "Secure Stripe checkout", "Cancel monthly anytime"];

function isPaidPlan(plan: (typeof plans)[number]): plan is PaidPlan {
  return plan.id !== "preview";
}

export function PricingCards() {
  const [billingMode, setBillingMode] = useState<BillingMode>("season");
  const paidPlans = plans.filter(isPaidPlan).filter((plan) => plan.billing === billingMode);

  return (
    <div className="pricing-experience">
      {previewPlan ? (
        <section className="preview-strip" aria-label="Free preview">
          <div>
            <span className="eyebrow">{previewPlan.name}</span>
            <h2>See the draft workflow before you commit.</h2>
            <p>{previewPlan.audience}</p>
          </div>
          <PremiumButton href="/draft-room" variant="secondary">{previewPlan.cta}</PremiumButton>
        </section>
      ) : null}

      <div className="billing-toggle" aria-label="Choose billing type">
        <button className={billingMode === "season" ? "active" : ""} onClick={() => setBillingMode("season")} type="button">
          Season Pass
        </button>
        <button className={billingMode === "monthly" ? "active" : ""} onClick={() => setBillingMode("monthly")} type="button">
          Monthly
        </button>
      </div>

      <div className="pricing-grid pricing-grid-focused">
        {paidPlans.map((plan) => (
          <article className={plan.highlighted ? "pricing-card highlighted" : "pricing-card"} key={plan.id}>
            <span className="eyebrow">{plan.name}</span>
            {plan.badge ? <span className="plan-badge">{plan.badge}</span> : null}
            <div className="price">{plan.price}</div>
            {plan.priceDetail ? <div className="price-detail">{plan.priceDetail}</div> : null}
            <p>{plan.audience}</p>
            {plan.bestFor ? <div className="best-for">{plan.bestFor}</div> : null}
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <CheckoutButton plan={plan.id} highlighted={plan.highlighted}>{plan.cta}</CheckoutButton>
          </article>
        ))}
      </div>

      <section className="pricing-helper-grid" aria-label="Plan guidance">
        <div className="pricing-helper-card">
          <span className="eyebrow">How to choose</span>
          <h2>Draft Pro is for draft night. Elite is for the whole league year.</h2>
          <p>
            Draft Pro focuses on live picks, rankings, BPA, roster needs, and Sleeper sync.
            Fantasy Elite adds league context, dynasty strategy, roster planning, power rankings, and trade value.
          </p>
        </div>
        <div className="pricing-helper-card">
          <span className="eyebrow">Trust</span>
          <div className="trust-list">
            {trustNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
