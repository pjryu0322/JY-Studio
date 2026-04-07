"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DiscussionInput } from "@/components/workflow/DiscussionInput";
import { DiscussionTimeline, type DiscussionItem } from "@/components/workflow/DiscussionTimeline";
import { FeatureSummaryPanel } from "@/components/workflow/FeatureSummaryPanel";
import { MeetingMinutesPanel } from "@/components/workflow/MeetingMinutesPanel";
import {
  getMockFeaturesForSession,
  getMockMinutesForSession,
  getMockRequirement,
  getMockSession,
} from "@/lib/mock/workflowMock";

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #d1d5db",
        background: "#fafafa",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 900,
        color: "#111827",
      }}
    >
      {label}
    </button>
  );
}

export default function CollaborationWorkspacePage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : "";
  const session = getMockSession(sessionId);
  const req = session ? getMockRequirement(session.requirementId) : null;

  const [discussion, setDiscussion] = useState<DiscussionItem[]>(() => [
    {
      id: "d-1",
      at: "2026-04-07 10:05",
      author: "Alice",
      mode: "online",
      content: "Let’s align on the collaboration workspace structure first (top summary + discussion + right results).",
    },
    {
      id: "d-2",
      at: "2026-04-07 10:12",
      author: "Bob",
      mode: "offline",
      content: "Offline meeting notes: capture decisions + pending items; keep minutes panel reusable across pages.",
    },
  ]);

  const minutes = useMemo(() => getMockMinutesForSession(sessionId || "sess-201"), [sessionId]);
  const features = useMemo(() => getMockFeaturesForSession(sessionId || "sess-201"), [sessionId]);

  const [actionLog, setActionLog] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{session?.title ?? "Collaboration Session"}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            {session ? `${session.createdAt} · ${session.status} · ${session.id}` : "Unknown session id."}
          </div>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/collaboration" style={{ fontSize: 13, textDecoration: "underline" }}>
            Back to sessions
          </Link>
        </div>
      </div>

      {/* Top area */}
      <section
        aria-label="Requirement summary"
        style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14, marginTop: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Linked Requirement</div>
            {req ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 900 }}>{req.title}</div>
                <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>{req.description}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#6b7280" }}>(no requirement linked)</div>
            )}
          </div>
          {req ? (
            <Link
              href={`/requirements/${encodeURIComponent(req.id)}?tab=sessions`}
              style={{ fontSize: 13, textDecoration: "underline", alignSelf: "center" }}
            >
              Open requirement
            </Link>
          ) : null}
        </div>

        <div style={{ marginTop: 12, borderTop: "1px dashed #e5e5e5", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Related materials</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>(placeholder) Attach links/docs in the next phase.</div>
        </div>
      </section>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, marginTop: 14 }}>
        {/* Center discussion */}
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton
              label="회의록 작성"
              onClick={() => setActionLog("회의록 작성 (mock) — minutes generation will be wired in next phase.")}
            />
            <ActionButton
              label="분석 요청"
              onClick={() => setActionLog("분석 요청 (mock) — analysis workflow will be wired in next phase.")}
            />
            <ActionButton
              label="아이디어 요청"
              onClick={() => setActionLog("아이디어 요청 (mock) — idea generation will be wired in next phase.")}
            />
          </div>
          {actionLog ? (
            <div
              role="status"
              style={{
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1e40af",
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {actionLog}
            </div>
          ) : null}

          <DiscussionInput
            onAdd={(item) => {
              const now = new Date();
              const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
                now.getHours()
              ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
              setDiscussion((prev) => [{ id: `d-${prev.length + 1}`, at, ...item }, ...prev]);
            }}
          />
          <DiscussionTimeline items={discussion} />
        </div>

        {/* Right panel */}
        <aside aria-label="Results panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Latest minutes</div>
            <MeetingMinutesPanel minutes={minutes} />
          </div>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
            <FeatureSummaryPanel title="Derived features (session)" features={features} />
          </div>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Non-functional summary</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
              (placeholder) Consolidated non-functional constraints will appear here later.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

