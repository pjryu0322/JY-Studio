"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildWorkspacePromptText } from "@/lib/project-spec/buildWorkspacePromptText";
import {
  fetchSpecWorkspace,
  patchProjectSpecContext,
  postGenerateSpecContext,
  postSpecWorkspaceAction,
  type SpecWorkspaceSnapshot,
} from "@/components/project-spec/api";
import type { Project, ProjectSpecResponseRecord } from "@/components/project-spec/types";
import { formatTestedAt } from "@/components/project-spec/format";
import { LabelTag } from "@/components/ui/LabelTag";
import { parsePromptToSections, type ParsedPromptSections } from "@/lib/project-spec/parsePromptToSections";
import { parseMarkdownToSections } from "@/lib/project-spec/parseMarkdownSections";
import {
  DEFAULT_SPEC_WORKSPACE_AI_MODEL,
  SPEC_WORKSPACE_AI_MODELS,
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

type AiFieldKey = "goals" | "in" | "out" | "users" | "success";

function emptyAiBadges(): Record<AiFieldKey, boolean> {
  return { goals: false, in: false, out: false, users: false, success: false };
}

function allAiBadgesOn(): Record<AiFieldKey, boolean> {
  return { goals: true, in: true, out: true, users: true, success: true };
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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function PromptBulletCard({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 12,
        background: "#fff",
      }}
    >
      <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 20, color: "#334155", fontSize: 13, lineHeight: 1.5 }}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function ProjectInfoPromptCard({ info }: { info: ParsedPromptSections["projectInfo"] }) {
  const rows = [
    ["프로젝트명", info.name],
    ["설명", info.description],
    ["유형", info.projectType],
  ].filter(([, v]) => Boolean(v && String(v).trim()));
  if (!rows.length) {
    return null;
  }
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#fff" }}>
      <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 700 }}>프로젝트 정보</h4>
      <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 13 }}>
        {rows.map(([k, v]) => (
          <div key={String(k)}>
            <dt style={{ fontWeight: 700, color: "#64748b", fontSize: 12 }}>{k}</dt>
            <dd style={{ margin: "4px 0 0 0", color: "#0f172a" }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ProjectSpecWorkspace({ projectId, project, canEdit, onProjectUpdated }: ProjectSpecWorkspaceProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [workspace, setWorkspace] = useState<SpecWorkspaceSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingWs, setLoadingWs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<SpecWorkspaceAiModelId>(DEFAULT_SPEC_WORKSPACE_AI_MODEL);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Record<string, "A" | "B">>({});
  const [aiBadges, setAiBadges] = useState<Record<AiFieldKey, boolean>>(emptyAiBadges);
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
      setWorkspace(json.data);
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
      setAiBadges(emptyAiBadges());
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

  const draftProject = useMemo((): Project => {
    const base = project ?? {
      id: projectId,
      name: form.name || "—",
      description: null,
      projectType: form.projectType,
      status: "",
    };
    return {
      ...base,
      name: form.name.trim() || base.name,
      description: form.description.trim() ? form.description : null,
      projectType: form.projectType,
      specCoreGoals: form.specCoreGoals.trim() || null,
      specScopeIn: form.specScopeIn.trim() || null,
      specScopeOut: form.specScopeOut.trim() || null,
      specTargetUsers: form.specTargetUsers.trim() || null,
      specSuccessCriteria: form.specSuccessCriteria.trim() || null,
    };
  }, [form, project, projectId]);

  const generatedPrompt = useMemo(() => buildWorkspacePromptText(draftProject), [draftProject]);
  const parsedPrompt = useMemo(() => parsePromptToSections(generatedPrompt), [generatedPrompt]);

  const latestSavedVersion = workspace?.prompts?.[0]?.version ?? null;
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

  const canAiDraftInitial = canEdit && baseInputsOk && allSpecFieldsEmpty;
  const canAiDraftRegenerate = canEdit && baseInputsOk;

  const allSpecFieldsFilledForAi = useMemo(
    () =>
      Boolean(
        form.specCoreGoals.trim() &&
          form.specScopeIn.trim() &&
          form.specScopeOut.trim() &&
          form.specTargetUsers.trim() &&
          form.specSuccessCriteria.trim()
      ),
    [form]
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
      status: project.status,
    });
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
        coreGoals: form.specCoreGoals.trim() || null,
        inScope: form.specScopeIn.trim() || null,
        outOfScope: form.specScopeOut.trim() || null,
        targetUsers: form.specTargetUsers.trim() || null,
        successCriteria: form.specSuccessCriteria.trim() || null,
      });
      if (!res.ok || !json.success || !json.data) {
        setMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      const ctx = json.data;
      setMessage("프로젝트 정보가 저장되었습니다.");
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
        const { res, json } = await postGenerateSpecContext({
          projectId,
          name: input.name.trim(),
          description: input.description.trim(),
          projectType: input.projectType.trim(),
        });
        if (!res.ok || !json.success || !json.data?.formatted) {
          setMessage(json.message || "AI 초안 생성에 실패했습니다.");
          return false;
        }
        const f = json.data.formatted;
        setForm((prev) => ({
          ...prev,
          specCoreGoals: f.specCoreGoals,
          specScopeIn: f.specScopeIn,
          specScopeOut: f.specScopeOut,
          specTargetUsers: f.specTargetUsers,
          specSuccessCriteria: f.specSuccessCriteria,
        }));
        setAiBadges(allAiBadgesOn());
        setMessage(input.successMessage);
        return true;
      } catch (e) {
        console.error(e);
        setMessage("AI 초안 생성 중 오류가 발생했습니다.");
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
          successMessage: "AI 초안이 생성되었습니다",
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

  async function runAiContextGenerate(mode: "initial" | "regenerate") {
    if (!projectId || !canEdit) {
      return;
    }
    if (mode === "initial" && !canAiDraftInitial) {
      return;
    }
    if (mode === "regenerate" && !canAiDraftRegenerate) {
      return;
    }

    await runSpecContextAiGeneration({
      name: form.name.trim(),
      description: form.description.trim(),
      projectType: form.projectType,
      successMessage:
        mode === "initial"
          ? "AI 초안이 생성되었습니다"
          : "AI가 초안을 다시 생성했습니다. 검토 후 저장하세요.",
    });
  }

  async function handleRegeneratePrompt() {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy("regen");
    setMessage(null);
    try {
      const patch = await patchProjectSpecContext({
        projectId,
        name: form.name.trim(),
        description: form.description.trim() ? form.description : null,
        projectType: form.projectType,
        coreGoals: form.specCoreGoals.trim() || null,
        inScope: form.specScopeIn.trim() || null,
        outOfScope: form.specScopeOut.trim() || null,
        targetUsers: form.specTargetUsers.trim() || null,
        successCriteria: form.specSuccessCriteria.trim() || null,
      });
      if (!patch.res.ok || !patch.json.success || !patch.json.data) {
        setMessage(patch.json.message || "저장 후 프롬프트 갱신에 실패했습니다.");
        return;
      }
      mergeContextIntoProject(patch.json.data);
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "regeneratePrompt" });
      if (!res.ok || !json.success) {
        setMessage(json.message || "프롬프트 갱신에 실패했습니다.");
        return;
      }
      setMessage("현재 입력값을 반영해 프롬프트 버전을 저장했습니다. (OpenAI 호출 없음)");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("프롬프트 갱신 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
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
    setMessage("현재 입력값을 저장하고 AI에 요청하는 중...");
    try {
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "aiRequest",
        model: selectedModel,
        saveContext: {
          name: form.name.trim(),
          description: form.description.trim() ? form.description : null,
          projectType: form.projectType,
          coreGoals: form.specCoreGoals.trim() || null,
          inScope: form.specScopeIn.trim() || null,
          outOfScope: form.specScopeOut.trim() || null,
          targetUsers: form.specTargetUsers.trim() || null,
          successCriteria: form.specSuccessCriteria.trim() || null,
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
      setMessage("병합 결과를 공식 Project Spec으로 확정했습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("병합 확정 처리 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCopyPrompt() {
    const ok = await copyToClipboard(generatedPrompt);
    setCopyOk(ok);
    setTimeout(() => setCopyOk(false), 1500);
  }

  if (!projectId) {
    return null;
  }

  const compareLeft = compareIds[0] ? workspace?.responses.find((r) => r.id === compareIds[0]) : undefined;
  const compareRight = compareIds[1] ? workspace?.responses.find((r) => r.id === compareIds[1]) : undefined;

  return (
    <section
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
        <LabelTag label="[F-1-3] Function — Project Spec Definition Workspace" />
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Project Spec 정의 워크스페이스</h2>
      </div>
      <p style={{ margin: "0 0 16px 0", color: "#475569", lineHeight: 1.55, fontSize: 14 }}>
        프로젝트 정보를 다듬고, 생성된 프롬프트로 AI와 상호작용한 뒤, 응답 중 하나를 확정해 공식 Project Spec으로 저장합니다.
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
            AI가 Project Spec 초안을 생성하고 있습니다...
          </p>
        ) : null}

        {baseInputsOk && allSpecFieldsEmpty && canEdit && !generatingContext ? (
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
            조건이 맞으면 AI가 먼저 초안을 제안합니다. 직접 작성하려면 아래 필드에 입력하면 자동 생성은 건너뜁니다. 초안을 다시 받으려면 「다시 생성」을 사용하세요.
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

          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <LabelTag label="[F-1-3-1b] Workspace — AI Draft Actions" />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b" }}>AI 초안 생성</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                data-testid="spec-workspace-ai-draft-generate"
                disabled={!canAiDraftInitial || generatingContext}
                onClick={() => void runAiContextGenerate("initial")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #7c3aed",
                  background: canAiDraftInitial && !generatingContext ? "#7c3aed" : "#e9d5ff",
                  color: canAiDraftInitial && !generatingContext ? "#fff" : "#6b21a8",
                  fontWeight: 700,
                  cursor: canAiDraftInitial && !generatingContext ? "pointer" : "not-allowed",
                }}
              >
                AI로 초안 생성
              </button>
              <button
                type="button"
                data-testid="spec-workspace-ai-draft-regenerate"
                disabled={!canAiDraftRegenerate || generatingContext}
                onClick={() => void runAiContextGenerate("regenerate")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #94a3b8",
                  background: canAiDraftRegenerate && !generatingContext ? "#f1f5f9" : "#f8fafc",
                  fontWeight: 700,
                  cursor: canAiDraftRegenerate && !generatingContext ? "pointer" : "not-allowed",
                }}
              >
                다시 생성
              </button>
              {!canAiDraftInitial && canEdit && baseInputsOk && !allSpecFieldsEmpty ? (
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  초안이 이미 있습니다. 전부 비우면 「AI로 초안 생성」을 다시 쓸 수 있고, 덮어쓰려면 「다시 생성」을 사용하세요.
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <LabelTag label="[F-1-3-1c] Workspace — AI Draft Fields" />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b" }}>AI 생성 결과 · 수정 가능</p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>핵심 목표</span>
                  {aiBadges.goals ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        background: "#dbeafe",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      AI 초안
                    </span>
                  ) : null}
                </span>
                <textarea
                  data-testid="spec-workspace-core-goals"
                  value={form.specCoreGoals}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setAiBadges((b) => ({ ...b, goals: false }));
                    setForm((f) => ({ ...f, specCoreGoals: e.target.value }));
                  }}
                  rows={3}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>In scope</span>
                  {aiBadges.in ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        background: "#dbeafe",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      AI 초안
                    </span>
                  ) : null}
                </span>
                <textarea
                  data-testid="spec-workspace-scope-in"
                  value={form.specScopeIn}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setAiBadges((b) => ({ ...b, in: false }));
                    setForm((f) => ({ ...f, specScopeIn: e.target.value }));
                  }}
                  rows={4}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Out of scope</span>
                  {aiBadges.out ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        background: "#dbeafe",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      AI 초안
                    </span>
                  ) : null}
                </span>
                <textarea
                  data-testid="spec-workspace-scope-out"
                  value={form.specScopeOut}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setAiBadges((b) => ({ ...b, out: false }));
                    setForm((f) => ({ ...f, specScopeOut: e.target.value }));
                  }}
                  rows={4}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>대상 사용자</span>
                  {aiBadges.users ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        background: "#dbeafe",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      AI 초안
                    </span>
                  ) : null}
                </span>
                <textarea
                  data-testid="spec-workspace-target-users"
                  value={form.specTargetUsers}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setAiBadges((b) => ({ ...b, users: false }));
                    setForm((f) => ({ ...f, specTargetUsers: e.target.value }));
                  }}
                  rows={4}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>성공 기준</span>
                  {aiBadges.success ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        background: "#dbeafe",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      AI 초안
                    </span>
                  ) : null}
                </span>
                <textarea
                  data-testid="spec-workspace-success-criteria"
                  value={form.specSuccessCriteria}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setAiBadges((b) => ({ ...b, success: false }));
                    setForm((f) => ({ ...f, specSuccessCriteria: e.target.value }));
                  }}
                  rows={4}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          {canEdit ? (
            <button
              type="button"
              data-testid="spec-workspace-save-project"
              onClick={() => void handleSaveProjectInfo()}
              disabled={saving || generatingContext || actionBusy === "regen" || actionBusy === "ai-spec"}
              style={{
                justifySelf: "start",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor:
                  saving || generatingContext || actionBusy === "regen" || actionBusy === "ai-spec"
                    ? "wait"
                    : "pointer",
              }}
            >
              {saving ? "저장 중…" : "프로젝트 정보 저장"}
            </button>
          ) : null}
        </div>
      </div>

      {/* [B] Prompt Builder */}
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
          <LabelTag label="[F-1-3-2] Workspace — Generated Prompt & AI Actions" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Project Spec Prompt (자동 생성)</h3>
        </div>

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
                {m}
              </option>
            ))}
          </select>
        </label>

        <p style={{ margin: "0 0 6px 0", fontSize: 13, color: "#64748b" }}>
          미리보기는 서버와 동일한 <code style={{ fontSize: 12 }}>buildWorkspacePromptText</code> 규칙으로 현재 폼 값을
          반영합니다. 저장된 프롬프트 버전:{" "}
          {latestSavedVersion != null ? <strong>v{latestSavedVersion}</strong> : "없음"}
        </p>
        <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
          「현재 값으로 프롬프트 갱신」은 DB에 반영한 뒤 새 프롬프트 버전만 만듭니다(OpenAI 호출 없음). 「AI로 Project Spec
          생성」은 저장 → 최신 프롬프트 작성 → 선택한 모델로 OpenAI 호출까지 한 번에 진행합니다.
        </p>

        <button
          type="button"
          data-testid="spec-workspace-toggle-prompt"
          onClick={() => setPromptPanelOpen((o) => !o)}
          style={{
            marginBottom: 12,
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #64748b",
            background: "#f8fafc",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {promptPanelOpen ? "닫기" : "Project Spec Prompt 보기"}
        </button>

        <div
          data-testid="spec-workspace-prompt-preview"
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 14,
            background: "#f8fafc",
            marginBottom: 12,
            minHeight: 48,
          }}
        >
          {!promptPanelOpen ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              구조화된 프롬프트 미리보기는 접혀 있습니다. 「Project Spec Prompt 보기」를 눌러 카드 형태로 확인하세요.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12, maxHeight: 420, overflow: "auto" }}>
              <ProjectInfoPromptCard info={parsedPrompt.projectInfo} />
              <PromptBulletCard title="핵심 목표" items={parsedPrompt.coreGoals} />
              <PromptBulletCard title="In Scope" items={parsedPrompt.inScope} />
              <PromptBulletCard title="Out Of Scope" items={parsedPrompt.outOfScope} />
              <PromptBulletCard title="대상 사용자" items={parsedPrompt.targetUsers} />
              <PromptBulletCard title="성공 기준" items={parsedPrompt.successCriteria} />
              {parsedPrompt.extraBlocks.map((blk, idx) => (
                <PromptBulletCard key={`${blk.title}-${idx}`} title={blk.title} items={blk.bullets} />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            data-testid="spec-workspace-copy-prompt"
            onClick={() => void handleCopyPrompt()}
            disabled={!canEdit}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              fontWeight: 700,
              cursor: canEdit ? "pointer" : "not-allowed",
            }}
          >
            {copyOk ? "복사됨" : "프롬프트 복사"}
          </button>
          <button
            type="button"
            data-testid="spec-workspace-regenerate-prompt"
            onClick={() => void handleRegeneratePrompt()}
            disabled={
              !canEdit ||
              actionBusy === "regen" ||
              actionBusy === "ai-spec" ||
              saving ||
              generatingContext
            }
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              background: "#f1f5f9",
              fontWeight: 700,
              cursor: canEdit ? "pointer" : "not-allowed",
            }}
          >
            {actionBusy === "regen" ? "저장·프롬프트 갱신 중…" : "현재 값으로 프롬프트 갱신"}
          </button>
          <button
            type="button"
            data-testid="spec-workspace-ai-request"
            onClick={() => void handleAiProjectSpecGeneration()}
            disabled={
              !canEdit ||
              actionBusy === "ai-spec" ||
              actionBusy === "regen" ||
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
            AI로 Spec을 만들려면 핵심 목표·In/Out scope·대상 사용자·성공 기준을 모두 입력하세요.
          </p>
        ) : null}
        {actionBusy === "ai-spec" ? (
          <p
            data-testid="spec-workspace-ai-spec-progress"
            style={{ margin: "10px 0 0 0", fontSize: 13, color: "#0f766e", fontWeight: 600 }}
          >
            현재 입력값을 저장하고 AI에 요청하는 중…
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
          <LabelTag label="[F-1-3-3] Workspace — AI Response List" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>AI 응답</h3>
        </div>
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#64748b" }}>
          응답 두 개를 「비교」로 선택하면 섹션 단위로 나란히 보이고, 차이 있는 섹션만 강조됩니다.
        </p>

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
            아직 응답이 없습니다. Spec 필드를 채운 뒤 「AI로 Project Spec 생성」을 실행하세요.
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

      {/* [D] 확정된 Project Spec */}
      <div
        style={{
          padding: 16,
          borderRadius: 10,
          border: "1px solid #86efac",
          background: "#f0fdf4",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <LabelTag label="[F-1-3-4] Workspace — Confirmed Project Spec" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>확정된 Project Spec</h3>
        </div>
        {workspace?.project.confirmedSpecMarkdown ? (
          <>
            <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#166534" }}>
              확정 시각:{" "}
              {workspace.project.confirmedSpecAt ? formatTestedAt(workspace.project.confirmedSpecAt) : "-"}
            </p>
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
          </>
        ) : (
          <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>
            아직 확정된 스펙이 없습니다. AI 응답 중 하나를 선택해 확정하면 Task 생성 등의 기준으로 사용할 수 있습니다.
          </p>
        )}
      </div>

      {message ? (
        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: "#334155" }} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
