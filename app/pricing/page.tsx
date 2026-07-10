import { PricingCards } from "@/components/PricingCards";
import { SectionShell } from "@/components/SectionShell";

export default function PricingPage() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Choose monthly flexibility or season-pass value."
      description="Preview the product for free, subscribe month to month, or lock in the 2026 fantasy season with one-time access built for draft night and league management."
    >
      <PricingCards />
    </SectionShell>
  );
}
