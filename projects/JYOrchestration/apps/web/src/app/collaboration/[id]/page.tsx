"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ActionResultPanel,
  type ActionWorkspaceImpact,
} from "@/components/workflow/ActionResultPanel";
import { CollaborationWorkspaceAside } from "@/components/workflow/CollaborationWorkspaceAside";
import { DiscussionInput } from "@/components/workflow/DiscussionInput";
import { DiscussionTimeline, type DiscussionItem } from "@/components/workflow/DiscussionTimeline";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import type { CollaborationActionResult, CollaborationActionType } from "@/lib/workflow/collaborationActionContract";
import { isSuccessCollaborationResult } from "@/lib/workflow/collaborationActionContract";
import { requestCollaborationGeneration } from "@/lib/workflow/collaborationGenerationClient";
import {
  recordSessionGeneratedMinutes,
  resolveSessionMinutes,
  resolveSessionOfficialFeatures,
} from "@/lib/workflow/collaborationSessionResultStore";
import { type DisplayedAnalysis, ideaStringsToSuggestedFeatures } from "@/lib/workflow/collaborationWorkspacePayload";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";
import { routeState } from "@/lib/workflow/workflowState";
import { getCollaborationWorkspaceView } from "@/lib/workflow/workflowViewModel";

function workspaceImpactFrom(latest: CollaborationActionResult | null): ActionWorkspaceImpact | null {
  if (!latest || latest.status !== "success") return null;
  if (latest.actionType === "GENERATE_MINUTES") {
    return {
      scope: "primary",
      lines: [
        "Latest minutes (official) on the right now reflects this run.",
        "Supporting insights stay the same until you run analysis or ideas.",
      ],
    };
  }
  if (latest.actionType === "REQUEST_ANALYSIS") {
    return {
      scope: "supporting",
      lines: [
        "Open Supporting insights to see the new analysis notes.",
        "Official minutes and derived features were not changed.",
      ],
    };
  }
  return {
    scope: "supporting",
    lines: [
      "Ideas and suggested feature cards were refreshed (labeled as suggestions, not official).",
      "Official derived features on the right are unchanged.",
    ],
  };
}

export default function CollaborationWorkspacePage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : "";
  const vm = useMemo(() => getCollaborationWorkspaceView(sessionId), [sessionId]);
  const sessionRoute = useMemo(() => routeState(sessionId, vm.session), [sessionId, vm.session]);

  const [displayedMinutes, setDisplayedMinutes] = useState<MeetingMinutesMock | null>(null);
  const [displayedFeatures, setDisplayedFeatures] = useState<FeatureMock[]>([]);
  const [displayedAnalysis, setDisplayedAnalysis] = useState<DisplayedAnalysis | null>(null);
  const [displayedIdeas, setDisplayedIdeas] = useState<string[]>([]);
  const [suggestedFeaturesFromIdeas, setSuggestedFeaturesFromIdeas] = useState<FeatureMock[]>([]);

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

  useEffect(() => {
    const view = getCollaborationWorkspaceView(sessionId);
    if (!view.session) {
      return;
    }
    setDisplayedMinutes(resolveSessionMinutes(sessionId, view.minutes));
    setDisplayedFeatures([...resolveSessionOfficialFeatures(sessionId, view.features)]);
    setDisplayedAnalysis(null);
    setDisplayedIdeas([]);
    setSuggestedFeaturesFromIdeas([]);
    setActionState({ status: "idle", latest: null });
  }, [sessionId]);

  const workspaceImpact = useMemo(() => workspaceImpactFrom(actionState.latest), [actionState.latest]);

  const runAction = async (actionType: CollaborationActionType) => {
    setActionState({
      status: "running",
      latest: { actionType, status: "running", atIso: new Date().toISOString(), message: "Running…", payload: null },
    });
    const out = await requestCollaborationGeneration(actionType, sessionId);
    setActionState({ status: out.status, latest: out });

    if (!isSuccessCollaborationResult(out)) {
      return;
    }

    switch (out.actionType) {
      case "GENERATE_MINUTES":
        recordSessionGeneratedMinutes(sessionId, out.payload, out.generationSource);
        setDisplayedMinutes(out.payload);
        break;
      case "REQUEST_ANALYSIS":
        setDisplayedAnalysis(out.payload);
        break;
      case "REQUEST_IDEAS": {
        const { ideas } = out.payload;
        setDisplayedIdeas(ideas);
        setSuggestedFeaturesFromIdeas(ideaStringsToSuggestedFeatures(ideas, Date.now()));
        break;
      }
    }
  };

  if (sessionRoute.kind === "not_found") {
    return (
      <div>
        <WorkflowPageHeader
          title="Collaboration Session"
          subtitle={sessionId ? `Unknown session id: ${sessionId}` : "Unknown session id."}
          backHref="/collaboration"
          backLabel="Back to sessions"
          right={<WorkflowBadge>UNKNOWN</WorkflowBadge>}
        />
        <div style={{ marginTop: 14 }}>
          <WorkflowEmptyState
            title="Session not found"
            message="Please check the URL. This page will not show unrelated mock minutes or features for invalid sessions."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <WorkflowPageHeader
        title={vm.session?.title ?? "Collaboration Session"}
        subtitle={
          vm.session ? `${vm.session.createdAt} · ${vm.session.id}` : sessionId ? `Unknown session id: ${sessionId}` : "Unknown session id."
        }
        backHref="/collaboration"
        backLabel="Back to sessions"
        right={vm.session ? <WorkflowBadge>{vm.session.status}</WorkflowBadge> : <WorkflowBadge>UNKNOWN</WorkflowBadge>}
      />

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
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

      {/* Discussion-first: wider column, outputs support the thread */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)", gap: 16, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>
              Discussion
            </div>
            <DiscussionInput
              onAdd={(item) => {
                const now = new Date();
                const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
                  now.getHours()
                ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                setDiscussion((prev) => [{ id: `d-${prev.length + 1}`, at, ...item }, ...prev]);
              }}
            />
            <div style={{ marginTop: 12 }}>
              <DiscussionTimeline items={discussion} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>
              Workspace actions
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton label="회의록 작성" onClick={() => void runAction("GENERATE_MINUTES")} />
              <WorkflowActionButton label="분석 요청" onClick={() => void runAction("REQUEST_ANALYSIS")} />
              <WorkflowActionButton label="아이디어 요청" onClick={() => void runAction("REQUEST_IDEAS")} />
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginTop: 8 }}>
              Buttons call the collaboration generation API; the server uses a mock stub today. The right column shows official vs supporting outputs for this
              session.
            </div>
          </div>

          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Action feedback</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
              Status, timing, and optional JSON preview for the last run. After success, read the workspace note to see whether official outputs or only
              supporting insights changed.
            </div>
            <ActionResultPanel result={actionState.latest} workspaceImpact={workspaceImpact} />
          </WorkflowCard>
        </div>

        <CollaborationWorkspaceAside
          displayedMinutes={displayedMinutes}
          displayedFeatures={displayedFeatures}
          displayedAnalysis={displayedAnalysis}
          displayedIdeas={displayedIdeas}
          suggestedFeaturesFromIdeas={suggestedFeaturesFromIdeas}
        />
      </div>
    </div>
  );
}
