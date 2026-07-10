import type { ReactNode } from "react";
import { hasPlanAccess, previewSubscription, type SubscriptionPlan } from "@/lib/subscription";
import { PremiumButton } from "./PremiumButton";

type PreviewGateProps = {
  requiredPlan?: SubscriptionPlan;
  children: ReactNode;
};

export function PreviewGate({ requiredPlan = "draft_pro", children }: PreviewGateProps) {
  const subscription = previewSubscription;
  const unlocked = hasPlanAccess(subscription.plan, requiredPlan);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="locked-panel">
      <span className="badge badge-premium">Premium feature</span>
      <h2>Unlock the live command layer</h2>
      <p>
        The preview shows the shape of the tool. A paid account unlocks full draft sync,
        saved league context, recommendations, and live roster intelligence.
      </p>
      <PremiumButton href="/pricing">View plans</PremiumButton>
    </div>
  );
}
