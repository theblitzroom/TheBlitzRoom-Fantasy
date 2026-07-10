import { PricingCards } from "@/components/PricingCards";
import { SectionShell } from "@/components/SectionShell";

export default function PricingPage() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Simple season passes. No surprise renewals."
      description="Preview the product for free, then unlock the 2026 fantasy season with a one-time pass built for draft night and league management."
    >
      <PricingCards />
    </SectionShell>
  );
}
