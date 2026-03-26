"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [aiBadges, setAiBadges] = useState<Record<AiFieldKey, boolean>>(emptyAiBadges);
  const [generatingContext, setGeneratingContext] = useState(false);

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

    setGeneratingContext(true);
    setMessage(null);
    try {
      const { res, json } = await postGenerateSpecContext({
        projectId,
        name: form.name.trim(),
        description: form.description.trim(),
        projectType: form.projectType,
      });
      if (!res.ok || !json.success || !json.data?.formatted) {
        setMessage(json.message || "AI 초안 생성에 실패했습니다.");
        return;
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
      setMessage(
        mode === "initial"
          ? "AI가 Project Spec 초안을 작성했습니다. 필요하면 수정한 뒤 저장하세요."
          : "AI가 초안을 다시 생성했습니다. 검토 후 저장하세요."
      );
    } catch (e) {
      console.error(e);
      setMessage("AI 초안 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingContext(false);
    }
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
        setMessage(patch.json.message || "저장 후 재생성에 실패했습니다.");
        return;
      }
      mergeContextIntoProject(patch.json.data);
      const { res, json } = await postSpecWorkspaceAction(projectId, { action: "regeneratePrompt" });
      if (!res.ok || !json.success) {
        setMessage(json.message || "프롬프트 재생성에 실패했습니다.");
        return;
      }
      setMessage("프롬프트가 재생성되어 버전으로 저장되었습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("프롬프트 재생성 중 오류가 발생했습니다.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleAiRequest() {
    if (!projectId || !canEdit) {
      return;
    }
    setActionBusy("ai");
    setMessage(null);
    try {
      const latestPromptId = workspace?.prompts?.[0]?.id;
      const { res, json } = await postSpecWorkspaceAction(projectId, {
        action: "aiRequest",
        promptId: latestPromptId,
      });
      if (!res.ok || !json.success) {
        setMessage(json.message || "AI 요청에 실패했습니다.");
        return;
      }
      setMessage("AI 응답이 추가되었습니다.");
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setMessage("AI 요청 중 오류가 발생했습니다.");
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

  async function handleCopyPrompt() {
    const ok = await copyToClipboard(generatedPrompt);
    setCopyOk(ok);
    setTimeout(() => setCopyOk(false), 1500);
  }

  if (!projectId) {
    return null;
  }

  return (
    <section
      data-ui-label="[F-1-3] Function — Project Spec Definition Workspace"
      data-testid="project-spec-workspace"
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        background: "#fafbff",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Project Spec 정의 워크스페이스</h2>
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
        data-ui-label="[F-1-3-1] Workspace — Project Context (Editable)"
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px 0" }}>프로젝트 정보</h3>

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
            AI가 Project Spec 초안을 작성하고 있습니다…
          </p>
        ) : null}

        {baseInputsOk && allSpecFieldsEmpty && canEdit ? (
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
            아래 「AI로 초안 생성」으로 목표·범위·사용자·성공 기준 초안을 먼저 받을 수 있습니다. 직접 입력을 원하면 필드에 바로 작성하세요.
          </p>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div data-ui-label="[F-1-3-1a] Workspace — Basic Project Fields">
            <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 700, color: "#64748b" }}>기본 입력</p>
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

          <div data-ui-label="[F-1-3-1b] Workspace — AI Draft Actions">
            <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 700, color: "#64748b" }}>AI 초안 생성</p>
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

          <div data-ui-label="[F-1-3-1c] Workspace — AI Draft Fields (Editable)">
            <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 700, color: "#64748b" }}>AI 생성 결과 · 수정 가능</p>
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
              disabled={saving || generatingContext}
              style={{
                justifySelf: "start",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: saving || generatingContext ? "wait" : "pointer",
              }}
            >
              {saving ? "저장 중…" : "프로젝트 정보 저장"}
            </button>
          ) : null}
        </div>
      </div>

      {/* [B] Prompt Builder */}
      <div
        data-ui-label="[F-1-3-2] Workspace — Generated Prompt & AI Actions"
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px 0" }}>Project Spec Prompt (자동 생성)</h3>
        <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b" }}>
          아래 텍스트는 현재 폼 값을 반영한 생성 결과입니다. 저장된 프롬프트 버전:{" "}
          {latestSavedVersion != null ? <strong>v{latestSavedVersion}</strong> : "없음"}
        </p>
        <div
          data-testid="spec-workspace-prompt-preview"
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 14,
            background: "#f8fafc",
            maxHeight: 280,
            overflow: "auto",
            marginBottom: 12,
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
            {generatedPrompt}
          </pre>
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
            disabled={!canEdit || actionBusy === "regen" || saving || generatingContext}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              background: "#f1f5f9",
              fontWeight: 700,
              cursor: canEdit ? "pointer" : "not-allowed",
            }}
          >
            {actionBusy === "regen" ? "처리 중…" : "프롬프트 재생성"}
          </button>
          <button
            type="button"
            data-testid="spec-workspace-ai-request"
            onClick={() => void handleAiRequest()}
            disabled={!canEdit || actionBusy === "ai" || generatingContext}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 700,
              cursor: canEdit ? "pointer" : "not-allowed",
            }}
          >
            {actionBusy === "ai" ? "요청 중…" : "AI에게 요청"}
          </button>
        </div>
      </div>

      {/* [C] AI 응답 목록 */}
      <div
        data-ui-label="[F-1-3-3] Workspace — AI Response List"
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px 0" }}>AI 응답</h3>
        {!workspace?.responses?.length ? (
          <p style={{ color: "#64748b", margin: 0 }}>아직 응답이 없습니다. 프롬프트를 저장한 뒤 「AI에게 요청」을 실행하세요.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {workspace.responses.map((r) => {
              const selected = confirmedId === r.id;
              const expanded = expandedId === r.id;
              return (
                <li
                  key={r.id}
                  data-testid={`spec-workspace-response-${r.id}`}
                  style={{
                    borderRadius: 10,
                    border: selected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    padding: 12,
                    background: selected ? "#eff6ff" : "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{formatTestedAt(r.createdAt)}</strong>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>
                        {r.provider} / {r.model}
                      </span>
                      {selected ? (
                        <span style={{ marginLeft: 8, color: "#1d4ed8", fontWeight: 800 }}>확정됨</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
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
                        {expanded ? "접기" : "미리보기"}
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          data-testid={`spec-workspace-confirm-${r.id}`}
                          onClick={() => void handleConfirm(r)}
                          disabled={actionBusy?.startsWith("confirm")}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid #2563eb",
                            background: "#2563eb",
                            color: "#fff",
                            cursor: actionBusy?.startsWith("confirm") ? "wait" : "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {actionBusy === `confirm-${r.id}` ? "…" : "확정"}
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
        data-ui-label="[F-1-3-4] Workspace — Confirmed Project Spec"
        style={{
          padding: 16,
          borderRadius: 10,
          border: "1px solid #86efac",
          background: "#f0fdf4",
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px 0" }}>확정된 Project Spec</h3>
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
