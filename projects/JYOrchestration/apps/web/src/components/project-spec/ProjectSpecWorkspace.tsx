"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AiDraftCandidate,
  patchSpecWorkspace,
  patchProjectSpecContext,
  postProjectPlanGenerate,
  postProjectPlanRevise,
  postSpecWorkspaceAction,
  type SpecWorkspaceSnapshot,
} from "@/components/project-spec/api";
import { useProjectSpecWorkspaceData } from "@/components/project-spec/useProjectSpecWorkspaceData";
import { hydrateProjectSpecWorkspaceFromSnapshot } from "@/components/project-spec/workspaceHydrateFromSnapshot";
import { type FormState, emptyForm, projectToForm } from "@/components/project-spec/workspaceFormState";
import { TaskDraftPanel } from "@/components/project-spec/TaskDraftPanel";
import type { Project, ProjectSpecResponseRecord, TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { parseProjectPlanMarkdownToForm } from "@/lib/project-spec/parseProjectPlanMarkdown";
import {
  DEFAULT_SPEC_WORKSPACE_AI_MODEL,
  SPEC_WORKSPACE_AI_MODELS,
  type SpecWorkspaceAiModelId,
} from "@/lib/project-spec/specWorkspaceModels";
import { getSpecCandidateDisplayScore } from "@/lib/project-spec/specCandidatePayload";
import { SPEC_PROMPT_PRESET_IDS, type SpecPromptPresetId } from "@/lib/project-spec/specPromptPresets";
import { useTimedSuccessErrorToasts } from "@/components/workspace/useTimedSuccessErrorToasts";
import { WorkspaceSuccessErrorSaveToastHost } from "@/components/workspace/WorkspaceSuccessErrorSaveToastHost";
import { ProjectSpecExecutionPlanContextSection } from "@/components/project-spec/ProjectSpecExecutionPlanContextSection";
import { ProjectSpecSavedPlanAiSection } from "@/components/project-spec/ProjectSpecSavedPlanAiSection";
import { ProjectSpecWorkspaceConfirmedSpecSection } from "@/components/project-spec/ProjectSpecWorkspaceConfirmedSpecSection";
import { ProjectSpecWorkspaceOverview } from "@/components/project-spec/ProjectSpecWorkspaceOverview";
import { ProjectSpecWorkspaceResponsesCompareSection } from "@/components/project-spec/ProjectSpecWorkspaceResponsesCompareSection";
import type { ProjectSpecWorkspaceProps } from "@/components/project-spec/ProjectSpecWorkspace.types";
import {
  specAutoDraftInFlightByProject,
  specAutoDraftSucceededByProject,
} from "@/lib/project-spec/projectSpecWorkspaceAutoDraftGuards";
import { readTaskDraftSyncFromPayload } from "@/lib/project-spec/readTaskDraftSyncFromPayload";
import { specResponseSourceLabel } from "@/lib/project-spec/specResponseSourceLabel";

export function ProjectSpecWorkspace({
  projectId,
  project,
  canEdit,
  onProjectUpdated,
  workflowExecution,
  onAfterTaskDraftsGenerate,
}: ProjectSpecWorkspaceProps) {
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
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
  const [specCompareMode, setSpecCompareMode] = useState<"full" | "section">("full");
  const [chosenSpecResponseId, setChosenSpecResponseId] = useState<string | null>(null);
  const [specPromptDraft, setSpecPromptDraft] = useState<{ template: string; preset: SpecPromptPresetId }>({
    template: "",
    preset: "default",
  });
  const [specGenFingerprintAtLastRun, setSpecGenFingerprintAtLastRun] = useState<string | null>(null);
  const [specPromptUiBusy, setSpecPromptUiBusy] = useState(false);
  const fullCompareLeftRef = useRef<HTMLPreElement>(null);
  const fullCompareRightRef = useRef<HTMLPreElement>(null);
  const fullCompareScrollLock = useRef(false);
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

  const hydrateFromWorkspaceSnapshot = useCallback((snapshot: SpecWorkspaceSnapshot) => {
    hydrateProjectSpecWorkspaceFromSnapshot(snapshot, {
      setForm,
      setWorkingDocument,
      setLastSavedWorkingDocument,
      setSelectedPlanCandidateId,
      planWorkspaceHydratedRef,
    });
  }, []);

  const { workspace, setWorkspace, loadError, loadingWs, loadWorkspace } = useProjectSpecWorkspaceData(
    projectId,
    hydrateFromWorkspaceSnapshot
  );

  const {
    successToast,
    errorToast,
    showSuccessToast,
    showErrorToast,
    clearToasts,
  } = useTimedSuccessErrorToasts({ successDismissMs: 2500, errorDismissMs: 5000 });

  const clearWorkspaceFeedback = useCallback(() => {
    setStatusLine(null);
    clearToasts();
  }, [clearToasts]);

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

  useEffect(() => {
    setChosenSpecResponseId(null);
  }, [projectId]);

  useEffect(() => {
    setSpecGenFingerprintAtLastRun(null);
  }, [projectId]);

  useEffect(() => {
    const c = workspace?.specPromptConfig;
    if (c) {
      const p = c.preset as SpecPromptPresetId;
      setSpecPromptDraft({
        template: c.templatePrompt,
        preset: SPEC_PROMPT_PRESET_IDS.includes(p) ? p : "default",
      });
    }
  }, [workspace?.specPromptConfig]);

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

  const savedExecutionPlanOk = Boolean(workspace?.project.executionPlanMarkdown?.trim());

  const specGenSettingsReady = useMemo(
    () =>
      SPEC_PROMPT_PRESET_IDS.includes(specPromptDraft.preset) && Boolean(specPromptDraft.template.trim()),
    [specPromptDraft.preset, specPromptDraft.template]
  );

  const specModelSelectionReady = useMemo(
    () => SPEC_WORKSPACE_AI_MODELS.includes(selectedModel),
    [selectedModel]
  );

  const specGenFingerprint = useMemo(
    () => `${specPromptDraft.preset}|${specPromptDraft.template.trim()}|${selectedModel}`,
    [specPromptDraft.preset, specPromptDraft.template, selectedModel]
  );

  const showSpecGenStaleWarning = useMemo(
    () =>
      (workspace?.responses?.length ?? 0) > 0 &&
      specGenFingerprintAtLastRun !== null &&
      specGenFingerprint !== specGenFingerprintAtLastRun,
    [workspace?.responses?.length, specGenFingerprint, specGenFingerprintAtLastRun]
  );

  const canRunAiProjectSpec = useMemo(
    () =>
      canEdit &&
      baseInputsOk &&
      savedExecutionPlanOk &&
      !planDocumentDirty &&
      specGenSettingsReady &&
      specModelSelectionReady,
    [
      canEdit,
      baseInputsOk,
      savedExecutionPlanOk,
      planDocumentDirty,
      specGenSettingsReady,
      specModelSelectionReady,
    ]
  );

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
    executionPlanMarkdown: string | null;
    selectedPlanCandidateId: string | null;
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
      executionPlanMarkdown: ctx.executionPlanMarkdown,
      selectedPlanCandidateId: ctx.selectedPlanCandidateId,
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
      executionPlanMarkdown: p.executionPlanMarkdown ?? null,
      selectedPlanCandidateId: p.selectedPlanCandidateId ?? null,
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

  async function handleAppendManualSpec() {
    if (!projectId || !canEdit) {
      return;
    }
    const md = specDraftMarkdown.trim();
    if (!md) {
      showErrorToast("저장할 마크다운이 비어 있습니다.");
      return;
    }
    setActionBusy("append-manual");
    clearWorkspaceFeedback();
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "appendManualSpec", markdown: md });
      if (!res.ok || !json.success) {
        showErrorToast(json.message || "저장에 실패했습니다.");
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
      showSuccessToast("수정 내용을 새 버전으로 저장했습니다.");
      setSpecEditOpen(false);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("저장 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRefineSpec() {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy("refine-spec");
    clearWorkspaceFeedback();
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "refineSpec", model: selectedModel });
      if (!res.ok || !json.success) {
        showErrorToast(json.message || "AI 개선에 실패했습니다.");
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
      showSuccessToast("현재 확정된 실행 계획을 바탕으로 AI 개선본을 새 버전으로 저장했습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("AI 개선 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRollbackSpec(versionId: string) {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy(`rollback-${versionId}`);
    clearWorkspaceFeedback();
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "rollbackSpec", versionId });
      if (!res.ok || !json.success) {
        showErrorToast(json.message || "롤백에 실패했습니다.");
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
      showSuccessToast("선택한 버전을 현재 활성 실행 계획으로 되돌렸습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("롤백 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSaveProjectInfo() {
    if (!projectId || !canEdit) {
      return;
    }
    setSaving(true);
    clearWorkspaceFeedback();
    try {
      const { res, json } = await patchProjectSpecContext({
        projectId,
        name: form.name.trim(),
        projectType: form.projectType,
        coreGoals: effectiveSpecSlice.specCoreGoals.trim() || null,
        inScope: effectiveSpecSlice.specScopeIn.trim() || null,
        outOfScope: effectiveSpecSlice.specScopeOut.trim() || null,
        targetUsers: effectiveSpecSlice.specTargetUsers.trim() || null,
        successCriteria: effectiveSpecSlice.specSuccessCriteria.trim() || null,
        executionPlanMarkdown: workingDocument.trim() || null,
        selectedPlanCandidateId: selectedPlanCandidateId,
      });
      if (!res.ok || !json.success || !json.data) {
        showErrorToast(json.message || "저장에 실패했습니다.");
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
      showSuccessToast("실행 계획이 저장되었습니다. 다음 단계 「AI 실행 계획 문서 생성」에 반영됩니다.");
      mergeContextIntoProject(ctx);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("저장 중 오류가 발생했습니다.");
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
      clearWorkspaceFeedback();
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
          showErrorToast(json.message || "AI 실행 계획 초안 생성에 실패했습니다.");
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
        showSuccessToast(
          failures.length > 0
            ? `${input.successMessage} (일부 모델 실패 — 상단 메시지 참고)`
            : input.successMessage
        );
        return true;
      } catch (e) {
        console.error(e);
        showErrorToast("AI 실행 계획 초안 생성 중 오류가 발생했습니다.");
        return false;
      } finally {
        isGeneratingRef.current = false;
        setGeneratingContext(false);
      }
    },
    [projectId, canEdit, showSuccessToast, showErrorToast, clearWorkspaceFeedback]
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
      showErrorToast("프로젝트명·설명·유형을 입력하세요.");
      return;
    }
    if (selectedModelsForPlan.length === 0) {
      showErrorToast("모델을 하나 이상 선택하세요.");
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
    clearWorkspaceFeedback();
    try {
      const { res, json } = await postProjectPlanRevise({
        projectId,
        document: workingDocument,
        instruction: planRevisionInstruction,
        model: planRevisionModel,
      });
      if (!res.ok || !json.success || !json.data?.content) {
        showErrorToast(json.message || "AI 개선 제안에 실패했습니다.");
        return;
      }
      setPlanRevisionSuggestion({
        instruction: planRevisionInstruction,
        content: json.data.content,
        createdAt: new Date().toISOString(),
      });
      showSuccessToast("AI 개선 제안을 받았습니다. 적용 또는 무시를 선택하세요.");
    } catch (e) {
      console.error(e);
      showErrorToast("AI 개선 제안 중 오류가 발생했습니다.");
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
      showErrorToast(
        planDocumentDirty
          ? "실행 계획이 저장되지 않은 변경이 있습니다. 먼저 「실행계획 저장」을 실행하세요."
          : !baseInputsOk
            ? "프로젝트명·설명·유형을 입력하세요."
            : !savedExecutionPlanOk
              ? "실행 계획을 「실행계획 저장」으로 저장하세요."
              : !specGenSettingsReady
                ? "AI 생성 설정에서 프리셋과 프롬프트 템플릿을 입력하세요."
                : !specModelSelectionReady
                  ? "AI 모델을 선택하세요."
                  : "조건을 충족한 뒤 다시 시도하세요."
      );
      return;
    }
    const fingerprintNow = `${specPromptDraft.preset}|${specPromptDraft.template.trim()}|${selectedModel}`;
    setActionBusy("ai-spec");
    setStatusLine("저장된 실행 계획만을 반영해 AI에 실행 계획 문서 생성을 요청하는 중…");
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "aiRequest",
        model: selectedModel,
        preset: specPromptDraft.preset,
        templatePrompt: specPromptDraft.template,
      });
      if (!res.ok || !json.success) {
        showErrorToast(json.message || "AI 실행 계획 문서 생성에 실패했습니다.");
        return;
      }
      const data = json.data as {
        project?: SpecWorkspaceSnapshot["project"];
      };
      if (data.project) {
        mergeWorkspaceProjectSlice(data.project);
      }
      setSpecGenFingerprintAtLastRun(fingerprintNow);
      showSuccessToast("AI 실행 계획 문서 초안이 응답 목록에 추가되었습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("AI 실행 계획 문서 생성 중 오류가 발생했습니다.");
    } finally {
      setStatusLine(null);
      setActionBusy(null);
    }
  }

  async function handleConfirm(response: ProjectSpecResponseRecord) {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy(`confirm-${response.id}`);
    clearWorkspaceFeedback();
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "confirm",
        responseId: response.id,
      });
      if (!res.ok || !json.success || !json.data || typeof json.data !== "object") {
        showErrorToast(json.message || "확정에 실패했습니다.");
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
      showSuccessToast("이 응답을 공식 실행 계획으로 확정했습니다.");
      setChosenSpecResponseId(null);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("확정 처리 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConfirmMerged(mergedMarkdown: string, responseAId: string, responseBId: string) {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy("confirm-merged");
    clearWorkspaceFeedback();
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "confirmMerged",
        responseAId,
        responseBId,
        mergedMarkdown,
        selectedSections,
      });
      if (!res.ok || !json.success) {
        showErrorToast((json as { message?: string }).message || "병합 확정에 실패했습니다.");
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
      showSuccessToast("병합 결과를 공식 실행 계획으로 확정했습니다.");
      setChosenSpecResponseId(null);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("병합 확정 처리 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  const specQuickBadgesById = useMemo(() => {
    const list = workspace?.responses ?? [];
    const m = new Map<string, string[]>();
    if (list.length < 2) {
      return m;
    }
    const scored = list.map((r) => ({ r, s: getSpecCandidateDisplayScore(r) }));
    const maxStruct = Math.max(...scored.map((x) => x.s.structure), 0);
    const maxComp = Math.max(...scored.map((x) => x.s.completeness), 0);
    const maxExec = Math.max(...scored.map((x) => x.s.executionReadiness), 0);
    for (const { r, s } of scored) {
      const labels: string[] = [];
      if (maxStruct > 0 && s.structure === maxStruct) {
        labels.push("Best Structure");
      }
      if (maxComp > 0 && s.completeness === maxComp) {
        labels.push("Most Complete");
      }
      if (maxExec > 0 && s.executionReadiness === maxExec) {
        labels.push("Fastest to Implement");
      }
      if (labels.length) {
        m.set(r.id, labels);
      }
    }
    return m;
  }, [workspace?.responses]);

  const syncFullCompareScroll = useCallback((source: "left" | "right") => {
    if (fullCompareScrollLock.current) {
      return;
    }
    const L = fullCompareLeftRef.current;
    const R = fullCompareRightRef.current;
    if (!L || !R) {
      return;
    }
    const src = source === "left" ? L : R;
    const dst = source === "left" ? R : L;
    const sr = src.scrollHeight - src.clientHeight;
    const dr = dst.scrollHeight - dst.clientHeight;
    if (sr <= 0 || dr <= 0) {
      return;
    }
    fullCompareScrollLock.current = true;
    const ratio = src.scrollTop / sr;
    dst.scrollTop = ratio * dr;
    requestAnimationFrame(() => {
      fullCompareScrollLock.current = false;
    });
  }, []);

  async function saveSpecPromptSettings() {
    if (!projectId || !canEdit) {
      return;
    }
    setSpecPromptUiBusy(true);
    clearWorkspaceFeedback();
    try {
      const { res, json } = await patchSpecWorkspace(projectId, {
        specPromptTemplate: specPromptDraft.template,
        specPromptPreset: specPromptDraft.preset,
      });
      if (!res.ok || !json.success) {
        showErrorToast(json.message || "프롬프트 설정 저장에 실패했습니다.");
        return;
      }
      if (json.data?.specPromptConfig) {
        setWorkspace((ws) =>
          ws
            ? {
                ...ws,
                specPromptConfig: json.data!.specPromptConfig!,
              }
            : ws
        );
      }
      showSuccessToast("실행 계획 문서 생성용 프롬프트 설정을 저장했습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      showErrorToast("프롬프트 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSpecPromptUiBusy(false);
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
      <ProjectSpecWorkspaceOverview
        projectInfoOpen={projectInfoOpen}
        onToggleProjectInfo={() => setProjectInfoOpen((v) => !v)}
        workspace={workspace}
        project={project}
        loadError={loadError}
        loadingWs={loadingWs}
      />

      {/* [A] 실행 계획 입력 */}
      <ProjectSpecExecutionPlanContextSection
        generatingContext={generatingContext}
        baseInputsOk={baseInputsOk}
        allSpecFieldsEmpty={allSpecFieldsEmpty}
        canEdit={canEdit}
        form={form}
        setForm={setForm}
        saving={saving}
        actionBusyAiSpec={actionBusy === "ai-spec"}
        actionBusyPlanRevise={actionBusy === "plan-revise"}
        onSaveProjectInfo={() => void handleSaveProjectInfo()}
        draftPlan={{
          canEdit,
          baseInputsOk,
          generatingContext,
          selectedModelsForPlan,
          onToggleModel: toggleModelForPlan,
          onGenerate: (mode) => void handlePlanGenerate(mode),
          planCandidates,
          planFailures,
          selectedPlanCandidateId,
          onSelectCandidate: handleSelectPlanCandidate,
          workingDocument,
          onWorkingDocumentChange: handleWorkingDocumentChange,
          planDocumentDirty,
          revisionModel: planRevisionModel,
          onRevisionModelChange: setPlanRevisionModel,
          revisionInstruction: planRevisionInstruction,
          onRevisionInstructionChange: setPlanRevisionInstruction,
          revisionSuggestion: planRevisionSuggestion,
          onRequestRevision: () => void handleRequestPlanRevision(),
          onApplyRevision: handleApplyPlanRevision,
          onIgnoreRevision: handleIgnorePlanRevision,
          revisionBusy: actionBusy === "plan-revise",
        }}
      />

      {/* [B] 저장된 계획 기반 Project Spec AI 생성 */}
      <ProjectSpecSavedPlanAiSection
        canEdit={canEdit}
        specPromptUiBusy={specPromptUiBusy}
        specPromptDraft={specPromptDraft}
        setSpecPromptDraft={setSpecPromptDraft}
        onSaveSpecPromptSettings={() => void saveSpecPromptSettings()}
        showSpecGenStaleWarning={showSpecGenStaleWarning}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        onAiProjectSpecGeneration={() => void handleAiProjectSpecGeneration()}
        actionBusy={actionBusy}
        saving={saving}
        generatingContext={generatingContext}
        canRunAiProjectSpec={canRunAiProjectSpec}
        baseInputsOk={baseInputsOk}
        savedExecutionPlanOk={savedExecutionPlanOk}
        planDocumentDirty={planDocumentDirty}
      />

      {/* [C] AI 응답 목록 · 비교 */}
      <ProjectSpecWorkspaceResponsesCompareSection
        responses={workspace?.responses}
        compareIds={compareIds}
        canEdit={canEdit}
        actionBusy={actionBusy}
        chosenSpecResponseId={chosenSpecResponseId}
        setChosenSpecResponseId={setChosenSpecResponseId}
        onConfirmResponse={(r) => void handleConfirm(r)}
        compareLeft={compareLeft}
        compareRight={compareRight}
        setCompareIds={setCompareIds}
        setSelectedSections={setSelectedSections}
        setShowDiffOnly={setShowDiffOnly}
        specCompareMode={specCompareMode}
        setSpecCompareMode={setSpecCompareMode}
        showDiffOnly={showDiffOnly}
        selectedSections={selectedSections}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        toggleCompareId={toggleCompareId}
        fullCompareLeftRef={fullCompareLeftRef}
        fullCompareRightRef={fullCompareRightRef}
        syncFullCompareScroll={syncFullCompareScroll}
        specQuickBadgesById={specQuickBadgesById}
        confirmedId={confirmedId}
        onConfirmMerged={(md, a, b) => void handleConfirmMerged(md, a, b)}
      />

      {/* [D] 확정된 Project Spec (버전 append-only, 롤백은 활성 포인터만 이동) */}
      <ProjectSpecWorkspaceConfirmedSpecSection
        snapshotProject={workspace?.project}
        specVersions={specVersions}
        compareVersionLeft={compareVersionLeft}
        compareVersionRight={compareVersionRight}
        versionCompareIds={versionCompareIds}
        setVersionCompareIds={setVersionCompareIds}
        setVersionSelectedSections={setVersionSelectedSections}
        versionShowDiffOnly={versionShowDiffOnly}
        setVersionShowDiffOnly={setVersionShowDiffOnly}
        versionSelectedSections={versionSelectedSections}
        toggleVersionCompareId={toggleVersionCompareId}
        canEdit={canEdit}
        actionBusy={actionBusy}
        specEditOpen={specEditOpen}
        setSpecEditOpen={setSpecEditOpen}
        specDraftMarkdown={specDraftMarkdown}
        setSpecDraftMarkdown={setSpecDraftMarkdown}
        onAppendManualSpec={() => void handleAppendManualSpec()}
        onRefineSpec={() => void handleRefineSpec()}
        onRollbackSpec={(vid) => void handleRollbackSpec(vid)}
      />

      <TaskDraftPanel
        projectId={projectId}
        canEdit={canEdit}
        selectedModel={selectedModel}
        currentSpecVersionId={
          project?.currentSpecVersionId ?? workspace?.project.currentSpecVersionId ?? null
        }
        refreshKey={draftRefreshKey}
        lastAutoSync={lastTaskDraftSync}
        workflowExecution={workflowExecution}
        onAfterTaskDraftsGenerate={onAfterTaskDraftsGenerate}
      />

      {/* 실행 환경·Git 저장소: 프로젝트 관리 → 설정 [F-1-3-6] */}

      <WorkspaceSuccessErrorSaveToastHost success={successToast} error={errorToast} />
      {statusLine ? (
        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: "#334155" }} role="status">
          {statusLine}
        </p>
      ) : null}
    </section>
  );
}
