import { ExtensionConnectPanel } from "@/components/ExtensionConnectPanel";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import { SectionShell } from "@/components/SectionShell";

export default function ExtensionPage() {
  return (
    <SectionShell
      eyebrow="Chrome companion"
      title="Link the extension to your website workspace."
      description="Use this page to confirm the locally loaded The Blitz Room extension is active on the site and ready to support live Sleeper draft workflows."
    >
      <div className="league-hub">
        <ProductCommandNav />
        <ExtensionConnectPanel />
      </div>
    </SectionShell>
  );
}
