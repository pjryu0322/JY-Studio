"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchExecutionSetup, patchExecutionSetup, postExecutionSetupValidate } from "@/components/project-spec/api";
import { mergeValidateIntoSetup, type ValidateResponseData } from "@/components/project-spec/executionSetupValidateMerge";
import { ExecutionSetupPanel } from "@/components/project-spec/ExecutionSetupPanel";
import { formatTestedAt } from "@/components/project-spec/format";
import type { Project } from "@/components/project-spec/types";

type Props = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
  /** 프로젝트 OWNER만 저장된 Cursor API 키 일시 표시 */
  canRevealCursorApiKey?: boolean;
};

const PLACEHOLDERS = {
  gitRepoUrl: "https://github.com/조직이름/저장소이름",
  gitRepoName: "조직이름/저장소이름",
  baseBranch: "main",
} as const;

function toneColor(tone: "muted" | "ok" | "bad" | "warn"): string {
  if (tone === "ok") return "#15803d";
  if (tone === "bad") return "#b91c1c";
  if (tone === "warn") return "#b45309";
  return "#64748b";
}

function readinessConnection(ok: boolean | null | undefined): string {
  if (ok === true) return "정상";
  if (ok === false) return "실패";
  return "미검증";
}

function readinessTone(ok: boolean | null | undefined): "muted" | "ok" | "bad" | "warn" {
  if (ok === true) return "ok";
  if (ok === false) return "bad";
  return "warn";
}

type GitLinkDraft = {
  gitRepoUrl: string;
  gitRepoProvider: string;
  gitRepoName: string;
  baseBranch: string;
};

const stepBox: CSSProperties = {
  marginBottom: 14,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

export function ProjectExecutionEnvironmentPanel({
  projectId,
  project,
  canEdit,
  canRevealCursorApiKey = false,
}: Props) {
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
  const [busyGit, setBusyGit] = useState<"save" | "validate-repo" | null>(null);

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
    setExecutionMessage("예시를 채웠습니다. 저장 후 검증하세요.");
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
      setExecutionMessage("저장했습니다.");
    } finally {
      setBusyGit(null);
    }
  }, [projectId, gitVals]);

  const handleValidateGit = useCallback(async () => {
    if (!projectId.trim()) return;
    if (!executionSetup) {
      setExecutionMessage("먼저 저장하세요.");
      return;
    }
    setBusyGit("validate-repo");
    try {
      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "repository" });
      if (!res.ok || !json.success) {
        setExecutionMessage(json.message || "검증에 실패했습니다.");
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

  const repoOk = executionSetup?.repoConnectionOk ?? null;
  const cursorApiOk = executionSetup?.cursorApiConnectionOk ?? null;
  const execOk = executionSetup?.executorConnectionOk ?? null;
  const executionReady = repoOk === true && cursorApiOk === true && execOk === true;

  const canRunLabel = executionReady
    ? "준비 완료"
    : repoOk === false || cursorApiOk === false || execOk === false
      ? "불가"
      : "미검증";
  const canRunTone: "ok" | "bad" | "warn" = executionReady
    ? "ok"
    : repoOk === false || cursorApiOk === false || execOk === false
      ? "bad"
      : "warn";

  const secondaryBtn: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#fff",
    fontWeight: 600,
    fontSize: 12,
    cursor: canEdit ? "pointer" : "not-allowed",
  };

  const gitConnectionSlot = (
    <div style={{ ...stepBox, marginBottom: 0 }}>
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b" }}>저장소 연결을 확인합니다.</p>
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
            예: {PLACEHOLDERS.gitRepoUrl} · {PLACEHOLDERS.gitRepoName} · {PLACEHOLDERS.baseBranch}
          </p>
          <div style={{ display: "grid", gap: 10, maxWidth: 720, marginBottom: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Repository URL</span>
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
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Repository full name (owner/repo)</span>
              <input
                value={gitVals.gitRepoName}
                disabled={!canEdit}
                placeholder={PLACEHOLDERS.gitRepoName}
                onChange={(e) => setGitField({ gitRepoName: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Base branch</span>
              <input
                value={gitVals.baseBranch}
                disabled={!canEdit}
                placeholder={PLACEHOLDERS.baseBranch}
                onChange={(e) => setGitField({ baseBranch: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              />
            </label>
          </div>
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
              disabled={!canEdit || busyGit === "validate-repo" || !executionSetup}
              onClick={() => void handleValidateGit()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: !canEdit || !executionSetup ? "not-allowed" : busyGit === "validate-repo" ? "wait" : "pointer",
              }}
              title={!executionSetup ? "먼저 저장하세요" : undefined}
            >
              {busyGit === "validate-repo" ? "검증 중…" : "저장소 연결 검증"}
            </button>
            <button type="button" disabled={!canEdit} onClick={() => void applyGithubExample()} style={secondaryBtn}>
              GitHub 예시 적용
            </button>
          </div>
    </div>
  );

  return (
    <div
      data-testid="project-execution-environment-panel"
      data-ui-label="[P-6-4] 실행 환경 — 연결·정책·검증"
      style={{ marginBottom: 8 }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a" }}>
          실행 환경 <span style={{ fontWeight: 600, color: "#64748b", fontSize: 16 }}>(Execution Environment)</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          Git·Cursor·실행 정책·검증을 한 탭에서 설정하면 실행 준비 상태를 바로 확인할 수 있습니다.
        </p>
      </header>

      <div
        style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 12,
          border: "1px solid #bae6fd",
          background: "#f0f9ff",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 13, color: "#0c4a6e", marginBottom: 10 }}>실행 준비 상태</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#0f172a", lineHeight: 1.7 }}>
          <li>
            <span style={{ color: "#64748b" }}>저장소 연결:</span>{" "}
            <strong style={{ color: toneColor(readinessTone(repoOk)) }}>{readinessConnection(repoOk)}</strong>
          </li>
          <li>
            <span style={{ color: "#64748b" }}>Cursor 연결:</span>{" "}
            <strong style={{ color: toneColor(readinessTone(cursorApiOk)) }}>{readinessConnection(cursorApiOk)}</strong>
          </li>
          <li>
            <span style={{ color: "#64748b" }}>실행 가능 여부:</span>{" "}
            <strong style={{ color: toneColor(canRunTone) }}>{canRunLabel}</strong>
          </li>
        </ul>
      </div>

      <ExecutionSetupPanel
        projectId={projectId}
        canEdit={canEdit}
        specWorkflowConfirmed={specWorkflowConfirmed}
        executionSetup={executionSetup}
        setExecutionSetup={setExecutionSetup}
        setMessage={setExecutionMessage}
        formatTestedAt={formatTestedAt}
        flatLayout
        unifiedExecutionEnvironment
        connectionSlotBeforeCursor={gitConnectionSlot}
        canRevealCursorApiKey={canRevealCursorApiKey}
      />

      {executionMessage ? (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "#334155" }} role="status">
          {executionMessage}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated 프로젝트 설정은 `ProjectExecutionEnvironmentPanel`을 사용하세요. */
export const ProjectGitIntegrationPanel = ProjectExecutionEnvironmentPanel;
