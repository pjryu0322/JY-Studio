"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchProjectTaskDrafts,
  patchProjectTaskDraft,
  postProjectTaskDraftsGenerate,
} from "@/components/project-spec/api";
import { formatTestedAt } from "@/components/project-spec/format";
import type { TaskDraftDto, TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import { WORKSPACE_SECTION_META } from "@/components/project-spec/workspaceSectionMeta";
import type { SpecWorkspaceAiModelId } from "@/lib/project-spec/specWorkspaceModels";
import { parseRequirementDescriptionMeta } from "@/lib/project-spec/requirementDraftMeta";
import { synthesizeWorkflowDrafts } from "@/lib/project-spec/workflowDraftSynthesis";
import { nodeTypeFromTitle, stageForNodeType, type TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";

function uniqueStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const v = String(x ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function isNonFunctionalRequirementDraft(d: TaskDraftDto): boolean {
  const nt = (d.nodeType ?? nodeTypeFromTitle(d.title)) as TaskNodeType;
  if (nt !== "requirement") return false;
  const { requirementType } = parseRequirementDescriptionMeta(d.description);
  return requirementType === "NON_FUNCTIONAL";
}

function nfrRequirementRootIdsFromDrafts(drafts: TaskDraftDto[]): Set<string> {
  const s = new Set<string>();
  for (const d of drafts) {
    if (isNonFunctionalRequirementDraft(d)) s.add(d.id);
  }
  return s;
}

function hasNfrRequirementUpstream(
  id: string,
  depsById: Map<string, string[]>,
  nfrRoots: Set<string>,
  memo: Map<string, boolean>
): boolean {
  const c = memo.get(id);
  if (c !== undefined) return c;
  for (const dep of depsById.get(id) ?? []) {
    if (nfrRoots.has(dep)) {
      memo.set(id, true);
      return true;
    }
    if (hasNfrRequirementUpstream(dep, depsById, nfrRoots, memo)) {
      memo.set(id, true);
      return true;
    }
  }
  memo.set(id, false);
  return false;
}

function isDraftInNfrExecutionBranch(
  d: TaskDraftDto,
  nfrRoots: Set<string>,
  depsById: Map<string, string[]>
): boolean {
  if (nfrRoots.size === 0) return false;
  if (nfrRoots.has(d.id)) return true;
  return hasNfrRequirementUpstream(d.id, depsById, nfrRoots, new Map());
}

const EXECUTION_STAGE_ORDER = ["Requirement", "Design", "Development"] as const;
type ExecutionStage = (typeof EXECUTION_STAGE_ORDER)[number];

function stageLabel(stage: ExecutionStage): string {
  const labels: Record<ExecutionStage, string> = {
    Requirement: "요구",
    Design: "설계",
    Development: "개발",
  };
  return labels[stage];
}

function toExecutionStage(raw: string | null | undefined): ExecutionStage | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "requirement" || v === "요구" || v === "planning") return "Requirement";
  if (v === "design" || v === "설계" || v === "feature") return "Design";
  if (v === "development" || v === "개발" || v === "build" || v === "task") return "Development";
  return null;
}

function laneForTaskDraft(d: TaskDraftDto): ExecutionStage {
  const nt = (d.nodeType ?? nodeTypeFromTitle(d.title)) as TaskNodeType;
  if (nt === "task") return "Development";
  const ex = toExecutionStage(d.stage);
  if (ex) return ex;
  return stageForNodeType(nt);
}

function pickFocusStage(viewGroups: Map<ExecutionStage, TaskDraftDto[]>): ExecutionStage | null {
  for (const st of EXECUTION_STAGE_ORDER) {
    const rows = viewGroups.get(st) ?? [];
    if (rows.some((d) => d.status !== "CONFIRMED")) return st;
  }
  for (const st of EXECUTION_STAGE_ORDER) {
    const rows = viewGroups.get(st) ?? [];
    if (rows.length > 0) return st;
  }
  return null;
}

type CycleHit = { edge: { source: string; target: string }; cyclePath: string[] } | null;

function detectCycle(nodes: string[], depsById: Map<string, string[]>): CycleHit {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string | null>();

  const dfs = (id: string): CycleHit => {
    visited.add(id);
    inStack.add(id);
    for (const dep of depsById.get(id) ?? []) {
      if (!visited.has(dep)) {
        parent.set(dep, id);
        const hit = dfs(dep);
        if (hit) return hit;
      } else if (inStack.has(dep)) {
        const path: string[] = [dep];
        let cur: string | null = id;
        while (cur && cur !== dep) {
          path.push(cur);
          cur = parent.get(cur) ?? null;
        }
        path.push(dep);
        path.reverse();
        return { edge: { source: dep, target: id }, cyclePath: path };
      }
    }
    inStack.delete(id);
    return null;
  };

  for (const id of nodes) {
    if (!visited.has(id)) {
      parent.set(id, null);
      const hit = dfs(id);
      if (hit) return hit;
    }
  }
  return null;
}

const EXECUTION_STEPS_UI = [
  { key: "prep", label: "준비" },
  { key: "run", label: "실행 중" },
  { key: "git", label: "Git 반영" },
  { key: "review", label: "리뷰" },
] as const;

type TaskDraftPanelProps = {
  projectId: string;
  canEdit: boolean;
  selectedModel: SpecWorkspaceAiModelId;
  currentSpecVersionId: string | null;
  refreshKey: number;
  lastAutoSync: TaskDraftSyncResultDto | null;
};

export function TaskDraftPanel({
  projectId,
  canEdit,
  selectedModel,
  currentSpecVersionId,
  refreshKey,
  lastAutoSync,
}: TaskDraftPanelProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<TaskDraftDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [includeNfrInTaskPipeline, setIncludeNfrInTaskPipeline] = useState(false);
  const [includeNfrInWorkflowView, setIncludeNfrInWorkflowView] = useState(false);
  const autoWireRanRef = useRef(false);

  const loadDrafts = useCallback(
    async (opts?: { clearMessage?: boolean }) => {
      if (!projectId) return;
      const clearMessage = opts?.clearMessage !== false;
      if (clearMessage) setMessage(null);
      setLoading(true);
      try {
        const { res, json } = await fetchProjectTaskDrafts(projectId);
        if (!res.ok || !json.success || !json.data) {
          setMessage(json.message || "Task 초안을 불러오지 못했습니다.");
          setDrafts([]);
          return;
        }
        setDrafts(json.data);
      } catch (e) {
        console.error(e);
        setMessage("Task 초안 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshKey]);

  useEffect(() => {
    autoWireRanRef.current = false;
  }, [projectId]);

  const byId = useMemo(() => {
    const m = new Map<string, TaskDraftDto>();
    for (const d of drafts) m.set(d.id, d);
    return m;
  }, [drafts]);

  const depsById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of drafts) {
      m.set(d.id, uniqueStrings(d.dependsOnIds ?? []).filter((x) => x !== d.id));
    }
    return m;
  }, [drafts]);

  const confirmedIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of drafts) {
      if (d.status === "CONFIRMED") s.add(d.id);
    }
    return s;
  }, [drafts]);

  const nfrRequirementRootIds = useMemo(() => nfrRequirementRootIdsFromDrafts(drafts), [drafts]);

  const draftsForWorkflowView = useMemo(() => {
    if (includeNfrInWorkflowView || nfrRequirementRootIds.size === 0) {
      return drafts;
    }
    return drafts.filter((d) => !isDraftInNfrExecutionBranch(d, nfrRequirementRootIds, depsById));
  }, [drafts, depsById, includeNfrInWorkflowView, nfrRequirementRootIds]);

  const nfrBranchDraftsListed = useMemo(() => {
    if (includeNfrInWorkflowView || nfrRequirementRootIds.size === 0) return [];
    const seen = new Set<string>();
    const out: TaskDraftDto[] = [];
    for (const d of drafts) {
      if (!isDraftInNfrExecutionBranch(d, nfrRequirementRootIds, depsById)) continue;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push(d);
    }
    out.sort((a, b) => a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id));
    return out;
  }, [drafts, depsById, includeNfrInWorkflowView, nfrRequirementRootIds]);

  const validationScopeDrafts = useMemo(
    () => drafts.filter((d) => d.status === "DRAFT" || d.status === "CONFIRMED"),
    [drafts]
  );

  const validation = useMemo(() => {
    const byVal = new Map(validationScopeDrafts.map((d) => [d.id, d] as const));
    const depsVal = new Map<string, string[]>();
    for (const d of validationScopeDrafts) {
      depsVal.set(d.id, uniqueStrings(d.dependsOnIds ?? []).filter((x) => x !== d.id));
    }
    const allIds = validationScopeDrafts.map((d) => d.id);
    const missingDepEdges: Array<{ targetId: string; missingId: string }> = [];
    for (const d of validationScopeDrafts) {
      for (const dep of depsVal.get(d.id) ?? []) {
        if (!byVal.has(dep)) {
          missingDepEdges.push({ targetId: d.id, missingId: dep });
        }
      }
    }
    const cycle = detectCycle(allIds, depsVal);
    return { ok: !cycle && missingDepEdges.length === 0, cycle, missingDepEdges };
  }, [validationScopeDrafts]);

  const workflowStatusById = useMemo(() => {
    const m = new Map<string, "CONFIRMED" | "READY" | "BLOCKED" | "INVALID">();
    for (const d of drafts) {
      if (d.status === "CONFIRMED") {
        m.set(d.id, "CONFIRMED");
        continue;
      }
      const deps = depsById.get(d.id) ?? [];
      const hasMissing = deps.some((x) => !byId.has(x));
      if (hasMissing) {
        m.set(d.id, "INVALID");
        continue;
      }
      const ready = deps.length === 0 || deps.every((x) => confirmedIds.has(x));
      m.set(d.id, ready ? "READY" : "BLOCKED");
    }
    return m;
  }, [byId, confirmedIds, depsById, drafts]);

  const groupedByExecutionStageView = useMemo(() => {
    const groups = new Map<ExecutionStage, TaskDraftDto[]>();
    for (const s of EXECUTION_STAGE_ORDER) groups.set(s, []);
    for (const d of draftsForWorkflowView) {
      groups.get(laneForTaskDraft(d))!.push(d);
    }
    for (const s of EXECUTION_STAGE_ORDER) {
      groups.get(s)!.sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === "CONFIRMED") return -1;
          if (b.status === "CONFIRMED") return 1;
        }
        const px = (a.positionX ?? 0) - (b.positionX ?? 0);
        if (px !== 0) return px;
        return a.createdAt.localeCompare(b.createdAt);
      });
    }
    return groups;
  }, [draftsForWorkflowView]);

  const focusStage = useMemo(
    () => pickFocusStage(groupedByExecutionStageView),
    [groupedByExecutionStageView]
  );

  const readyExecutableDrafts = useMemo(() => {
    return draftsForWorkflowView.filter((d) => {
      if (d.status !== "DRAFT") return false;
      const nt = (d.nodeType ?? nodeTypeFromTitle(d.title)) as TaskNodeType;
      if (nt !== "task") return false;
      return workflowStatusById.get(d.id) === "READY";
    });
  }, [draftsForWorkflowView, workflowStatusById]);

  const primaryExecutableTask = useMemo((): TaskDraftDto | null => {
    if (readyExecutableDrafts.length === 0) return null;
    if (focusStage) {
      const inStage = readyExecutableDrafts.filter((d) => laneForTaskDraft(d) === focusStage);
      if (inStage.length > 0) return inStage[0]!;
    }
    return readyExecutableDrafts[0]!;
  }, [focusStage, readyExecutableDrafts]);

  const specVersionNumberMax = useMemo(() => {
    let m = 0;
    for (const d of drafts) {
      const n = d.specVersionNumber;
      if (typeof n === "number" && n > m) m = n;
    }
    return m;
  }, [drafts]);

  const lastDraftActivityAt = useMemo(() => {
    if (!drafts.length) return null as string | null;
    let max = "";
    for (const d of drafts) {
      const t = d.updatedAt || d.createdAt;
      if (t > max) max = t;
    }
    return max || null;
  }, [drafts]);

  const shouldAutoWire = useMemo(() => {
    if (autoWireRanRef.current) return false;
    const draftOnly = drafts.filter((d) => d.status === "DRAFT");
    if (draftOnly.length < 2) return false;
    const allEmpty = draftOnly.every((d) => (d.dependsOnIds ?? []).length === 0);
    if (allEmpty) return true;
    const draftIds = new Set(draftOnly.map((d) => d.id));
    let draftDraftEdgeCount = 0;
    for (const d of draftOnly) {
      for (const dep of d.dependsOnIds ?? []) {
        if (draftIds.has(dep)) draftDraftEdgeCount++;
      }
    }
    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    const allIds = draftOnly.map((d) => d.id);
    for (const id of allIds) {
      incomingCount.set(id, 0);
      outgoingCount.set(id, 0);
    }
    for (const d of draftOnly) {
      const deps = uniqueStrings(d.dependsOnIds ?? []).filter((x) => x !== d.id);
      outgoingCount.set(d.id, deps.length);
      for (const dep of deps) {
        if (incomingCount.has(dep)) incomingCount.set(dep, (incomingCount.get(dep) ?? 0) + 1);
      }
    }
    const isolatedDraftCount = allIds.filter(
      (id) => (incomingCount.get(id) ?? 0) === 0 && (outgoingCount.get(id) ?? 0) === 0
    ).length;
    if (draftDraftEdgeCount === 0) return true;
    if (isolatedDraftCount >= 2) return true;
    return false;
  }, [drafts]);

  const persistSynthesizedDrafts = useCallback(
    async (draftOnly: TaskDraftDto[], synthesized: ReturnType<typeof synthesizeWorkflowDrafts>) => {
      const synById = new Map(synthesized.map((x) => [x.id, x] as const));
      for (const d of draftOnly) {
        const s = synById.get(d.id);
        if (!s) continue;
        await patchProjectTaskDraft(projectId, d.id, {
          dependsOnIds: s.dependsOnIds,
          positionX: s.positionX,
          positionY: s.positionY,
          stage: s.stage,
          dependsOn: [],
        });
      }
    },
    [projectId]
  );

  const runSynthesizeDefaultFlow = useCallback(async () => {
    if (!projectId || !canEdit) return;
    const draftOnly = drafts.filter((d) => d.status === "DRAFT");
    if (draftOnly.length < 2) return;
    setBusy("auto-wire");
    try {
      const synthesized = synthesizeWorkflowDrafts(
        draftOnly.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          priority: d.priority,
          stage: d.stage,
          createdAt: d.createdAt,
          dependsOnIds: d.dependsOnIds,
        }))
      );
      await persistSynthesizedDrafts(draftOnly, synthesized);
      await loadDrafts({ clearMessage: false });
    } catch (e) {
      console.error(e);
      setMessage("기본 워크플로를 구성하는 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }, [canEdit, drafts, loadDrafts, persistSynthesizedDrafts, projectId]);

  useEffect(() => {
    if (!canEdit || !projectId) return;
    if (!shouldAutoWire) return;
    autoWireRanRef.current = true;
    void runSynthesizeDefaultFlow();
  }, [canEdit, projectId, runSynthesizeDefaultFlow, shouldAutoWire]);

  async function handleRegenerate() {
    if (!projectId || !canEdit) return;
    setBusy("regen");
    setMessage(null);
    try {
      const { res, json } = await postProjectTaskDraftsGenerate(projectId, {
        model: selectedModel,
        mode: "regenerate",
        includeNonFunctionalRequirements: includeNfrInTaskPipeline,
      });
      if (!res.ok || !json.success) {
        setMessage(json.message || "Task 초안 재생성에 실패했습니다.");
        return;
      }
      setMessage(json.message ?? null);
      await loadDrafts({ clearMessage: false });
    } catch (e) {
      console.error(e);
      setMessage("Task 초안 재생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  const goExecute = useCallback(() => {
    const path = `/projects/${encodeURIComponent(projectId)}#task-next-execution-panel`;
    router.push(path);
  }, [projectId, router]);

  const nextTaskTitle = primaryExecutableTask?.title?.trim() || null;

  const stepUi = useMemo(() => {
    const states: Array<"done" | "running" | "pending"> = ["pending", "pending", "pending", "pending"];
    if (!currentSpecVersionId) {
      states[0] = "running";
      return states;
    }
    if (!drafts.length) {
      states[0] = "running";
      return states;
    }
    if (primaryExecutableTask) {
      states[0] = "done";
      states[1] = "running";
      return states;
    }
    if (drafts.some((d) => d.status === "DRAFT")) {
      states[0] = "running";
    } else {
      states[0] = "done";
      states[1] = "done";
      states[2] = "done";
      states[3] = "done";
    }
    return states;
  }, [currentSpecVersionId, drafts, primaryExecutableTask]);

  function stepIcon(s: "done" | "running" | "pending"): string {
    if (s === "done") return "✔";
    if (s === "running") return "⏳";
    return "·";
  }

  const execDisabled = !currentSpecVersionId || busy === "regen" || busy === "auto-wire";

  return (
    <div
      data-testid="task-draft-panel"
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 10,
        border: "1px solid #c4b5fd",
        background: "#faf5ff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <WorkspaceLabelBadge section="taskDrafts" />
        <div style={{ flex: "1 1 220px" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#1e1b4b" }}>
            {WORKSPACE_SECTION_META.taskDrafts.title}
          </h3>
        </div>
      </div>

      <div
        data-testid="task-draft-workflow-summary"
        style={{
          marginBottom: 12,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #ddd6fe",
          background: "#fff",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>실행 워크플로</div>

        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.45 }}>
          현재 단계:{" "}
          <span style={{ color: focusStage ? "#0d9488" : "#b45309" }}>
            {focusStage ? stageLabel(focusStage) : loading ? "불러오는 중…" : "—"}
          </span>
          <span style={{ fontWeight: 600, color: "#64748b" }}> (요구 / 설계 / 개발)</span>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 6 }}>
            다음 작업
          </div>
          {loading ? (
            <div style={{ fontSize: 15, color: "#64748b" }}>불러오는 중…</div>
          ) : nextTaskTitle ? (
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{nextTaskTitle}</div>
          ) : (
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
              실행 가능한 다음 Task가 없습니다. 초안을 생성·확정하거나 프로젝트 실행 화면에서 상태를 확인하세요.
            </div>
          )}
        </div>

        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: "0.05em", marginBottom: 8 }}>
            실행 상태
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {EXECUTION_STEPS_UI.map((step, i) => {
              const st = stepUi[i] ?? "pending";
              const isRunning = st === "running";
              return (
                <li
                  key={step.key}
                  style={{
                    fontSize: 14,
                    color: isRunning ? "#0f172a" : "#64748b",
                    fontWeight: isRunning ? 800 : 500,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ width: 22, textAlign: "center", flexShrink: 0 }} aria-hidden>
                    {stepIcon(st)}
                  </span>
                  <span>{step.label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            data-testid="task-draft-execute-start"
            disabled={execDisabled}
            onClick={() => goExecute()}
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              border: "1px solid #0f766e",
              background: execDisabled ? "#e2e8f0" : "#0d9488",
              color: execDisabled ? "#94a3b8" : "#fff",
              fontWeight: 900,
              fontSize: 15,
              cursor: execDisabled ? "not-allowed" : "pointer",
              boxShadow: execDisabled ? "none" : "0 2px 8px rgba(13,148,136,0.25)",
            }}
          >
            실행 시작
          </button>
          {canEdit ? (
            <button
              type="button"
              data-testid="task-draft-regenerate"
              disabled={busy === "regen" || busy === "auto-wire"}
              onClick={() => void handleRegenerate()}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #7c3aed",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: busy === "regen" || busy === "auto-wire" ? "wait" : "pointer",
              }}
            >
              {busy === "regen" ? "생성·확정 중…" : "AI로 Task 초안 다시 생성 및 전체 확정"}
            </button>
          ) : null}
          {!currentSpecVersionId ? (
            <span style={{ fontSize: 13, color: "#b45309", maxWidth: 360, lineHeight: 1.45 }}>
              Spec을 확정한 뒤 실행 시작을 사용할 수 있습니다.
            </span>
          ) : null}
        </div>
      </div>

      <details style={{ marginTop: 4 }}>
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
            color: "#334155",
            listStyle: "none",
          }}
        >
          상세 보기 ▾
        </summary>
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#fafafa",
            fontSize: 13,
            color: "#334155",
            lineHeight: 1.55,
            display: "grid",
            gap: 12,
          }}
        >
          {message ? (
            <div role="status" style={{ color: "#334155" }}>
              <strong>알림</strong> · {message}
            </div>
          ) : null}

          {lastAutoSync ? (
            <div
              data-testid="task-draft-auto-sync-banner"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: lastAutoSync.ok ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${lastAutoSync.ok ? "#6ee7b7" : "#fecaca"}`,
                fontSize: 12,
                color: lastAutoSync.ok ? "#065f46" : "#991b1b",
              }}
            >
              {lastAutoSync.ok ? (
                <>
                  Spec 반영 · Task 초안 {lastAutoSync.createdCount ?? 0}개 생성
                  {typeof lastAutoSync.supersededCount === "number" && lastAutoSync.supersededCount > 0
                    ? ` · 이전 DRAFT ${lastAutoSync.supersededCount}개 정리됨`
                    : ""}
                </>
              ) : (
                <>
                  <strong>자동 생성 실패:</strong> {lastAutoSync.message ?? "알 수 없는 오류"}
                </>
              )}
            </div>
          ) : null}

          {!validation.ok && validationScopeDrafts.some((d) => d.status === "DRAFT") ? (
            <div style={{ color: "#92400e" }}>
              <strong>워크플로 오류</strong>
              {validation.cycle ? (
                <div style={{ marginTop: 6 }}>
                  순환: {validation.cycle.cyclePath.slice(0, 10).join(" → ")}
                </div>
              ) : null}
              {validation.missingDepEdges.length > 0 ? (
                <div style={{ marginTop: 6 }}>누락된 선행 참조 {validation.missingDepEdges.length}개</div>
              ) : null}
            </div>
          ) : null}

          <div style={{ fontSize: 12, color: "#64748b" }}>
            <strong style={{ color: "#475569" }}>이력·메타</strong>
            <div style={{ marginTop: 4 }}>
              초안 {drafts.length}개 · Spec{" "}
              {currentSpecVersionId
                ? `v${specVersionNumberMax > 0 ? specVersionNumberMax : "…"}`
                : "미연결"}{" "}
              · 기능 중심 표시 {draftsForWorkflowView.length}개
              {lastDraftActivityAt ? ` · 갱신 ${formatTestedAt(lastDraftActivityAt)}` : ""}
            </div>
          </div>

          {nfrBranchDraftsListed.length > 0 && !includeNfrInWorkflowView ? (
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "#9a3412" }}>비기능 요구사항 (검토·검증)</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#57534e" }}>
                {nfrBranchDraftsListed.map((d) => {
                  const meta = parseRequirementDescriptionMeta(d.description);
                  const cat = meta.nfrCategory ?? "—";
                  return (
                    <li key={d.id} style={{ marginBottom: 4 }}>
                      {d.title}
                      {meta.requirementType === "NON_FUNCTIONAL" ? ` · nfr=${cat}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {canEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#475569" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  data-testid="task-draft-include-nfr-workflow-view"
                  checked={includeNfrInWorkflowView}
                  onChange={(e) => setIncludeNfrInWorkflowView(e.target.checked)}
                />
                비기능 요구사항 포함 (다음 작업 후보에 반영)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  data-testid="task-draft-include-nfr-pipeline"
                  checked={includeNfrInTaskPipeline}
                  onChange={(e) => setIncludeNfrInTaskPipeline(e.target.checked)}
                />
                비기능 요구를 Task 파이프에 포함 (AI 재생성 시)
              </label>
            </div>
          ) : null}

          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            실행 로그·실행 이력은 프로젝트 화면의 「상세 보기」에서 확인할 수 있습니다.
          </p>
        </div>
      </details>
    </div>
  );
}
