import { PricingCards } from "@/components/PricingCards";
import { PricingCheckoutLauncher } from "@/components/PricingCheckoutLauncher";
import { SectionShell } from "@/components/SectionShell";

export default function PricingPage() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Choose your season."
      description="Preview the product, choose monthly access, or use a season pass for the Draft Room and complete league toolkit through 2026."
    >
      <PricingCheckoutLauncher />
      <PricingCards />
    </SectionShell>
  );
}
