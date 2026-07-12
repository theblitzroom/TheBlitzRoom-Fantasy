import { PricingCards } from "@/components/PricingCards";
import { SectionShell } from "@/components/SectionShell";

export default function PricingPage() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Simple access for draft season."
      description="Start with a preview, choose monthly access, or use a season pass if you want the draft room and league tools available through the 2026 fantasy season."
    >
      <PricingCards />
    </SectionShell>
  );
}
