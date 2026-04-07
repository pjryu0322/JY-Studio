"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
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
              Suggested next step: open the latest session and create minutes → derive features.
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
        <MeetingMinutesPanel minutes={vm.minutes} emptyLabel="No meeting minutes available" />
      ) : null}

      {tab === "features" ? (
        <FeatureSummaryPanel features={vm.features} emptyLabel="No derived features available" />
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

