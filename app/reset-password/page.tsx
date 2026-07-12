import { ResetPasswordPanel } from "@/components/ResetPasswordPanel";
import { SectionShell } from "@/components/SectionShell";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <SectionShell
      eyebrow="Reset password"
      title="Get back into your account."
      description="Use the secure reset link from your email to set a new password for TheBlitzRoom."
    >
      <ResetPasswordPanel />
    </SectionShell>
  );
}
