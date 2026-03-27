"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AiDraftCandidate,
  fetchSpecWorkspace,
  patchProjectSpecContext,
  postProjectPlanGenerate,
  postProjectPlanRevise,
  postSpecWorkspaceAction,
  type SpecWorkspaceSnapshot,
} from "@/components/project-spec/api";
import { ProjectSpecAiDraftPlanSection } from "@/components/project-spec/ProjectSpecAiDraftPlanSection";
import { TaskDraftPanel } from "@/components/project-spec/TaskDraftPanel";
import type { Project, ProjectSpecResponseRecord, TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { formatTestedAt } from "@/components/project-spec/format";
import { LabelTag } from "@/components/ui/LabelTag";
import { parseMarkdownToSections } from "@/lib/project-spec/parseMarkdownSections";
import {
  buildFallbackProjectPlanMarkdown,
  parseProjectPlanMarkdownToForm,
} from "@/lib/project-spec/parseProjectPlanMarkdown";
import {
  DEFAULT_SPEC_WORKSPACE_AI_MODEL,
  SPEC_WORKSPACE_AI_MODELS,
  SPEC_WORKSPACE_MODEL_LABELS,
  type SpecWorkspaceAiModelId,
} from "@/lib/project-spec/specWorkspaceModels";

/** 자동 초안 API 중복 호출 방지 (동시에 하나만) */
const specAutoDraftInFlightByProject = new Map<string, boolean>();
/** 자동 초안이 이미 성공한 프로젝트 (DB 저장 전에도 서버 스냅샷이 비어 재실행되는 것 방지) */
const specAutoDraftSucceededByProject = new Map<string, boolean>();

type ProjectSpecWorkspaceProps = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
  onProjectUpdated: (next: Project) => void;
};

type FormState = {
  name: string;
  description: string;
  projectType: string;
  specCoreGoals: string;
  specScopeIn: string;
  specScopeOut: string;
  specTargetUsers: string;
  specSuccessCriteria: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    projectType: "web-service",
    specCoreGoals: "",
    specScopeIn: "",
    specScopeOut: "",
    specTargetUsers: "",
    specSuccessCriteria: "",
  };
}

function readTaskDraftSyncFromPayload(data: unknown): TaskDraftSyncResultDto | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const d = data as { taskDraftSync?: TaskDraftSyncResultDto };
  return d.taskDraftSync ?? null;
}

function projectToForm(p: Project | null): FormState {
  if (!p) {
    return emptyForm();
  }
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    projectType: p.projectType || "web-service",
    specCoreGoals: p.specCoreGoals ?? "",
    specScopeIn: p.specScopeIn ?? "",
    specScopeOut: p.specScopeOut ?? "",
    specTargetUsers: p.specTargetUsers ?? "",
    specSuccessCriteria: p.specSuccessCriteria ?? "",
  };
}

export function ProjectSpecWorkspace({ projectId, project, canEdit, onProjectUpdated }: ProjectSpecWorkspaceProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [workspace, setWorkspace] = useState<SpecWorkspaceSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingWs, setLoadingWs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<SpecWorkspaceAiModelId>(DEFAULT_SPEC_WORKSPACE_AI_MODEL);
  const [planRevisionModel, setPlanRevisionModel] = useState<SpecWorkspaceAiModelId>(DEFAULT_SPEC_WORKSPACE_AI_MODEL);
  const [selectedModelsForPlan, setSelectedModelsForPlan] = useState<SpecWorkspaceAiModelId[]>([
    DEFAULT_SPEC_WORKSPACE_AI_MODEL,
  ]);
  const [planCandidates, setPlanCandidates] = useState<AiDraftCandidate[]>([]);
  const [planFailures, setPlanFailures] = useState<Array<{ modelId: string; message: string }>>([]);
  const [selectedPlanCandidateId, setSelectedPlanCandidateId] = useState<string | null>(null);
  const [workingDocument, setWorkingDocument] = useState("");
  const [lastSavedWorkingDocument, setLastSavedWorkingDocument] = useState("");
  const [planDocumentDirty, setPlanDocumentDirty] = useState(false);
  const [planRevisionSuggestion, setPlanRevisionSuggestion] = useState<{
    instruction: string;
    content: string;
    createdAt: string;
  } | null>(null);
  const [planRevisionInstruction, setPlanRevisionInstruction] = useState("");
  const planWorkspaceHydratedRef = useRef(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Record<string, "A" | "B">>({});
  const [versionCompareIds, setVersionCompareIds] = useState<string[]>([]);
  const [versionShowDiffOnly, setVersionShowDiffOnly] = useState(false);
  const [versionSelectedSections, setVersionSelectedSections] = useState<Record<string, "A" | "B">>({});
  const [specEditOpen, setSpecEditOpen] = useState(false);
  const [specDraftMarkdown, setSpecDraftMarkdown] = useState("");
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);
  const [lastTaskDraftSync, setLastTaskDraftSync] = useState<TaskDraftSyncResultDto | null>(null);
  const [generatingContext, setGeneratingContext] = useState(false);
  const isGeneratingRef = useRef(false);
  const prevProjectIdRef = useRef<string | null>(null);
  const formRefForAutoGuard = useRef(form);
  formRefForAutoGuard.current = form;

  useEffect(() => {
    const prev = prevProjectIdRef.current;
    if (prev && prev !== projectId) {
      specAutoDraftSucceededByProject.delete(prev);
    }
    prevProjectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    planWorkspaceHydratedRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!workspace && project) {
      setForm(projectToForm(project));
    }
  }, [project, workspace]);

  const loadWorkspace = useCallback(async () => {
    if (!projectId) {
      return;
    }
    setLoadingWs(true);
    setLoadError(null);
    try {
      const { res, json } = await fetchSpecWorkspace(projectId);
      if (!res.ok || !json.success || !json.data) {
        setLoadError(json.message || "워크스페이스를 불러오지 못했습니다.");
        setWorkspace(null);
        return;
      }
      setWorkspace({
        ...json.data,
        specVersions: json.data.specVersions ?? [],
      });
      const p = json.data.project;
      setForm({
        name: p.name,
        description: p.description ?? "",
        projectType: p.projectType,
        specCoreGoals: p.specCoreGoals ?? "",
        specScopeIn: p.specScopeIn ?? "",
        specScopeOut: p.specScopeOut ?? "",
        specTargetUsers: p.specTargetUsers ?? "",
        specSuccessCriteria: p.specSuccessCriteria ?? "",
      });
    } catch (e) {
      console.error(e);
      setLoadError("워크스페이스 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingWs(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!workspace || planWorkspaceHydratedRef.current) {
      return;
    }
    const slice = {
      specCoreGoals: form.specCoreGoals,
      specScopeIn: form.specScopeIn,
      specScopeOut: form.specScopeOut,
      specTargetUsers: form.specTargetUsers,
      specSuccessCriteria: form.specSuccessCriteria,
    };
    const hasAny =
      slice.specCoreGoals.trim() ||
      slice.specScopeIn.trim() ||
      slice.specScopeOut.trim() ||
      slice.specTargetUsers.trim() ||
      slice.specSuccessCriteria.trim();
    if (hasAny) {
      const md = buildFallbackProjectPlanMarkdown(slice);
      setWorkingDocument(md);
      setLastSavedWorkingDocument(md);
    }
    planWorkspaceHydratedRef.current = true;
  }, [
    workspace,
    form.specCoreGoals,
    form.specScopeIn,
    form.specScopeOut,
    form.specTargetUsers,
    form.specSuccessCriteria,
  ]);

  useEffect(() => {
    if (!lastTaskDraftSync) {
      return;
    }
    const t = setTimeout(() => setLastTaskDraftSync(null), 10_000);
    return () => clearTimeout(t);
  }, [lastTaskDraftSync]);

  const effectiveSpecSlice = useMemo(() => {
    if (workingDocument.trim()) {
      return parseProjectPlanMarkdownToForm(workingDocument);
    }
    return {
      specCoreGoals: form.specCoreGoals,
      specScopeIn: form.specScopeIn,
      specScopeOut: form.specScopeOut,
      specTargetUsers: form.specTargetUsers,
      specSuccessCriteria: form.specSuccessCriteria,
    };
  }, [form, workingDocument]);

  const confirmedId = workspace?.project.confirmedSpecResponseId ?? project?.confirmedSpecResponseId ?? null;

  const allSpecFieldsEmpty = useMemo(
    () =>
      !form.specCoreGoals.trim() &&
      !form.specScopeIn.trim() &&
      !form.specScopeOut.trim() &&
      !form.specTargetUsers.trim() &&
      !form.specSuccessCriteria.trim(),
    [form]
  );

  const baseInputsOk = useMemo(
    () => Boolean(form.name.trim() && form.description.trim() && form.projectType.trim()),
    [form.name, form.description, form.projectType]
  );

  const allSpecFieldsFilledForAi = useMemo(
    () =>
      Boolean(
        effectiveSpecSlice.specCoreGoals.trim() &&
          effectiveSpecSlice.specScopeIn.trim() &&
          effectiveSpecSlice.specScopeOut.trim() &&
          effectiveSpecSlice.specTargetUsers.trim() &&
          effectiveSpecSlice.specSuccessCriteria.trim()
      ),
    [effectiveSpecSlice]
  );

  const canRunAiProjectSpec = canEdit && baseInputsOk && allSpecFieldsFilledForAi;

  const serverSpecFieldsEmpty = useMemo(() => {
    if (!workspace?.project) {
      return false;
    }
    const p = workspace.project;
    return (
      !(p.specCoreGoals?.trim()) &&
      !(p.specScopeIn?.trim()) &&
      !(p.specScopeOut?.trim()) &&
      !(p.specTargetUsers?.trim()) &&
      !(p.specSuccessCriteria?.trim())
    );
  }, [workspace]);

  const serverBaseInputsOk = useMemo(() => {
    if (!workspace?.project) {
      return false;
    }
    const p = workspace.project;
    return Boolean(p.name?.trim() && (p.description ?? "").trim() && p.projectType?.trim());
  }, [workspace]);

  function mergeContextIntoProject(ctx: {
    name: string;
    description: string | null;
    projectType: string;
    coreGoals: string | null;
    inScope: string | null;
    outOfScope: string | null;
    targetUsers: string | null;
    successCriteria: string | null;
  }): void {
    if (!project) {
      return;
    }
    onProjectUpdated({
      ...project,
      name: ctx.name,
      description: ctx.description,
      projectType: ctx.projectType,
      specCoreGoals: ctx.coreGoals,
      specScopeIn: ctx.inScope,
      specScopeOut: ctx.outOfScope,
      specTargetUsers: ctx.targetUsers,
      specSuccessCriteria: ctx.successCriteria,
    });
  }

  function toggleCompareId(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length < 2) {
        return [...prev, id];
      }
      return [prev[0], id];
    });
    // 비교 모드가 바뀌면 섹션 선택/필터도 초기화합니다.
    setSelectedSections({});
    setShowDiffOnly(false);
  }

  function mergeWorkspaceProjectSlice(p: SpecWorkspaceSnapshot["project"]) {
    if (!project) {
      return;
    }
    onProjectUpdated({
      ...project,
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      projectType: p.projectType,
      specCoreGoals: p.specCoreGoals ?? null,
      specScopeIn: p.specScopeIn ?? null,
      specScopeOut: p.specScopeOut ?? null,
      specTargetUsers: p.specTargetUsers ?? null,
      specSuccessCriteria: p.specSuccessCriteria ?? null,
      confirmedSpecMarkdown: p.confirmedSpecMarkdown ?? null,
      confirmedSpecResponseId: p.confirmedSpecResponseId ?? null,
      confirmedSpecAt: p.confirmedSpecAt ?? null,
      currentSpecVersionId: p.currentSpecVersionId ?? null,
      status: project.status,
    });
  }

  function toggleVersionCompareId(vid: string) {
    setVersionCompareIds((prev) => {
      if (prev.includes(vid)) {
        return prev.filter((x) => x !== vid);
      }
      if (prev.length < 2) {
        return [...prev, vid];
      }
      return [prev[0], vid];
    });
    setVersionSelectedSections({});
    setVersionShowDiffOnly(false);
  }

  function specSourceLabel(t: string): string {
    const m: Record<string, string> = {
      RESPONSE: "응답 확정",
      MERGED_SECTIONS: "섹션 병합",
      MANUAL_EDIT: "직접 수정",
      AI_REFINE: "AI 개선",
      LEGACY_IMPORT: "이전 데이터",
    };
    return m[t] ?? t;
  }

  async function handleAppendManualSpec() {
    if (!projectId || !canEdit) {
      return;
    }
    const md = specDraftMarkdown.trim();
    if (!md) {
      setMessage("저장할 마크다운이 비어 있습니다.");
      return;
    }
    setActionBusy("append-manual");
    setMessage(null);
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "appendManualSpec", markdown: md });
      if (!res.ok || !json.success) {
        setMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      const data = json.data as { project?: SpecWorkspaceSnapshot["project"] } | undefined;
      if (data?.project && project) {
        onProjectUpdated({
          ...project,
          ...data.project,
          status: project.status,
        });
      }
      const sync = readTaskDraftSyncFromPayload(json.data);
      if (sync) {
        setLastTaskDraftSync(sync);
        setDraftRefreshKey((k) => k + 1);
      }
      setMessage("수정 내용을 새 버전으로 저장했습니다.");
      setSpecEditOpen(false);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRefineSpec() {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy("refine-spec");
    setMessage(null);
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "refineSpec", model: selectedModel });
      if (!res.ok || !json.success) {
        setMessage(json.message || "AI 개선에 실패했습니다.");
        return;
      }
      const data = json.data as { project?: SpecWorkspaceSnapshot["project"] } | undefined;
      if (data?.project && project) {
        onProjectUpdated({
          ...project,
          ...data.project,
          status: project.status,
        });
      }
      const sync = readTaskDraftSyncFromPayload(json.data);
      if (sync) {
        setLastTaskDraftSync(sync);
        setDraftRefreshKey((k) => k + 1);
      }
      setMessage("현재 스펙을 바탕으로 AI 개선본을 새 버전으로 저장했습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("AI 개선 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRollbackSpec(versionId: string) {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy(`rollback-${versionId}`);
    setMessage(null);
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "rollbackSpec", versionId });
      if (!res.ok || !json.success) {
        setMessage(json.message || "롤백에 실패했습니다.");
        return;
      }
      const data = json.data as { project?: SpecWorkspaceSnapshot["project"] } | undefined;
      if (data?.project && project) {
        onProjectUpdated({
          ...project,
          ...data.project,
          status: project.status,
        });
      }
      const sync = readTaskDraftSyncFromPayload(json.data);
      if (sync) {
        setLastTaskDraftSync(sync);
        setDraftRefreshKey((k) => k + 1);
      }
      setMessage("선택한 버전을 현재 활성 스펙으로 되돌렸습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("롤백 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSaveProjectInfo() {
    if (!projectId || !canEdit) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { res, json } = await patchProjectSpecContext({
        projectId,
        name: form.name.trim(),
        description: form.description.trim() ? form.description : null,
        projectType: form.projectType,
        coreGoals: effectiveSpecSlice.specCoreGoals.trim() || null,
        inScope: effectiveSpecSlice.specScopeIn.trim() || null,
        outOfScope: effectiveSpecSlice.specScopeOut.trim() || null,
        targetUsers: effectiveSpecSlice.specTargetUsers.trim() || null,
        successCriteria: effectiveSpecSlice.specSuccessCriteria.trim() || null,
      });
      if (!res.ok || !json.success || !json.data) {
        setMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      const ctx = json.data;
      setForm((prev) => ({
        ...prev,
        specCoreGoals: ctx.coreGoals ?? "",
        specScopeIn: ctx.inScope ?? "",
        specScopeOut: ctx.outOfScope ?? "",
        specTargetUsers: ctx.targetUsers ?? "",
        specSuccessCriteria: ctx.successCriteria ?? "",
      }));
      setLastSavedWorkingDocument(workingDocument);
      setPlanDocumentDirty(false);
      setMessage("프로젝트 정보가 저장되었습니다. 이후 「AI로 Project Spec 생성」에 사용됩니다.");
      mergeContextIntoProject(ctx);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const runSpecContextAiGeneration = useCallback(
    async (
      input: {
        name: string;
        description: string;
        projectType: string;
        successMessage: string;
        models?: SpecWorkspaceAiModelId[];
      },
      options?: { verifyFormSpecStillEmpty?: boolean }
    ): Promise<boolean> => {
      if (!projectId || !canEdit) {
        return false;
      }
      if (isGeneratingRef.current) {
        return false;
      }
      if (options?.verifyFormSpecStillEmpty) {
        const f = formRefForAutoGuard.current;
        const dirty =
          f.specCoreGoals.trim() ||
          f.specScopeIn.trim() ||
          f.specScopeOut.trim() ||
          f.specTargetUsers.trim() ||
          f.specSuccessCriteria.trim();
        if (dirty) {
          return false;
        }
      }
      isGeneratingRef.current = true;
      setGeneratingContext(true);
      setMessage(null);
      try {
        const models = input.models?.length ? input.models : (["gpt-4o-mini"] as SpecWorkspaceAiModelId[]);
        const { res, json } = await postProjectPlanGenerate({
          projectId,
          name: input.name.trim(),
          description: input.description.trim(),
          projectType: input.projectType.trim(),
          models,
        });
        if (!res.ok || !json.success || !json.data?.candidates?.length) {
          setMessage(json.message || "AI 실행 계획 초안 생성에 실패했습니다.");
          return false;
        }
        const candidates = json.data.candidates;
        const failures = json.data.failures ?? [];
        setPlanCandidates(candidates);
        setPlanFailures(failures);
        setPlanRevisionSuggestion(null);
        const first = candidates[0];
        setSelectedPlanCandidateId(first.id);
        setWorkingDocument(first.content);
        setLastSavedWorkingDocument(first.content);
        setPlanDocumentDirty(false);
        const parsed = parseProjectPlanMarkdownToForm(first.content);
        setForm((prev) => ({
          ...prev,
          ...parsed,
        }));
        setMessage(
          failures.length > 0
            ? `${input.successMessage} (일부 모델 실패 — 상단 메시지 참고)`
            : input.successMessage
        );
        return true;
      } catch (e) {
        console.error(e);
        setMessage("AI 실행 계획 초안 생성 중 오류가 발생했습니다.");
        return false;
      } finally {
        isGeneratingRef.current = false;
        setGeneratingContext(false);
      }
    },
    [projectId, canEdit]
  );

  useEffect(() => {
    if (!projectId || !canEdit) {
      return;
    }
    if (loadingWs || loadError || !workspace) {
      return;
    }
    if (!serverSpecFieldsEmpty || !serverBaseInputsOk) {
      return;
    }
    if (specAutoDraftSucceededByProject.get(projectId)) {
      return;
    }
    if (specAutoDraftInFlightByProject.get(projectId)) {
      return;
    }
    if (isGeneratingRef.current) {
      return;
    }

    let cancelled = false;
    specAutoDraftInFlightByProject.set(projectId, true);
    const p = workspace.project;

    void (async () => {
      const ok = await runSpecContextAiGeneration(
        {
          name: p.name,
          description: (p.description ?? "").trim(),
          projectType: p.projectType,
          successMessage: "AI 실행 계획 초안이 생성되었습니다",
          models: ["gpt-4o-mini"],
        },
        { verifyFormSpecStillEmpty: true }
      );
      if (!cancelled && ok) {
        specAutoDraftSucceededByProject.set(projectId, true);
      }
    })().finally(() => {
      specAutoDraftInFlightByProject.delete(projectId);
    });

    return () => {
      cancelled = true;
      specAutoDraftInFlightByProject.delete(projectId);
    };
  }, [
    projectId,
    canEdit,
    loadingWs,
    loadError,
    workspace,
    serverSpecFieldsEmpty,
    serverBaseInputsOk,
    runSpecContextAiGeneration,
  ]);

  function toggleModelForPlan(m: SpecWorkspaceAiModelId) {
    setSelectedModelsForPlan((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      if (next.length === 0) {
        return [DEFAULT_SPEC_WORKSPACE_AI_MODEL];
      }
      return next;
    });
  }

  async function handlePlanGenerate(mode: "initial" | "regenerate") {
    if (!projectId || !canEdit) {
      return;
    }
    if (!form.name.trim() || !form.description.trim() || !form.projectType.trim()) {
      setMessage("프로젝트명·설명·유형을 입력하세요.");
      return;
    }
    if (selectedModelsForPlan.length === 0) {
      setMessage("모델을 하나 이상 선택하세요.");
      return;
    }
    if (mode === "regenerate") {
      setPlanCandidates([]);
      setPlanFailures([]);
      setSelectedPlanCandidateId(null);
    }
    await runSpecContextAiGeneration({
      name: form.name.trim(),
      description: form.description.trim(),
      projectType: form.projectType,
      successMessage:
        mode === "initial"
          ? "실행 계획 초안이 생성되었습니다."
          : "실행 계획을 다시 생성했습니다. 검토 후 저장하세요.",
      models: selectedModelsForPlan,
    });
  }

  function handleSelectPlanCandidate(id: string) {
    if (
      planDocumentDirty &&
      workingDocument !== lastSavedWorkingDocument &&
      !window.confirm(
        "저장되지 않은 편집이 있습니다. 다른 후보로 바꾸면 편집 내용이 대체됩니다. 계속할까요?"
      )
    ) {
      return;
    }
    const c = planCandidates.find((x) => x.id === id);
    if (!c) {
      return;
    }
    setSelectedPlanCandidateId(id);
    setWorkingDocument(c.content);
    setLastSavedWorkingDocument(c.content);
    setPlanDocumentDirty(false);
    const parsed = parseProjectPlanMarkdownToForm(c.content);
    setForm((prev) => ({ ...prev, ...parsed }));
    setPlanRevisionSuggestion(null);
  }

  function handleWorkingDocumentChange(next: string) {
    setWorkingDocument(next);
    setPlanDocumentDirty(true);
  }

  async function handleRequestPlanRevision() {
    if (!projectId || !canEdit || !selectedPlanCandidateId || !workingDocument.trim()) {
      return;
    }
    setActionBusy("plan-revise");
    setMessage(null);
    try {
      const { res, json } = await postProjectPlanRevise({
        projectId,
        document: workingDocument,
        instruction: planRevisionInstruction,
        model: planRevisionModel,
      });
      if (!res.ok || !json.success || !json.data?.content) {
        setMessage(json.message || "AI 개선 제안에 실패했습니다.");
        return;
      }
      setPlanRevisionSuggestion({
        instruction: planRevisionInstruction,
        content: json.data.content,
        createdAt: new Date().toISOString(),
      });
      setMessage("AI 개선 제안을 받았습니다. 적용 또는 무시를 선택하세요.");
    } catch (e) {
      console.error(e);
      setMessage("AI 개선 제안 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  function handleApplyPlanRevision() {
    if (!planRevisionSuggestion) {
      return;
    }
    const nextDoc = planRevisionSuggestion.content;
    setWorkingDocument(nextDoc);
    setPlanDocumentDirty(true);
    setPlanRevisionSuggestion(null);
    const parsed = parseProjectPlanMarkdownToForm(nextDoc);
    setForm((prev) => ({ ...prev, ...parsed }));
  }

  function handleIgnorePlanRevision() {
    setPlanRevisionSuggestion(null);
  }

  async function handleAiProjectSpecGeneration() {
    if (!projectId || !canEdit) {
      return;
    }
    if (!canRunAiProjectSpec) {
      setMessage("프로젝트명·설명·유형과 Spec 필드(핵심 목표·범위·사용자·성공 기준)를 모두 채워 주세요.");
      return;
    }
    setActionBusy("ai-spec");
    setMessage("저장된 프로젝트 계획·Spec을 반영해 AI에 Project Spec 생성을 요청하는 중…");
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "aiRequest",
        model: selectedModel,
        saveContext: {
          name: form.name.trim(),
          description: form.description.trim() ? form.description : null,
          projectType: form.projectType,
          coreGoals: effectiveSpecSlice.specCoreGoals.trim() || null,
          inScope: effectiveSpecSlice.specScopeIn.trim() || null,
          outOfScope: effectiveSpecSlice.specScopeOut.trim() || null,
          targetUsers: effectiveSpecSlice.specTargetUsers.trim() || null,
          successCriteria: effectiveSpecSlice.specSuccessCriteria.trim() || null,
        },
      });
      if (!res.ok || !json.success) {
        setMessage(json.message || "AI Spec 생성에 실패했습니다.");
        return;
      }
      const data = json.data as {
        project?: SpecWorkspaceSnapshot["project"];
      };
      if (data.project) {
        mergeWorkspaceProjectSlice(data.project);
      }
      setMessage("AI Spec 초안이 응답 목록에 추가되었습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("AI Spec 생성 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConfirm(response: ProjectSpecResponseRecord) {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy(`confirm-${response.id}`);
    setMessage(null);
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "confirm",
        responseId: response.id,
      });
      if (!res.ok || !json.success || !json.data || typeof json.data !== "object") {
        setMessage(json.message || "확정에 실패했습니다.");
        return;
      }
      const data = json.data as { project?: SpecWorkspaceSnapshot["project"] };
      if (data.project && project) {
        onProjectUpdated({
          ...project,
          ...data.project,
          status: project.status,
        });
      }
      const sync = readTaskDraftSyncFromPayload(json.data);
      if (sync) {
        setLastTaskDraftSync(sync);
        setDraftRefreshKey((k) => k + 1);
      }
      setMessage("이 응답을 공식 Project Spec으로 확정했습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("확정 처리 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConfirmMerged(mergedMarkdown: string, responseAId: string, responseBId: string) {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy("confirm-merged");
    setMessage(null);
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "confirmMerged",
        responseAId,
        responseBId,
        mergedMarkdown,
        selectedSections,
      });
      if (!res.ok || !json.success) {
        setMessage((json as { message?: string }).message || "병합 확정에 실패했습니다.");
        return;
      }

      const data = json.data as { project?: SpecWorkspaceSnapshot["project"] } | undefined;
      if (data?.project && project) {
        onProjectUpdated({
          ...project,
          ...data.project,
          status: project.status,
        });
      }
      const sync = readTaskDraftSyncFromPayload(json.data);
      if (sync) {
        setLastTaskDraftSync(sync);
        setDraftRefreshKey((k) => k + 1);
      }
      setMessage("병합 결과를 공식 Project Spec으로 확정했습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("병합 확정 처리 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  if (!projectId) {
    return null;
  }

  const compareLeft = compareIds[0] ? workspace?.responses.find((r) => r.id === compareIds[0]) : undefined;
  const compareRight = compareIds[1] ? workspace?.responses.find((r) => r.id === compareIds[1]) : undefined;

  const specVersions = workspace?.specVersions ?? [];
  const compareVersionLeft = versionCompareIds[0]
    ? specVersions.find((v) => v.id === versionCompareIds[0])
    : undefined;
  const compareVersionRight = versionCompareIds[1]
    ? specVersions.find((v) => v.id === versionCompareIds[1])
    : undefined;

  return (
    <section
      id="guided-flow-spec-workspace"
      data-testid="project-spec-workspace"
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        background: "#fafbff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <LabelTag label="[F-1-3] Workspace — Project Spec definition (AI-first)" />
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Project Spec 정의 워크스페이스</h2>
      </div>
      <p style={{ margin: "0 0 16px 0", color: "#475569", lineHeight: 1.55, fontSize: 14 }}>
        프로젝트 기본 정보 → AI 실행 계획 초안 후보 비교 → 작업 문서 편집·저장 → 저장된 계획을 바탕으로 AI Project Spec 생성 →
        응답 비교·확정 → 아래 Task 초안 확인·확정 순으로 진행합니다. 프롬프트는 내부에서만 구성됩니다.
      </p>

      {loadError ? (
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>{loadError}</p>
      ) : null}
      {loadingWs && !workspace ? (
        <p style={{ color: "#64748b" }}>불러오는 중…</p>
      ) : null}

      {/* [A] 프로젝트 정보 */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <LabelTag label="[F-1-3-1] Workspace — Project Context" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>프로젝트 정보</h3>
        </div>

        {generatingContext ? (
          <p
            data-testid="spec-workspace-ai-context-loading"
            style={{
              margin: "0 0 12px 0",
              padding: "10px 12px",
              borderRadius: 8,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e40af",
              fontSize: 14,
            }}
            role="status"
          >
            AI가 실행 계획 문서 초안을 생성하고 있습니다...
          </p>
        ) : null}

        {baseInputsOk && allSpecFieldsEmpty && canEdit && !generatingContext ? (
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
            조건이 맞으면 AI가 먼저 실행 계획 전체 문서를 제안합니다. Spec 필드가 이미 채워져 있으면 자동 생성은 건너뜁니다.
          </p>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <LabelTag label="[F-1-3-1a] Workspace — Basic Project Fields" />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b" }}>기본 입력</p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>프로젝트명</span>
                <input
                  data-testid="spec-workspace-project-name"
                  value={form.name}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>프로젝트 설명</span>
                <textarea
                  data-testid="spec-workspace-project-description"
                  value={form.description}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>프로젝트 유형</span>
                <select
                  data-testid="spec-workspace-project-type"
                  value={form.projectType}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", maxWidth: 320 }}
                >
                  <option value="web-service">web-service</option>
                </select>
              </label>
            </div>
          </div>

          <ProjectSpecAiDraftPlanSection
            canEdit={canEdit}
            baseInputsOk={baseInputsOk}
            generatingContext={generatingContext}
            selectedModelsForPlan={selectedModelsForPlan}
            onToggleModel={toggleModelForPlan}
            onGenerate={(mode) => void handlePlanGenerate(mode)}
            planCandidates={planCandidates}
            planFailures={planFailures}
            selectedPlanCandidateId={selectedPlanCandidateId}
            onSelectCandidate={handleSelectPlanCandidate}
            workingDocument={workingDocument}
            onWorkingDocumentChange={handleWorkingDocumentChange}
            planDocumentDirty={planDocumentDirty}
            revisionModel={planRevisionModel}
            onRevisionModelChange={setPlanRevisionModel}
            revisionInstruction={planRevisionInstruction}
            onRevisionInstructionChange={setPlanRevisionInstruction}
            revisionSuggestion={planRevisionSuggestion}
            onRequestRevision={() => void handleRequestPlanRevision()}
            onApplyRevision={handleApplyPlanRevision}
            onIgnoreRevision={handleIgnorePlanRevision}
            revisionBusy={actionBusy === "plan-revise"}
          />

          {canEdit ? (
            <div style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                현재 작업 중인 프로젝트 계획 문서와 아래 필드를 기준으로 저장합니다. 저장된 내용은 다음 단계의 「AI로 Project
                Spec 생성」에 사용됩니다.
              </p>
              <button
                type="button"
                data-testid="spec-workspace-save-project"
                onClick={() => void handleSaveProjectInfo()}
                disabled={
                  saving ||
                  generatingContext ||
                  actionBusy === "ai-spec" ||
                  actionBusy === "plan-revise"
                }
                style={{
                  justifySelf: "start",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  cursor:
                    saving || generatingContext || actionBusy === "ai-spec" || actionBusy === "plan-revise"
                      ? "wait"
                      : "pointer",
                }}
              >
                {saving ? "저장 중…" : "프로젝트 정보 저장"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* [B] 저장된 계획 기반 Project Spec AI 생성 */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <LabelTag label="[F-1-3-2] Workspace — Project Spec from saved plan" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>저장된 계획으로 Project Spec 생성</h3>
        </div>

        <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          위에서 저장한 프로젝트 정보·실행 계획에서 추출한 Spec 필드를 바탕으로 AI가 Project Spec 초안을 만듭니다. 별도의
          프롬프트 확인·복사·갱신 없이 버튼 한 번으로 진행합니다.
        </p>

        <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>AI 모델</span>
          <select
            data-testid="spec-workspace-ai-model"
            value={selectedModel}
            disabled={!canEdit || actionBusy === "ai-spec" || generatingContext}
            onChange={(e) => setSelectedModel(e.target.value as SpecWorkspaceAiModelId)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 160 }}
          >
            {SPEC_WORKSPACE_AI_MODELS.map((m) => (
              <option key={m} value={m}>
                {SPEC_WORKSPACE_MODEL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            data-testid="spec-workspace-ai-request"
            onClick={() => void handleAiProjectSpecGeneration()}
            disabled={
              !canEdit ||
              actionBusy === "ai-spec" ||
              saving ||
              generatingContext ||
              !canRunAiProjectSpec
            }
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 700,
              cursor: canEdit && canRunAiProjectSpec ? "pointer" : "not-allowed",
            }}
          >
            {actionBusy === "ai-spec" ? "저장 후 AI 요청 중…" : "AI로 Project Spec 생성"}
          </button>
        </div>
        {canEdit && baseInputsOk && !allSpecFieldsFilledForAi ? (
          <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#b45309" }}>
            먼저 위 워크스페이스에서 핵심 목표·In/Out scope·대상 사용자·성공 기준을 모두 채우고 「프로젝트 정보 저장」을
            해 주세요.
          </p>
        ) : null}
        {actionBusy === "ai-spec" ? (
          <p
            data-testid="spec-workspace-ai-spec-progress"
            role="status"
            data-ui-label="[F-1-3-2-s2] Inline — Project Spec AI response request"
            style={{ margin: "10px 0 0 0", fontSize: 13, color: "#0f766e", fontWeight: 600 }}
          >
            저장된 계획을 반영해 AI에 Project Spec 응답을 요청하는 중…
          </p>
        ) : null}
      </div>

      {/* [C] AI 응답 목록 · 비교 */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <LabelTag label="[F-1-3-3] Workspace — AI responses & compare" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>AI 응답</h3>
        </div>
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#64748b" }}>
          응답 두 개를 「비교」로 선택하면 섹션 단위로 나란히 보이고, 차이 있는 섹션만 강조됩니다.
        </p>
        {actionBusy?.startsWith("confirm") ? (
          <p
            role="status"
            data-testid="spec-workspace-inline-confirm-spec"
            data-ui-label="[F-1-3-3-s] Inline — confirm / merge Project Spec"
            style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}
          >
            Project Spec 확정을 처리하는 중입니다. 완료되면 Task 초안이 자동으로 맞춰질 수 있습니다.
          </p>
        ) : null}

        {compareLeft && compareRight ? (
          <div
            data-testid="spec-workspace-compare-panel"
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 10,
              border: "2px solid #0ea5e9",
              background: "#f0f9ff",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>응답 비교</strong>
              <button
                type="button"
                data-testid="spec-workspace-compare-clear"
                onClick={() => {
                  setCompareIds([]);
                  setSelectedSections({});
                  setShowDiffOnly(false);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #0369a1",
                  background: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                비교 해제
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
                fontSize: 12,
                color: "#0c4a6e",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>응답 A</div>
                <div>모델: {compareLeft.model}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                  토큰: 입력 {compareLeft.promptTokens ?? "-"} / 출력 {compareLeft.completionTokens ?? "-"} / 총{" "}
                  {compareLeft.totalTokens ?? "-"}
                </div>
                <div>시간: {formatTestedAt(compareLeft.createdAt)}</div>
                <div>
                  ID: <code>{compareLeft.id.slice(0, 10)}…</code>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>응답 B</div>
                <div>모델: {compareRight.model}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                  토큰: 입력 {compareRight.promptTokens ?? "-"} / 출력 {compareRight.completionTokens ?? "-"} / 총{" "}
                  {compareRight.totalTokens ?? "-"}
                </div>
                <div>시간: {formatTestedAt(compareRight.createdAt)}</div>
                <div>
                  ID: <code>{compareRight.id.slice(0, 10)}…</code>
                </div>
              </div>
            </div>
            {(() => {
              const a = parseMarkdownToSections(compareLeft.responseMarkdown).sections;
              const b = parseMarkdownToSections(compareRight.responseMarkdown).sections;

              const mapA = new Map(a.map((s) => [s.key, s]));
              const mapB = new Map(b.map((s) => [s.key, s]));

              const orderedKeys = [
                ...a.map((s) => s.key),
                ...b
                  .map((s) => s.key)
                  .filter((k) => !mapA.has(k)),
              ];

              const items = orderedKeys.map((key) => {
                const secA = mapA.get(key);
                const secB = mapB.get(key);
                const title = secA?.title ?? secB?.title ?? key;
                const contentA = secA?.content ?? "";
                const contentB = secB?.content ?? "";
                const isDifferent = contentA.trim() !== contentB.trim();
                return { key, title, contentA, contentB, isDifferent };
              });

              const filtered = showDiffOnly ? items.filter((x) => x.isDifferent) : items;

              const adoptAll = (choice: "A" | "B") => {
                const next: Record<string, "A" | "B"> = {};
                for (const k of orderedKeys) {
                  next[k] = choice;
                }
                setSelectedSections(next);
              };

              const mergedMarkdown = orderedKeys
                .map((key) => {
                  const it = items.find((x) => x.key === key);
                  if (!it) return "";
                  const chosen = selectedSections[key] ?? "A";
                  const content = (chosen === "A" ? it.contentA : it.contentB).trim();
                  if (!content) {
                    return it.key === "preamble" ? "" : "";
                  }
                  if (it.key === "preamble") {
                    return content;
                  }
                  return `## ${it.title}\n\n${content}`;
                })
                .filter(Boolean)
                .join("\n\n");

              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#0c4a6e", fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={showDiffOnly}
                        onChange={(e) => setShowDiffOnly(e.target.checked)}
                      />
                      차이만 보기
                    </label>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        type="button"
                        data-testid="spec-workspace-compare-adopt-all-a"
                        onClick={() => adoptAll("A")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #0369a1",
                          background: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        응답 A 전체 채택
                      </button>
                      <button
                        type="button"
                        data-testid="spec-workspace-compare-adopt-all-b"
                        onClick={() => adoptAll("B")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #0369a1",
                          background: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        응답 B 전체 채택
                      </button>
                    </div>
                  </div>

                  {filtered.map((it) => {
                    const chosen = selectedSections[it.key] ?? "A";
                    return (
                      <div
                        key={it.key}
                        style={{
                          marginBottom: 14,
                          padding: 12,
                          borderRadius: 10,
                          border: "1px solid #93c5fd",
                          background: it.isDifferent ? "rgba(255, 200, 0, 0.15)" : "#fff",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 14,
                            color: "#0f172a",
                            padding: "8px 10px",
                            borderTop: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            marginBottom: 12,
                          }}
                        >
                          {it.title}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                            alignItems: "start",
                          }}
                        >
                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: chosen === "A" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                              color: "#0f172a",
                              lineHeight: 1.65,
                              fontSize: 13,
                              whiteSpace: "pre-wrap",
                              border: chosen === "A" ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                            }}
                          >
                            {it.contentA || "(없음)"}
                          </div>

                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: chosen === "B" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                              color: "#0f172a",
                              lineHeight: 1.65,
                              fontSize: 13,
                              whiteSpace: "pre-wrap",
                              border: chosen === "B" ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                            }}
                          >
                            {it.contentB || "(없음)"}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            data-testid={`spec-workspace-compare-adopt-${it.key}-a`}
                            onClick={() => setSelectedSections((prev) => ({ ...prev, [it.key]: "A" }))}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: chosen === "A" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                              background: chosen === "A" ? "#2563eb" : "#e2e8f0",
                              color: "#fff",
                              fontWeight: 900,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            [A 채택]
                          </button>
                          <button
                            type="button"
                            data-testid={`spec-workspace-compare-adopt-${it.key}-b`}
                            onClick={() => setSelectedSections((prev) => ({ ...prev, [it.key]: "B" }))}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: chosen === "B" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                              background: chosen === "B" ? "#2563eb" : "#e2e8f0",
                              color: "#fff",
                              fontWeight: 900,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            [B 채택]
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    style={{
                      marginTop: 10,
                      border: "1px solid rgba(59,130,246,0.35)",
                      borderRadius: 12,
                      background: "#eff6ff",
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>
                      병합 결과 미리보기
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: "#0f172a",
                        whiteSpace: "pre-wrap",
                        background: "#fff",
                        borderRadius: 10,
                        border: "1px solid #93c5fd",
                        padding: 12,
                        maxHeight: 240,
                        overflow: "auto",
                      }}
                      data-testid="spec-workspace-merged-preview"
                    >
                      {mergedMarkdown || "(선택된 섹션이 없습니다.)"}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        data-testid="spec-workspace-merged-confirm"
                        disabled={actionBusy === "confirm-merged"}
                        onClick={() => void handleConfirmMerged(mergedMarkdown, compareLeft.id, compareRight.id)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "1px solid #2563eb",
                          background: "#2563eb",
                          color: "#fff",
                          fontWeight: 900,
                          cursor: actionBusy === "confirm-merged" ? "wait" : "pointer",
                          fontSize: 13,
                          boxShadow: "0 2px 10px rgba(37,99,235,0.25)",
                        }}
                      >
                        {actionBusy === "confirm-merged" ? "확정 중…" : "이 내용으로 Project Spec 확정"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}

        {!workspace?.responses?.length ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            아직 응답이 없습니다. 위에서 계획을 저장한 뒤 「AI로 Project Spec 생성」을 실행하세요.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {workspace.responses.map((r) => {
              const selected = confirmedId === r.id;
              const expanded = expandedId === r.id;
              const inCompare = compareIds.includes(r.id);
              return (
                <li
                  key={r.id}
                  data-testid={`spec-workspace-response-${r.id}`}
                  style={{
                    borderRadius: 10,
                    border: inCompare ? "2px solid #0ea5e9" : selected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    padding: 12,
                    background: inCompare ? "#e0f2fe" : selected ? "#eff6ff" : "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 13, flex: "1 1 200px" }}>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        ID {r.id.slice(0, 12)}…
                      </div>
                      <strong>{formatTestedAt(r.createdAt)}</strong>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>
                        {r.provider} / {r.model}
                      </span>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        토큰: 입력 {r.promptTokens ?? "-"} / 출력 {r.completionTokens ?? "-"} / 총 {r.totalTokens ?? "-"}
                      </div>
                      {selected ? (
                        <span style={{ marginLeft: 8, color: "#1d4ed8", fontWeight: 800 }}>확정됨</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={inCompare}
                          onChange={() => toggleCompareId(r.id)}
                          aria-label={`비교에 포함: ${r.id.slice(0, 8)}`}
                        />
                        비교
                      </label>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {expanded ? "접기" : "상세"}
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          data-testid={`spec-workspace-confirm-${r.id}`}
                          onClick={() => void handleConfirm(r)}
                          disabled={actionBusy?.startsWith("confirm")}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: "2px solid #1d4ed8",
                            background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                            color: "#fff",
                            cursor: actionBusy?.startsWith("confirm") ? "wait" : "pointer",
                            fontSize: 13,
                            fontWeight: 800,
                            boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
                          }}
                        >
                          {actionBusy === `confirm-${r.id}` ? "…" : "이 응답으로 확정"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                    <pre
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: 12,
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-monospace, monospace",
                        color: "#334155",
                      }}
                    >
                      {r.responseMarkdown}
                    </pre>
                  ) : (
                    <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
                      {`${r.responseMarkdown.slice(0, 160)}${r.responseMarkdown.length > 160 ? "…" : ""}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* [D] 확정된 Project Spec (버전 append-only, 롤백은 활성 포인터만 이동) */}
      <div
        style={{
          padding: 16,
          borderRadius: 10,
          border: "1px solid #86efac",
          background: "#f0fdf4",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <LabelTag label="[F-1-3-4] Workspace — Confirmed spec & versions" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>확정된 Project Spec</h3>
        </div>
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
          확정 내용은 버전 행으로만 쌓이며 기존 버전은 수정·삭제되지 않습니다. 「현재」는 활성 포인터이며, 롤백은 과거 버전을 다시 가리킬
          뿐 이력을 지우지 않습니다.
        </p>
        {workspace?.project.confirmedSpecMarkdown ? (
          <>
            <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#166534" }}>
              활성 버전:{" "}
              {(() => {
                const curId = workspace.project.currentSpecVersionId;
                const row = curId ? specVersions.find((v) => v.id === curId) : undefined;
                return row ? `v${row.version}` : "(조회 중)";
              })()}
              {" · "}
              확정 시각(해당 버전 생성):{" "}
              {workspace.project.confirmedSpecAt ? formatTestedAt(workspace.project.confirmedSpecAt) : "-"}
            </p>
            {canEdit ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  data-testid="spec-workspace-spec-edit-toggle"
                  onClick={() => {
                    setSpecDraftMarkdown(workspace.project.confirmedSpecMarkdown ?? "");
                    setSpecEditOpen((o) => !o);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #15803d",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {specEditOpen ? "직접 수정 닫기" : "직접 수정"}
                </button>
                <button
                  type="button"
                  data-testid="spec-workspace-spec-ai-refine"
                  disabled={actionBusy === "refine-spec"}
                  onClick={() => void handleRefineSpec()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #15803d",
                    background: "#166534",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: actionBusy === "refine-spec" ? "wait" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {actionBusy === "refine-spec" ? "AI 개선 중…" : "AI로 개선 (현재 스펙 기준)"}
                </button>
              </div>
            ) : null}
            {actionBusy === "refine-spec" ? (
              <p
                role="status"
                data-ui-label="[F-1-3-4-s1] Inline — AI refine on confirmed spec"
                style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#14532d" }}
              >
                확정 Spec을 기준으로 AI 개선 응답을 받는 중입니다…
              </p>
            ) : null}
            {specEditOpen && canEdit ? (
              <div style={{ marginBottom: 12 }}>
                <textarea
                  data-testid="spec-workspace-spec-edit-textarea"
                  value={specDraftMarkdown}
                  onChange={(e) => setSpecDraftMarkdown(e.target.value)}
                  rows={14}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #86efac",
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    data-testid="spec-workspace-spec-save-new-version"
                    disabled={actionBusy === "append-manual"}
                    onClick={() => void handleAppendManualSpec()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #15803d",
                      background: "#22c55e",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: actionBusy === "append-manual" ? "wait" : "pointer",
                      fontSize: 13,
                    }}
                  >
                    {actionBusy === "append-manual" ? "저장 중…" : "새 버전으로 저장"}
                  </button>
                </div>
                {actionBusy === "append-manual" ? (
                  <p
                    role="status"
                    data-ui-label="[F-1-3-4-s2] Inline — manual spec version append"
                    style={{ margin: "10px 0 0 0", fontSize: 13, fontWeight: 600, color: "#14532d" }}
                  >
                    수정한 Spec을 새 버전으로 저장하는 중입니다…
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              data-testid="spec-workspace-confirmed-spec"
              style={{
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {workspace.project.confirmedSpecMarkdown}
              </pre>
            </div>

            {specVersions.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 800, color: "#14532d" }}>버전 이력</h4>
                {actionBusy?.startsWith("rollback-") ? (
                  <p
                    role="status"
                    data-ui-label="[F-1-3-4-s3] Inline — spec version rollback"
                    style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "#92400e" }}
                  >
                    활성 Spec 버전을 변경(롤백)하는 중입니다…
                  </p>
                ) : null}
                <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#166534" }}>
                  두 버전을 선택하면 아래에서 응답 비교와 동일한 섹션 비교 UI를 사용합니다.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                  {specVersions.map((v) => {
                    const isCurrent = v.id === workspace.project.currentSpecVersionId;
                    const inVCompare = versionCompareIds.includes(v.id);
                    return (
                      <li
                        key={v.id}
                        data-testid={`spec-workspace-spec-version-${v.version}`}
                        style={{
                          borderRadius: 8,
                          border: inVCompare ? "2px solid #0ea5e9" : "1px solid #bbf7d0",
                          padding: 10,
                          background: inVCompare ? "#e0f2fe" : "#fff",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <strong>v{v.version}</strong>
                            {isCurrent ? (
                              <span style={{ marginLeft: 8, color: "#15803d", fontWeight: 800 }}>현재</span>
                            ) : null}
                            <span style={{ marginLeft: 8, color: "#64748b" }}>{specSourceLabel(v.sourceType)}</span>
                            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                              {formatTestedAt(v.createdAt)}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={inVCompare}
                                onChange={() => toggleVersionCompareId(v.id)}
                                aria-label={`버전 비교 v${v.version}`}
                              />
                              비교
                            </label>
                            {canEdit && !isCurrent ? (
                              <button
                                type="button"
                                data-testid={`spec-workspace-spec-rollback-v${v.version}`}
                                disabled={actionBusy?.startsWith("rollback-")}
                                onClick={() => void handleRollbackSpec(v.id)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  border: "1px solid #b45309",
                                  background: "#fffbeb",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: actionBusy?.startsWith("rollback-") ? "wait" : "pointer",
                                }}
                              >
                                이 버전으로 롤백
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {compareVersionLeft && compareVersionRight ? (
              <div
                data-testid="spec-workspace-version-compare-panel"
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  border: "2px solid #0ea5e9",
                  background: "#f0f9ff",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <strong style={{ fontSize: 15 }}>버전 비교</strong>
                  <button
                    type="button"
                    data-testid="spec-workspace-version-compare-clear"
                    onClick={() => {
                      setVersionCompareIds([]);
                      setVersionSelectedSections({});
                      setVersionShowDiffOnly(false);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #0369a1",
                      background: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    비교 해제
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 14,
                    fontSize: 12,
                    color: "#0c4a6e",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>버전 A</div>
                    <div>v{compareVersionLeft.version}</div>
                    <div>{formatTestedAt(compareVersionLeft.createdAt)}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>버전 B</div>
                    <div>v{compareVersionRight.version}</div>
                    <div>{formatTestedAt(compareVersionRight.createdAt)}</div>
                  </div>
                </div>
                {(() => {
                  const a = parseMarkdownToSections(compareVersionLeft.markdown).sections;
                  const b = parseMarkdownToSections(compareVersionRight.markdown).sections;
                  const mapA = new Map(a.map((s) => [s.key, s]));
                  const mapB = new Map(b.map((s) => [s.key, s]));
                  const orderedKeys = [
                    ...a.map((s) => s.key),
                    ...b.map((s) => s.key).filter((k) => !mapA.has(k)),
                  ];
                  const items = orderedKeys.map((key) => {
                    const secA = mapA.get(key);
                    const secB = mapB.get(key);
                    const title = secA?.title ?? secB?.title ?? key;
                    const contentA = secA?.content ?? "";
                    const contentB = secB?.content ?? "";
                    const isDifferent = contentA.trim() !== contentB.trim();
                    return { key, title, contentA, contentB, isDifferent };
                  });
                  const filtered = versionShowDiffOnly ? items.filter((x) => x.isDifferent) : items;
                  const adoptAllV = (choice: "A" | "B") => {
                    const next: Record<string, "A" | "B"> = {};
                    for (const k of orderedKeys) {
                      next[k] = choice;
                    }
                    setVersionSelectedSections(next);
                  };
                  const mergedVersionMarkdown = orderedKeys
                    .map((key) => {
                      const it = items.find((x) => x.key === key);
                      if (!it) return "";
                      const chosen = versionSelectedSections[key] ?? "A";
                      const content = (chosen === "A" ? it.contentA : it.contentB).trim();
                      if (!content) {
                        return it.key === "preamble" ? "" : "";
                      }
                      if (it.key === "preamble") {
                        return content;
                      }
                      return `## ${it.title}\n\n${content}`;
                    })
                    .filter(Boolean)
                    .join("\n\n");
                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#0c4a6e", fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={versionShowDiffOnly}
                            onChange={(e) => setVersionShowDiffOnly(e.target.checked)}
                          />
                          차이만 보기
                        </label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            data-testid="spec-workspace-version-compare-adopt-all-a"
                            onClick={() => adoptAllV("A")}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #0369a1",
                              background: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            A 전체 채택
                          </button>
                          <button
                            type="button"
                            data-testid="spec-workspace-version-compare-adopt-all-b"
                            onClick={() => adoptAllV("B")}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #0369a1",
                              background: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            B 전체 채택
                          </button>
                        </div>
                      </div>
                      {filtered.map((it) => {
                        const chosen = versionSelectedSections[it.key] ?? "A";
                        return (
                          <div
                            key={it.key}
                            style={{
                              marginBottom: 14,
                              padding: 12,
                              borderRadius: 10,
                              border: "1px solid #93c5fd",
                              background: it.isDifferent ? "rgba(255, 200, 0, 0.15)" : "#fff",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 14,
                                color: "#0f172a",
                                padding: "8px 10px",
                                borderTop: "1px solid #cbd5e1",
                                borderBottom: "1px solid #cbd5e1",
                                marginBottom: 12,
                              }}
                            >
                              {it.title}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
                              <div
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  background: chosen === "A" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                                  lineHeight: 1.65,
                                  fontSize: 13,
                                  whiteSpace: "pre-wrap",
                                  border: chosen === "A" ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                                }}
                              >
                                {it.contentA || "(없음)"}
                              </div>
                              <div
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  background: chosen === "B" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                                  lineHeight: 1.65,
                                  fontSize: 13,
                                  whiteSpace: "pre-wrap",
                                  border: chosen === "B" ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                                }}
                              >
                                {it.contentB || "(없음)"}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                data-testid={`spec-workspace-version-compare-adopt-${it.key}-a`}
                                onClick={() => setVersionSelectedSections((prev) => ({ ...prev, [it.key]: "A" }))}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: chosen === "A" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                  background: chosen === "A" ? "#2563eb" : "#e2e8f0",
                                  color: "#fff",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                [A 채택]
                              </button>
                              <button
                                type="button"
                                data-testid={`spec-workspace-version-compare-adopt-${it.key}-b`}
                                onClick={() => setVersionSelectedSections((prev) => ({ ...prev, [it.key]: "B" }))}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: chosen === "B" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                  background: chosen === "B" ? "#2563eb" : "#e2e8f0",
                                  color: "#fff",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                [B 채택]
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        style={{
                          marginTop: 10,
                          border: "1px solid rgba(59,130,246,0.35)",
                          borderRadius: 12,
                          background: "#eff6ff",
                          padding: 12,
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>
                          섹션 채택 결과 미리보기
                        </div>
                        <div
                          data-testid="spec-workspace-version-merged-preview"
                          style={{
                            fontSize: 13,
                            lineHeight: 1.65,
                            whiteSpace: "pre-wrap",
                            background: "#fff",
                            borderRadius: 10,
                            border: "1px solid #93c5fd",
                            padding: 12,
                            maxHeight: 200,
                            overflow: "auto",
                          }}
                        >
                          {mergedVersionMarkdown || "(선택된 섹션이 없습니다.)"}
                        </div>
                        <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#475569" }}>
                          새 확정 버전으로 저장하려면 위 「직접 수정」에 붙여 넣거나, AI 응답 비교의 병합 확정 흐름을 사용하세요.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>
            아직 확정된 스펙이 없습니다. AI 응답 중 하나를 선택해 확정하면 Task 생성 등의 기준으로 사용할 수 있습니다.
          </p>
        )}
      </div>

      <TaskDraftPanel
        projectId={projectId}
        canEdit={canEdit}
        selectedModel={selectedModel}
        currentSpecVersionId={workspace?.project.currentSpecVersionId ?? null}
        refreshKey={draftRefreshKey}
        lastAutoSync={lastTaskDraftSync}
      />

      {message ? (
        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: "#334155" }} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
