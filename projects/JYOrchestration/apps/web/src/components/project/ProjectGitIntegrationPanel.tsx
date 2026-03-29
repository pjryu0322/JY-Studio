"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchExecutionSetup, patchExecutionSetup, postExecutionSetupValidate } from "@/components/project-spec/api";
import { mergeValidateIntoSetup, type ValidateResponseData } from "@/components/project-spec/executionSetupValidateMerge";
import { ExecutionSetupPanel } from "@/components/project-spec/ExecutionSetupPanel";
import { formatTestedAt } from "@/components/project-spec/format";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import type { Project } from "@/components/project-spec/types";

type Props = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
};

const PLACEHOLDERS = {
  gitRepoUrl: "https://github.com/조직이름/저장소이름",
  gitRepoName: "조직이름/저장소이름",
  baseBranch: "main",
} as const;

function repoConnectionToneColor(tone: "muted" | "ok" | "bad" | "warn"): string {
  if (tone === "ok") return "#15803d";
  if (tone === "bad") return "#b91c1c";
  if (tone === "warn") return "#b45309";
  return "#64748b";
}

function repoConnectionStatus(ok: boolean | null | undefined): { label: string; tone: "muted" | "ok" | "bad" | "warn" } {
  if (ok === true) return { label: "검증 완료", tone: "ok" };
  if (ok === false) return { label: "검증 실패", tone: "bad" };
  return { label: "미검증", tone: "warn" };
}

type GitLinkDraft = {
  gitRepoUrl: string;
  gitRepoProvider: string;
  gitRepoName: string;
  baseBranch: string;
};

export function ProjectGitIntegrationPanel({ projectId, project, canEdit }: Props) {
  const [executionSetup, setExecutionSetup] = useState<
    Awaited<ReturnType<typeof fetchExecutionSetup>>["json"]["data"] | null
  >(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [gitLinkDraft, setGitLinkDraft] = useState<GitLinkDraft>({
    gitRepoUrl: "",
    gitRepoProvider: "github",
    gitRepoName: "",
    baseBranch: "main",
  });
  const [busyGit, setBusyGit] = useState<"save" | "validate" | null>(null);

  const loadExecutionSetup = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchExecutionSetup(projectId);
      if (res.ok && json.success) {
        const row = json.data;
        setExecutionSetup(
          row
            ? {
                ...row,
                allowedPathGlobs: row.allowedPathGlobs ?? [],
              }
            : null
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    void loadExecutionSetup();
  }, [loadExecutionSetup]);

  useEffect(() => {
    if (executionSetup) return;
    setGitLinkDraft((d) => ({
      ...d,
      gitRepoUrl: d.gitRepoUrl || project?.repoUrl || "",
    }));
  }, [executionSetup, project?.repoUrl]);

  const specWorkflowConfirmed = useMemo(
    () => Boolean(project?.currentSpecVersionId || project?.confirmedSpecAt),
    [project?.currentSpecVersionId, project?.confirmedSpecAt]
  );

  const gitVals = useMemo((): GitLinkDraft => {
    if (!executionSetup) return gitLinkDraft;
    return {
      gitRepoUrl: executionSetup.gitRepoUrl ?? "",
      gitRepoProvider: executionSetup.gitRepoProvider ?? "github",
      gitRepoName: executionSetup.gitRepoName ?? "",
      baseBranch: executionSetup.baseBranch || "main",
    };
  }, [executionSetup, gitLinkDraft]);

  const setGitField = useCallback(
    (patch: Partial<GitLinkDraft>) => {
      if (executionSetup) {
        setExecutionSetup((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...patch };
          if (patch.gitRepoName !== undefined) {
            next.gitRepoName = patch.gitRepoName.trim() ? patch.gitRepoName.trim() : null;
          }
          return next;
        });
      } else {
        setGitLinkDraft((d) => ({ ...d, ...patch }));
      }
    },
    [executionSetup]
  );

  const applyGithubExample = useCallback(() => {
    const ex: GitLinkDraft = {
      gitRepoUrl: "https://github.com/your-org/my-ai-chat",
      gitRepoProvider: "github",
      gitRepoName: "your-org/my-ai-chat",
      baseBranch: "main",
    };
    if (executionSetup) {
      setExecutionSetup((prev) =>
        prev
          ? {
              ...prev,
              ...ex,
              gitRepoName: ex.gitRepoName,
            }
          : prev
      );
    } else {
      setGitLinkDraft(ex);
    }
    setExecutionMessage("예시 값을 채웠습니다. 저장 후 저장소 연결 검증을 실행하세요.");
  }, [executionSetup]);

  const handleSaveGit = useCallback(async () => {
    if (!projectId.trim()) return;
    setBusyGit("save");
    try {
      const { res, json } = await patchExecutionSetup(projectId, {
        gitRepoUrl: gitVals.gitRepoUrl,
        gitRepoProvider: gitVals.gitRepoProvider,
        gitRepoName: gitVals.gitRepoName.trim() || null,
        baseBranch: gitVals.baseBranch,
      });
      if (!res.ok || !json.success || !json.data) {
        setExecutionMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      setExecutionSetup(json.data);
      setExecutionMessage("저장했습니다. 저장소 연결 검증을 실행할 수 있습니다.");
    } finally {
      setBusyGit(null);
    }
  }, [projectId, gitVals]);

  const handleValidateGit = useCallback(async () => {
    if (!projectId.trim()) return;
    if (!executionSetup) {
      setExecutionMessage("먼저 저장소 설정을 저장하세요.");
      return;
    }
    setBusyGit("validate");
    try {
      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "repository" });
      if (!res.ok || !json.success) {
        setExecutionMessage(json.message || "저장소 검증에 실패했습니다.");
        return;
      }
      if (json.data) {
        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
      }
      const detail = (json.data?.messages ?? []).join(" / ");
      setExecutionMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
    } finally {
      setBusyGit(null);
    }
  }, [projectId, executionSetup]);

  if (!projectId.trim()) return null;

  const repoS = repoConnectionStatus(executionSetup?.repoConnectionOk);
  const hasSavedRepo = Boolean(executionSetup?.gitRepoUrl?.trim());
  const summaryRepoLabel =
    gitVals.gitRepoName.trim() ||
    (gitVals.gitRepoUrl.trim()
      ? gitVals.gitRepoUrl.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "")
      : "");

  const secondaryBtn: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#fff",
    fontWeight: 600,
    fontSize: 12,
    cursor: canEdit ? "pointer" : "not-allowed",
  };

  return (
    <div data-ui-label="[P-6-4] Git 탭 — 연동·실행 환경">
      <section
        data-testid="project-git-integration-panel"
        data-ui-label="[P-6-4a] Git 탭 — 저장소 연결"
        style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 12, background: "#fff" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <WorkspaceLabelBadge section="gitIntegration" />
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0f172a" }}>Git 연동</h2>
        </div>
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          저장소 URL과 베이스 브랜치를 연결합니다. 저장 후 <strong>저장소 연결 검증</strong>으로 접근 가능 여부를 확인합니다. 브랜치
          전략·실행 정책은 <strong>실행 환경 설정</strong>에서 관리합니다.
        </p>

        {/* A. 연결 상태 요약 */}
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #bae6fd",
            background: "#f0f9ff",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 12, color: "#0c4a6e", marginBottom: 8 }}>연결 상태 요약</div>
          {hasSavedRepo ? (
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <div>
                <span style={{ color: "#64748b" }}>연결 저장소: </span>
                <strong>{summaryRepoLabel || gitVals.gitRepoUrl}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>베이스 브랜치: </span>
                <strong>{gitVals.baseBranch || "main"}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: "#64748b" }}>상태: </span>
                <span style={{ color: repoConnectionToneColor(repoS.tone), fontWeight: 800 }}>{repoS.label}</span>
                {executionSetup?.repoValidatedAt ? (
                  <span style={{ color: "#64748b", fontWeight: 500 }}>
                    {" "}
                    · {formatTestedAt(executionSetup.repoValidatedAt)}
                  </span>
                ) : null}
              </div>
              {executionSetup?.repoValidationError ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                  {executionSetup.repoValidationError}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#64748b" }}>아직 연결된 저장소가 없습니다.</div>
          )}
        </div>

        {/* B. 저장소 연결 설정 */}
        <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>저장소 연결 설정</div>
        <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
          예: {PLACEHOLDERS.gitRepoUrl} · full name {PLACEHOLDERS.gitRepoName} · {PLACEHOLDERS.baseBranch}
        </p>
        <div style={{ display: "grid", gap: 10, maxWidth: 720, marginBottom: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>저장소 URL</span>
            <input
              value={gitVals.gitRepoUrl}
              disabled={!canEdit}
              placeholder={PLACEHOLDERS.gitRepoUrl}
              onChange={(e) => setGitField({ gitRepoUrl: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>호스팅 제공자</span>
            <select
              value={gitVals.gitRepoProvider}
              disabled={!canEdit}
              onChange={(e) => setGitField({ gitRepoProvider: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            >
              <option value="github">GitHub</option>
              <option value="other">기타</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>저장소 full name (owner/repo)</span>
            <input
              value={gitVals.gitRepoName}
              disabled={!canEdit}
              placeholder={PLACEHOLDERS.gitRepoName}
              onChange={(e) => setGitField({ gitRepoName: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>베이스 브랜치</span>
            <input
              value={gitVals.baseBranch}
              disabled={!canEdit}
              placeholder={PLACEHOLDERS.baseBranch}
              onChange={(e) => setGitField({ baseBranch: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </label>
        </div>

        {/* C. 저장/검증 액션 */}
        <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>저장 / 검증</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            disabled={!canEdit || busyGit === "save"}
            onClick={() => void handleSaveGit()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : busyGit === "save" ? "wait" : "pointer",
            }}
          >
            {busyGit === "save" ? "저장 중…" : "저장소 설정 저장"}
          </button>
          <button
            type="button"
            disabled={!canEdit || busyGit === "validate" || !executionSetup}
            onClick={() => void handleValidateGit()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit || !executionSetup ? "not-allowed" : busyGit === "validate" ? "wait" : "pointer",
            }}
            title={!executionSetup ? "먼저 저장하세요" : undefined}
          >
            {busyGit === "validate" ? "검증 중…" : "저장소 연결 검증"}
          </button>
          <button type="button" disabled={!canEdit} onClick={() => void applyGithubExample()} style={secondaryBtn}>
            GitHub 예시 적용
          </button>
        </div>
      </section>

      <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        저장소 연결이 되면 아래 <strong>실행 환경 설정</strong>에서 Cursor API와 실행 정책을 설정합니다.
      </p>

      <ExecutionSetupPanel
        projectId={projectId}
        canEdit={canEdit}
        specWorkflowConfirmed={specWorkflowConfirmed}
        executionSetup={executionSetup}
        setExecutionSetup={setExecutionSetup}
        setMessage={setExecutionMessage}
        formatTestedAt={formatTestedAt}
        flatLayout
      />

      {executionMessage ? (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "#334155" }} role="status">
          {executionMessage}
        </p>
      ) : null}
    </div>
  );
}
