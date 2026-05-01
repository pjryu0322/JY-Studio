"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState, InlineAlert, LoadingState } from "@/components/ui";
import { PrototypePreviewPanel } from "@/components/preview/PrototypePreviewPanel";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { fetchProjectById } from "@/components/project-spec/api";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function ExecutionPageClient() {
  const search = useSearchParams();
  const projectId = search?.get("projectId")?.trim() ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [requirementsStateJson, setRequirementsStateJson] = useState<unknown>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const r = await fetchProjectById(projectId);
        if (cancelled) return;
        if (!r.project) {
          setError(r.errorMessage ?? "프로젝트 정보를 불러오지 못했습니다.");
          return;
        }
        setProjectName(String(r.project.name ?? ""));
        setProjectDescription(String(r.project.description ?? ""));
        setRequirementsStateJson(r.project.requirementsStateJson ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const derived = useMemo(() => {
    const s = parseRequirementsStateJson(requirementsStateJson);
    const ideationAssets = (s.deliverableAssets ?? []).map((a) => ({ type: a.type, title: a.title, content: a.content }));
    const flow = s.serviceFlowV1;
    const actors = (flow?.actors ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      description: a.description ?? null,
    }));
    const flowSteps = (flow?.steps ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((st) => ({
        id: st.id,
        title: st.title,
        purpose: st.purpose,
        primaryActorId: st.primaryActorId,
        secondaryActorIds: [],
      }));
    return { ideationAssets, actors, flowSteps };
  }, [requirementsStateJson]);

  return (
    <WorkflowStageChrome
      title={null}
      subtitle={undefined}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 14,
          boxSizing: "border-box",
        }}
      >
        {!projectId ? (
          <EmptyState title="프로젝트가 지정되지 않았습니다." description="URL에 ?projectId= 를 붙여 다시 열어 주세요." />
        ) : loading ? (
          <LoadingState />
        ) : error ? (
          <InlineAlert variant="danger">{error}</InlineAlert>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <PrototypePreviewPanel
              key={projectId}
              projectId={projectId}
              projectName={projectName || "프로젝트"}
              projectDescription={projectDescription}
              requirementsStateJson={requirementsStateJson}
              ideationAssets={derived.ideationAssets}
              actors={derived.actors}
              flowSteps={derived.flowSteps}
              featureDraftTitles={[]}
              checklistGapLabels={[]}
              designFingerprint={`${projectId}:${derived.actors.length}:${derived.flowSteps.length}:${derived.ideationAssets.length}`}
            />
          </div>
        )}
      </div>
    </WorkflowStageChrome>
  );
}

