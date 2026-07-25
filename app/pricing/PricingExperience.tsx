"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck2,
  Check,
  CreditCard,
  Headphones,
  LockKeyhole,
  Newspaper,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { CheckoutButton } from "@/components/CheckoutButton";
import { plans, type Plan } from "@/config/pricing";
import type { CheckoutPlan } from "@/lib/stripePlans";
import styles from "./pricing.module.css";

type BillingMode = "season" | "monthly";
type PaidPlan = Plan & { id: CheckoutPlan };

const previewFeatures = [
  { icon: Zap, title: "Draft Room Preview", detail: "Explore the board" },
  { icon: BarChart3, title: "Sample Rankings", detail: "See the player view" },
  { icon: Newspaper, title: "Player News", detail: "Daily NFL context" }
];

const draftSeasonFeatures = [
  { icon: Trophy, title: "Unlimited 2026 Drafts", detail: "Every mock and live draft" },
  { icon: CalendarCheck2, title: "Full Draft-Season Access", detail: "Through February 15, 2027" },
  { icon: Radio, title: "Sleeper Live Sync", detail: "Picks update in context" },
  { icon: Bot, title: "Draft Assistant", detail: "BPA plus roster fit" }
];

const draftMonthlyFeatures = [
  { icon: Radio, title: "Sleeper Live Sync", detail: "Picks update in context" },
  { icon: BarChart3, title: "Draft Rankings", detail: "Redraft and dynasty" },
  { icon: Bot, title: "Draft Assistant", detail: "BPA plus roster fit" },
  { icon: CreditCard, title: "Monthly Flexibility", detail: "Cancel before renewal" }
];

const eliteFeatures = [
  { icon: Trophy, title: "All Draft Pro Tools", detail: "The complete draft suite" },
  { icon: Sparkles, title: "League Command Center", detail: "Redraft and dynasty" },
  { icon: ShieldCheck, title: "Power Rankings", detail: "Roster strategy and needs" },
  { icon: BarChart3, title: "Trade Analyzer", detail: "Player and pick values" }
];

function findPaidPlan(id: CheckoutPlan) {
  return plans.find((plan): plan is PaidPlan => plan.id === id);
}

function PriceDisplay({ plan, mode }: { plan: PaidPlan; mode: BillingMode }) {
  const amount = plan.price.replace("$", "");

  return (
    <div className={styles.price}>
      <span>$</span>
      <strong>{amount}</strong>
      <small>{mode === "monthly" ? "/mo" : "one time"}</small>
    </div>
  );
}

function FeatureList({
  features
}: {
  features: Array<{ icon: LucideIcon; title: string; detail: string }>;
}) {
  return (
    <ul className={styles.featureList}>
      {features.map(({ icon: Icon, title, detail }) => (
        <li key={title}>
          <span className={styles.featureIcon}><Icon aria-hidden="true" size={23} /></span>
          <span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PricingExperience() {
  const [mode, setMode] = useState<BillingMode>("season");
  const draftId: CheckoutPlan = mode === "season" ? "draft_pro_season" : "draft_pro_monthly";
  const eliteId: CheckoutPlan = mode === "season" ? "dynasty_elite_season" : "dynasty_elite_monthly";
  const selectedPlans = {
    draft: findPaidPlan(draftId),
    elite: findPaidPlan(eliteId)
  };
  const isSeason = mode === "season";
  const draftFeatures = isSeason ? draftSeasonFeatures : draftMonthlyFeatures;

  if (!selectedPlans.draft || !selectedPlans.elite) {
    return <p className={styles.pricingError}>Pricing is temporarily unavailable.</p>;
  }

  return (
    <>
      <div className={styles.billingSwitch} aria-label="Billing frequency">
        <button
          aria-pressed={mode === "season"}
          className={mode === "season" ? styles.selectedBilling : ""}
          onClick={() => setMode("season")}
          type="button"
        >
          <CalendarCheck2 aria-hidden="true" size={16} />
          2026 Season Pass
        </button>
        <button
          aria-pressed={mode === "monthly"}
          className={mode === "monthly" ? styles.selectedBilling : ""}
          onClick={() => setMode("monthly")}
          type="button"
        >
          <CreditCard aria-hidden="true" size={16} />
          Monthly
        </button>
      </div>

      <section className={styles.planGrid} id="plans" aria-label="Pricing plans">
        <article className={styles.planCard}>
          <header>
            <span className={styles.planName}>Preview</span>
            <div className={styles.price}>
              <span>$</span>
              <strong>0</strong>
              <small>free</small>
            </div>
            <p>See how the room works before choosing a plan.</p>
          </header>
          <FeatureList features={previewFeatures} />
          <Link className={styles.secondaryCta} href="/draft-room">
            Start Preview <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </article>

        <article className={`${styles.planCard} ${styles.featuredPlan}`}>
          <span className={styles.popularBadge}>
            <Sparkles aria-hidden="true" size={15} />
            {isSeason ? "Best Draft Value" : "Flexible Access"}
          </span>
          <header>
            <span className={styles.planName}>Draft Pro</span>
            <PriceDisplay mode={mode} plan={selectedPlans.draft} />
            <p>
              {isSeason
                ? "One payment for every 2026 mock and live draft. No recurring bill."
                : "Live draft intelligence that renews monthly and can be canceled anytime."}
            </p>
          </header>
          <div className={styles.billingValue}>
            <strong>{isSeason ? "Save 25%" : "Pay as you go"}</strong>
            <span>
              {isSeason
                ? "Compared with five monthly payments"
                : "Keep access only for the months you need"}
            </span>
          </div>
          <FeatureList features={draftFeatures} />
          <CheckoutButton highlighted plan={selectedPlans.draft.id}>
            {isSeason ? "Get the 2026 Season Pass" : "Start Monthly Access"} <ArrowRight aria-hidden="true" size={18} />
          </CheckoutButton>
        </article>

        <article className={styles.planCard}>
          <header>
            <span className={styles.planName}>Fantasy Elite</span>
            <PriceDisplay mode={mode} plan={selectedPlans.elite} />
            <p>The full-season command center for league, roster, and trade decisions.</p>
          </header>
          <FeatureList features={eliteFeatures} />
          <CheckoutButton plan={selectedPlans.elite.id}>
            {mode === "season" ? "Get Fantasy Elite" : "Subscribe Monthly"} <ArrowRight aria-hidden="true" size={18} />
          </CheckoutButton>
        </article>
      </section>

      <section className={styles.trustBar} aria-label="Checkout benefits">
        <div><LockKeyhole aria-hidden="true" size={28} /><span><strong>Secure Checkout</strong><small>Protected by Stripe</small></span></div>
        <div><Check aria-hidden="true" size={28} /><span><strong>Clear Billing</strong><small>No hidden fees</small></span></div>
        <div><Headphones aria-hidden="true" size={28} /><span><strong>Direct Support</strong><small>Help when you need it</small></span></div>
      </section>
    </>
  );
}
