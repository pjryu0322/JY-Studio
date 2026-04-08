"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  resolveSessionMinutes,
  resolveSessionOfficialFeatures,
  sessionHasMinutesOverride,
  sessionHasOfficialFeaturesOverride,
} from "@/lib/workflow/collaborationSessionResultStore";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";
import { WorkflowTabs } from "@/components/workflow/WorkflowTabs";
import { FeatureSummaryPanel } from "@/components/workflow/FeatureSummaryPanel";
import { MeetingMinutesPanel } from "@/components/workflow/MeetingMinutesPanel";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { getRequirementDetailView } from "@/lib/workflow/workflowViewModel";

type TabId = "overview" | "sessions" | "minutes" | "features" | "tasks";

export default function RequirementDetailPage() {
  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "sessions" as const, label: "Sessions" },
        { id: "minutes" as const, label: "Minutes" },
        { id: "features" as const, label: "Features" },
        { id: "tasks" as const, label: "Tasks" },
      ] satisfies { id: TabId; label: string }[],
    []
  );

  const params = useParams<{ id: string }>();
  const requirementId = typeof params?.id === "string" ? params.id : "";
  const vm = useMemo(() => getRequirementDetailView(requirementId), [requirementId]);
  const sessionResultsVersion = useCollaborationSessionResultsVersion();
  const latestSessionId = vm.latestSession?.id ?? null;

  const resolvedMinutes = useMemo(
    () => resolveSessionMinutes(latestSessionId, vm.minutes),
    [latestSessionId, vm.minutes, sessionResultsVersion]
  );

  const resolvedFeatures = useMemo(
    () => resolveSessionOfficialFeatures(latestSessionId, vm.features),
    [latestSessionId, vm.features, sessionResultsVersion]
  );

  const minutesFromCollaboration = useMemo(
    () => sessionHasMinutesOverride(latestSessionId),
    [latestSessionId, sessionResultsVersion]
  );

  const featuresFromCollaboration = useMemo(
    () => sessionHasOfficialFeaturesOverride(latestSessionId),
    [latestSessionId, sessionResultsVersion]
  );

  const search = useSearchParams();
  const router = useRouter();
  const tabRaw = (search?.get("tab") ?? "overview").toLowerCase();
  const tab = (tabs.some((t) => t.id === tabRaw) ? tabRaw : "overview") as TabId;

  const setTab = (next: TabId) => {
    router.replace(`/requirements/${encodeURIComponent(requirementId)}?tab=${encodeURIComponent(next)}`);
  };

  return (
    <div>
      <WorkflowPageHeader
        title={vm.requirement?.title ?? "Requirement"}
        subtitle={vm.requirement?.description ?? (requirementId ? `Unknown requirement id: ${requirementId}` : "Unknown requirement id.")}
        backHref="/requirements"
        backLabel="Back to list"
        right={
          vm.requirement ? (
            <WorkflowBadge>{vm.requirement.status}</WorkflowBadge>
          ) : (
            <WorkflowBadge>UNKNOWN</WorkflowBadge>
          )
        }
      />

      <div style={{ marginTop: 14 }}>
        <WorkflowCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
              <div>
                <strong style={{ color: "#111827" }}>{vm.requirement?.sessionCount ?? vm.sessions.length}</strong> sessions
              </div>
              <div>
                <strong style={{ color: "#111827" }}>{vm.requirement?.featureCount ?? vm.features.length}</strong> features
              </div>
              <div style={{ color: "#6b7280" }}>
                Next: Requirement → Session → Minutes → Features
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WorkflowActionButton
                label="Open latest session"
                onClick={() => {
                  if (!vm.latestSession) return;
                  router.push(`/collaboration/${encodeURIComponent(vm.latestSession.id)}`);
                }}
              />
              <WorkflowActionButton label="View latest minutes" onClick={() => setTab("minutes")} />
              <WorkflowActionButton label="View derived features" onClick={() => setTab("features")} />
            </div>
          </div>
        </WorkflowCard>
      </div>

      <WorkflowTabs
        ariaLabel="Requirement tabs"
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id)}
      />

      {tab === "overview" ? (
        vm.requirement ? (
          <WorkflowCard>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Overview</div>
            <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.6 }}>
              This is a UI skeleton. Next phase will bind real requirement data, sessions, minutes generation, and feature derivation.
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
              Suggested next step: open the latest session, run 회의록 작성, then Feature 생성 (official) to refresh Minutes and Features tabs here (in-memory).
            </div>
          </WorkflowCard>
        ) : (
          <WorkflowEmptyState title="Requirement not found" message="Please check the URL. This page will not show unrelated mock content." />
        )
      ) : null}

      {tab === "sessions" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Sessions</div>
          {vm.sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>No collaboration sessions available</div>
          ) : (
            vm.sessions.map((s) => (
              <div key={s.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {s.createdAt} · {s.status}
                    </div>
                  </div>
                  <Link
                    href={`/collaboration/${encodeURIComponent(s.id)}`}
                    style={{ fontSize: 13, textDecoration: "underline", alignSelf: "center" }}
                  >
                    Open workspace
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "minutes" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {vm.requirement && latestSessionId ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {minutesFromCollaboration ? (
                <>
                  <WorkflowBadge>Collaboration snapshot</WorkflowBadge>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    Latest session minutes reflect in-memory output from the collaboration workspace (mock stub; not persisted across reload).
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                  Minutes for the latest session from the view model. Open the session workspace and run 회의록 작성 to update what appears here until real
                  persistence ships.
                </span>
              )}
            </div>
          ) : null}
          <MeetingMinutesPanel minutes={resolvedMinutes} emptyLabel="No meeting minutes available" />
        </div>
      ) : null}

      {tab === "features" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {vm.requirement && latestSessionId ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {featuresFromCollaboration ? (
                <>
                  <WorkflowBadge>Collaboration snapshot</WorkflowBadge>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    Official derived features for the latest session come from Feature 생성 in the collaboration workspace (mock_stub; in-memory store — not
                    persisted across full reload). This is separate from 아이디어 요청 suggestions.
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                  Official features for the latest session from the view model. Open the session workspace and run Feature 생성 to replace this list in the
                  requirement view until persistence exists. Idea-based suggestions never appear here.
                </span>
              )}
            </div>
          ) : null}
          <FeatureSummaryPanel features={resolvedFeatures} emptyLabel="No derived features available" />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Tasks</div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            (placeholder) Tasks will be derived from Features in a later phase.
          </div>
        </div>
      ) : null}
    </div>
  );
}

