import type { MeetingMinutesMock } from "@/lib/mock/workflowMock";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>(empty)</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          {items.map((x, idx) => (
            <li key={`${title}-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MeetingMinutesPanel({
  minutes,
  emptyLabel = "No meeting minutes available",
}: {
  minutes: MeetingMinutesMock | null;
  emptyLabel?: string;
}) {
  if (!minutes) {
    return (
      <section aria-label="Meeting minutes">
        <WorkflowEmptyState title="Meeting Minutes" message={emptyLabel} />
      </section>
    );
  }
  return (
    <section aria-label="Meeting minutes" style={{ display: "grid", gap: 10 }}>
      <WorkflowCard padding={12}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Meeting Minutes</div>
        <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{minutes.summary}</div>
      </WorkflowCard>
      <div style={{ display: "grid", gap: 10 }}>
        <ListBlock title="Decisions" items={minutes.decisions} />
        <ListBlock title="Pending" items={minutes.pending} />
        <ListBlock title="Excluded" items={minutes.excluded} />
      </div>
    </section>
  );
}

