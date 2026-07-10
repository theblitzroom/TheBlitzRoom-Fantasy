import { DraftRoomPreview } from "@/components/DraftRoomPreview";
import { SectionShell } from "@/components/SectionShell";
import { SleeperSyncPanel } from "@/components/SleeperSyncPanel";

export default function DraftRoomPage() {
  return (
    <SectionShell
      eyebrow="Sleeper draft room"
      title="Read-only Sleeper sync, built for live decisions."
      description="Paste a Sleeper draft ID or connect a saved league, then poll official public draft state while the room is open."
    >
      <SleeperSyncPanel />
      <DraftRoomPreview />
      <div className="data-card">
        <div className="card-title">Sync policy</div>
        <p>
          The live draft room should poll once per second while open, de-duplicate by pick number,
          and apply manual overrides when needed. It should never auto-draft or call private endpoints.
        </p>
      </div>
    </SectionShell>
  );
}
