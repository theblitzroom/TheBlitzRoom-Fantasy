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
      <span className="badge badge-premium">Preview mode</span>
      <h2>Live controls are available with an active plan.</h2>
      <p>
        This view shows the command center layout. Plans add live Sleeper sync,
        saved league context, full recommendations, and roster tracking during the draft.
      </p>
      <PremiumButton href="/pricing">Compare plans</PremiumButton>
    </div>
  );
}
