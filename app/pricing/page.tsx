import { PricingCards } from "@/components/PricingCards";
import { SectionShell } from "@/components/SectionShell";

export default function PricingPage() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Let users taste the tool, then make the upgrade obvious."
      description="Preview mode shows the premium experience without giving away the fully functional live draft room."
    >
      <PricingCards />
    </SectionShell>
  );
}
