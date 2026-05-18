import type { MeetingMinutesMock } from "@/lib/mock/workflowMock";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>(없음)</div>
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
  emptyLabel = "회의록이 없습니다.",
}: {
  minutes: MeetingMinutesMock | null;
  emptyLabel?: string;
}) {
  if (!minutes) {
    return (
      <section aria-label="회의록">
        <WorkflowEmptyState title="회의록" message={emptyLabel} />
      </section>
    );
  }
  return (
    <section aria-label="회의록" style={{ display: "grid", gap: 10 }}>
      <WorkflowCard padding={12}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>회의록</div>
        <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{minutes.summary}</div>
      </WorkflowCard>
      <div style={{ display: "grid", gap: 10 }}>
        <ListBlock title="결정" items={minutes.decisions} />
        <ListBlock title="미결" items={minutes.pending} />
        <ListBlock title="제외" items={minutes.excluded} />
      </div>
    </section>
  );
}

