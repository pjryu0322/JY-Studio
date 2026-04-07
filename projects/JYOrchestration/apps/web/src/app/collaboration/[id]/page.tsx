"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DiscussionInput } from "@/components/workflow/DiscussionInput";
import { DiscussionTimeline, type DiscussionItem } from "@/components/workflow/DiscussionTimeline";
import { ActionResultPanel } from "@/components/workflow/ActionResultPanel";
import { FeatureSummaryPanel } from "@/components/workflow/FeatureSummaryPanel";
import { MeetingMinutesPanel } from "@/components/workflow/MeetingMinutesPanel";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import {
  buildMockActionResult,
  type CollaborationActionResult,
  type CollaborationActionType,
} from "@/lib/workflow/collaborationActionContract";
import { getCollaborationWorkspaceView } from "@/lib/workflow/workflowViewModel";

export default function CollaborationWorkspacePage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : "";
  const vm = useMemo(() => getCollaborationWorkspaceView(sessionId), [sessionId]);

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

  const [actionState, setActionState] = useState<{
    status: "idle" | "running" | "success" | "error";
    latest: CollaborationActionResult | null;
  }>({ status: "idle", latest: null });

  const runAction = async (actionType: CollaborationActionType) => {
    setActionState({ status: "running", latest: { actionType, status: "running", atIso: new Date().toISOString(), message: "Running…", payload: null } });
    // Local/mock contract for now. Next phase can replace this with a real API call.
    await new Promise((r) => setTimeout(r, 250));
    const out = buildMockActionResult(actionType);
    setActionState({ status: out.status, latest: out });
  };

  return (
    <div>
      <WorkflowPageHeader
        title={vm.session?.title ?? "Collaboration Session"}
        subtitle={
          vm.session
            ? `${vm.session.createdAt} · ${vm.session.id}`
            : sessionId
              ? `Unknown session id: ${sessionId}`
              : "Unknown session id."
        }
        backHref="/collaboration"
        backLabel="Back to sessions"
        right={vm.session ? <WorkflowBadge>{vm.session.status}</WorkflowBadge> : <WorkflowBadge>UNKNOWN</WorkflowBadge>}
      />

      {/* Top area */}
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {!vm.session ? (
          <WorkflowEmptyState
            title="Session not found"
            message="Please check the URL. This page will not show unrelated mock minutes/features for invalid sessions."
          />
        ) : null}

        <WorkflowCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Linked Requirement</div>
              {vm.requirement ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{vm.requirement.title}</div>
                  <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>
                    {vm.requirement.description}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280" }}>(no requirement linked)</div>
              )}
            </div>
            {vm.requirement ? (
              <Link
                href={`/requirements/${encodeURIComponent(vm.requirement.id)}?tab=sessions`}
                style={{ fontSize: 13, textDecoration: "underline", alignSelf: "center" }}
              >
                Open requirement
              </Link>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Related materials</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>(placeholder) Attach links/docs in the next phase.</div>
        </WorkflowCard>
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, marginTop: 14 }}>
        {/* Center discussion */}
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <WorkflowActionButton
              label="회의록 작성"
              onClick={() => void runAction("GENERATE_MINUTES")}
            />
            <WorkflowActionButton
              label="분석 요청"
              onClick={() => void runAction("REQUEST_ANALYSIS")}
            />
            <WorkflowActionButton
              label="아이디어 요청"
              onClick={() => void runAction("REQUEST_IDEAS")}
            />
          </div>

          <WorkflowCard padding={12}>
            <ActionResultPanel result={actionState.latest} />
          </WorkflowCard>

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
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Latest minutes</div>
            <MeetingMinutesPanel minutes={vm.minutes} emptyLabel="No meeting minutes available" />
          </WorkflowCard>

          <WorkflowCard padding={12}>
            <FeatureSummaryPanel
              title="Derived features (session)"
              features={vm.features}
              emptyLabel="No derived features available"
            />
          </WorkflowCard>

          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Non-functional summary</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
              (placeholder) Consolidated non-functional constraints will appear here later.
            </div>
          </WorkflowCard>
        </aside>
      </div>
    </div>
  );
}

