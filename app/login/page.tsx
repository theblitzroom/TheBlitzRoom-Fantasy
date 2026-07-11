import { AuthPanel } from "@/components/AuthPanel";
import { SectionShell } from "@/components/SectionShell";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  if (!hasSupabaseBrowserConfig()) {
    return (
      <SectionShell
        eyebrow="Login"
        title="Account login is almost ready."
        description="Add the Supabase URL and anon key in Vercel to enable sign in and account creation."
      >
        <div className="locked-panel">
          <span className="badge badge-premium">Setup required</span>
          <h2>Supabase keys needed</h2>
          <p>Once the Supabase environment variables are set, this page becomes the live login and account creation screen.</p>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      eyebrow="Login"
      title="Access your TheBlitzRoom account."
      description="Sign in or create an account to connect your subscription, billing, saved leagues, and draft room settings."
    >
      <div className="account-grid">
        <AuthPanel />
        <div className="account-benefits">
          <span className="badge badge-premium">TheBlitzRoom account</span>
          <h2>One login for every fantasy tool.</h2>
          <p>Keep paid access, live draft prep, and future league analysis connected to the same account.</p>
          <div className="account-checklist">
            <span>Secure email and password login</span>
            <span>Stripe access tied after checkout</span>
            <span>Saved leagues and draft preferences foundation</span>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
