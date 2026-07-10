import { PricingCards } from "@/components/PricingCards";
import { SectionShell } from "@/components/SectionShell";

export default function PricingPage() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Pick the plan that matches how you play."
      description="Start with the free preview, choose monthly flexibility, or lock in season-pass value for draft night and league management."
    >
      <PricingCards />
    </SectionShell>
  );
}
