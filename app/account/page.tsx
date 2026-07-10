import { ManageBillingButton } from "@/components/ManageBillingButton";
import { PremiumButton } from "@/components/PremiumButton";
import { SectionShell } from "@/components/SectionShell";

export default function AccountPage() {
  return (
    <SectionShell
      eyebrow="Account"
      title="Account and subscription state will live here."
      description="This is where Supabase auth, saved leagues, Stripe status, and billing management connect into the app."
    >
      <div className="locked-panel">
        <span className="badge badge-premium">Preview account</span>
        <h2>No live account connected yet</h2>
        <p>Wire Supabase auth into this page, then replace preview state with the signed-in user&apos;s subscription and saved leagues.</p>
        <div className="button-row">
          <PremiumButton href="/pricing">Choose a plan</PremiumButton>
          <ManageBillingButton />
        </div>
      </div>
    </SectionShell>
  );
}
