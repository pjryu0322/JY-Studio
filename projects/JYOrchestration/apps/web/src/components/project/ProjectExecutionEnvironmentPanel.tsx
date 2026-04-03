"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  fetchEnvironmentTestLast,
  fetchExecutionSetup,
  patchExecutionSetup,
  postEnvironmentTestRun,
  postExecutionSetupValidate,
  postRevealGithubAccessToken,
  type EnvironmentTestLastDto,
} from "@/components/project-spec/api";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
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

function normalizeWorkflowForUi(w: string | null | undefined): string {
  return String(w ?? "").trim().toLowerCase();
}

function environmentTestWorkflowLabel(wf: string | null | undefined): string {
  const w = normalizeWorkflowForUi(wf);
  if (!w) return "알 수 없음";
  if (w === EXECUTION_WORKFLOW.MERGED) return "머지 완료";
  if (w === EXECUTION_WORKFLOW.PR_OPENED) return "PR 생성 완료";
  if (w === EXECUTION_WORKFLOW.REVIEW_PENDING) return "리뷰 대기";
  if (w === EXECUTION_WORKFLOW.REVIEW_APPROVED) return "리뷰 통과";
  if (w === EXECUTION_WORKFLOW.REVIEW_REJECTED) return "리뷰 실패";
  if (w === EXECUTION_WORKFLOW.SECURITY_PENDING) return "Security 대기";
  if (w === EXECUTION_WORKFLOW.SECURITY_PASSED) return "Security 통과";
  if (w === EXECUTION_WORKFLOW.SECURITY_FAILED) return "Security 실패";
  if (w === EXECUTION_WORKFLOW.SCM_PENDING) return "SCM 대기";
  if (w === EXECUTION_WORKFLOW.MERGE_PENDING) return "SCM 머지 대기";
  if (w === EXECUTION_WORKFLOW.MERGE_BLOCKED) return "merge 차단";
  if (w === EXECUTION_WORKFLOW.VERIFY_FAILED) return "verify 실패";
  if (w === EXECUTION_WORKFLOW.PENDING_APPLY) return "GitHub 반영 확인 중";
  if (w === EXECUTION_WORKFLOW.FAILED) return "실패";
  if (w === EXECUTION_WORKFLOW.COMMITTED) return "푸시 확인됨 (PR 처리 중)";
  if (w === EXECUTION_WORKFLOW.REVIEWING) return "검토·동기화 중";
  if (w === EXECUTION_WORKFLOW.RUNNING) return "실행 중";
  return wf ?? w;
}

/** 내부 워크플로 값(예: pr_opened) — 보조 표기용 */
function stage2BottleneckLabel(stage: string | null | undefined): string {
  const s = String(stage ?? "").trim();
  if (!s) return "—";
  const map: Record<string, string> = {
    executor: "Executor(OpenAI)",
    cursor: "Cursor",
    branchDetect: "브랜치 반영",
    prCreation: "PR 생성",
    review: "Reviewer",
    security: "Security",
    scm: "SCM",
    merge: "Merge+Verify",
    mergeVerify: "Merge verify",
  };
  return map[s] ?? s;
}

function environmentTestWorkflowInternalCode(wf: string | null | undefined): string | null {
  const w = normalizeWorkflowForUi(wf);
  if (w === EXECUTION_WORKFLOW.PR_OPENED) return "pr_opened";
  if (w === EXECUTION_WORKFLOW.MERGED) return "merged";
  return null;
}

function environmentTestTaskStatusKorean(taskStatus: string | undefined): string | null {
  const s = String(taskStatus ?? "").trim();
  if (!s || s === "TODO") return null;
  if (s === "MERGED") return "머지됨";
  if (s === "DONE") return "완료";
  if (s === "IN_PROGRESS") return "진행 중";
  return s;
}

function environmentTestStatusMessage(wf: string | null | undefined, taskStatus: string | undefined): string {
  const w = normalizeWorkflowForUi(wf);
  const ts = String(taskStatus ?? "").trim();
  if (w === EXECUTION_WORKFLOW.FAILED) return "환경 연결 테스트에 실패했습니다";
  if (w === EXECUTION_WORKFLOW.MERGED) return "머지 완료";
  if (w === EXECUTION_WORKFLOW.PR_OPENED) return "테스트 PR 생성이 완료되었습니다";
  if (w === EXECUTION_WORKFLOW.PENDING_APPLY) {
    return "GitHub 반영 확인 중";
  }
  if (w === EXECUTION_WORKFLOW.COMMITTED || w === EXECUTION_WORKFLOW.REVIEWING) {
    return "PR 생성 중";
  }
  if (w === EXECUTION_WORKFLOW.RUNNING || w === normalizeWorkflowForUi(EXECUTION_WORKFLOW.REVIEW_PENDING)) {
    return "실행 중";
  }
  if (ts === "MERGED") return "머지 완료";
  if (ts === "DONE") return "테스트 PR 생성이 완료되었습니다";
  return "마지막 연결 테스트 상태를 확인하세요.";
}

/** PR_OPENED 이후 후속 자동 진행 한 줄 요약(중복 '다음 Task' 문구 없음) */
function environmentTestFollowUpLine(last: EnvironmentTestLastDto): string | null {
  const wf = normalizeWorkflowForUi(last.workflowStatus);
  if (wf !== EXECUTION_WORKFLOW.PR_OPENED && wf !== EXECUTION_WORKFLOW.MERGED) return null;
  const mergeInProgress = wf === EXECUTION_WORKFLOW.PR_OPENED && Boolean(last.envTestMergeStartedAt) && !last.mergedAt;
  if (mergeInProgress) return null;
  if (last.nextTaskReady === true) {
    return "후속 작업을 바로 시작할 수 있습니다.";
  }
  if (last.nextTaskBlockedReason) {
    return last.nextTaskBlockedReason;
  }
  if (last.nextTaskId) {
    return "후속 작업은 아직 시작 조건을 충족하지 않습니다.";
  }
  return "이어서 자동으로 시작할 작업이 없습니다.";
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
  const [envTestLast, setEnvTestLast] = useState<EnvironmentTestLastDto | null>(null);
  const [envTestLastStage2, setEnvTestLastStage2] = useState<EnvironmentTestLastDto | null>(null);
  const [busyEnvTest, setBusyEnvTest] = useState(false);
  const [busyEnvTestStage2, setBusyEnvTestStage2] = useState(false);
  const [busyGithubAuth, setBusyGithubAuth] = useState<"save" | "validate" | "delete" | "reveal" | null>(null);
  const [githubTokenDraft, setGithubTokenDraft] = useState("");
  const [githubReplaceMode, setGithubReplaceMode] = useState(false);
  const [githubTokenRevealPlaintext, setGithubTokenRevealPlaintext] = useState<string | null>(null);

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

  const loadEnvTestLast = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchEnvironmentTestLast(projectId);
      if (res.ok && json.success && json.data) {
        setEnvTestLast(json.data.last ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  const loadEnvTestLastStage2 = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchEnvironmentTestLast(projectId, { stage: 2 });
      if (res.ok && json.success && json.data) {
        setEnvTestLastStage2(json.data.last ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    void loadEnvTestLast();
    void loadEnvTestLastStage2();
  }, [loadEnvTestLast, loadEnvTestLastStage2]);

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

  const handleEnvironmentTest = useCallback(async () => {
    if (!projectId.trim()) return;
    setBusyEnvTest(true);
    try {
      const { res, json } = await postEnvironmentTestRun(projectId);
      const apiSuccess = Boolean(json.success);
      if (json.data?.last != null) {
        setEnvTestLast(json.data.last);
      } else {
        await loadEnvTestLast();
      }
      if (!res.ok || !apiSuccess) {
        setExecutionMessage(
          (typeof json.message === "string" && json.message.trim()) ||
            (res.status === 422
              ? "연결 테스트를 시작하거나 완료하지 못했습니다."
              : "연결 테스트 요청이 실패했습니다.")
        );
        return;
      }
      setExecutionMessage(
        (typeof json.message === "string" && json.message.trim()) || "연결 테스트를 완료했습니다."
      );
    } finally {
      setBusyEnvTest(false);
    }
  }, [projectId, loadEnvTestLast]);

  const handleEnvironmentTestStage2 = useCallback(async () => {
    if (!projectId.trim()) return;
    setBusyEnvTestStage2(true);
    try {
      const { res, json } = await postEnvironmentTestRun(projectId, { stage: 2 });
      const apiSuccess = Boolean(json.success);
      if (json.data?.last != null) {
        setEnvTestLastStage2(json.data.last);
      } else {
        await loadEnvTestLastStage2();
      }
      if (!res.ok || !apiSuccess) {
        setExecutionMessage(
          (typeof json.message === "string" && json.message.trim()) ||
            (res.status === 422
              ? "Stage 2 테스트를 시작하거나 완료하지 못했습니다."
              : "Stage 2 요청이 실패했습니다.")
        );
        return;
      }
      setExecutionMessage(
        (typeof json.message === "string" && json.message.trim()) || "Stage 2 테스트가 완료되었습니다."
      );
    } finally {
      setBusyEnvTestStage2(false);
    }
  }, [projectId, loadEnvTestLastStage2]);

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
  const githubAuthOk = executionSetup?.githubAuthConnectionOk ?? null;
  const githubCap = executionSetup?.githubCapabilityValidation ?? null;
  /** PR 머지까지 포함한 스냅샷이 있고 operable일 때만 실행 준비에 반영 */
  const githubEffectiveOk =
    githubAuthOk === true && githubCap != null && githubCap.githubOperableOk === true;
  const cursorApiOk = executionSetup?.cursorApiConnectionOk ?? null;
  const execOk = executionSetup?.executorConnectionOk ?? null;
  const executionReady = repoOk === true && githubEffectiveOk && cursorApiOk === true && execOk === true;
  const baseBranchConfigured = Boolean(executionSetup?.baseBranch?.trim());
  const autoPushOn = executionSetup?.autoPush === true;
  const envTestStartOk = executionReady && baseBranchConfigured && autoPushOn;

  const canRunLabel = executionReady
    ? "준비 완료"
    : repoOk === false || githubEffectiveOk === false || cursorApiOk === false || execOk === false
      ? "불가"
      : "미검증";
  const canRunTone: "ok" | "bad" | "warn" = executionReady
    ? "ok"
    : repoOk === false || githubEffectiveOk === false || cursorApiOk === false || execOk === false
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

  const githubAuthSlot = (() => {
    const es = executionSetup;
    const hasTok = Boolean(es?.hasGithubAccessToken);
    const showInput = !hasTok || githubReplaceMode;
    const ghostBtn: CSSProperties = {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid #cbd5e1",
      background: "#fff",
      fontWeight: 800,
      fontSize: 12,
      cursor: !canEdit || busyGithubAuth ? "not-allowed" : "pointer",
    };
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>GitHub 인증</div>
        <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
          검증(다시 검증)은 서버에 저장된 토큰으로 수행됩니다. 토큰을 다시 입력할 필요가 없습니다. 권한 변경 시에는
          「새 토큰 교체」로 다시 저장하세요.
        </p>
        {showInput ? (
          <label style={{ display: "grid", gap: 4, marginBottom: 8, maxWidth: 720 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>GitHub Access Token</span>
            <input
              type="password"
              autoComplete="off"
              value={githubTokenDraft}
              disabled={!canEdit || !es}
              placeholder={githubReplaceMode ? "새 토큰 붙여넣기" : "ghp_… / github_pat_…"}
              onChange={(e) => setGithubTokenDraft(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
          </label>
        ) : (
          <div style={{ marginBottom: 10, fontSize: 12, color: "#334155", maxWidth: 720 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>저장된 토큰</div>
            <code
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                fontSize: 12,
                wordBreak: "break-all",
              }}
            >
              {githubTokenRevealPlaintext ?? es?.githubAccessTokenMasked ?? "—"}
            </code>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            disabled={!canEdit || !executionSetup || busyGithubAuth === "validate" || !executionSetup?.hasGithubAccessToken}
            title={!executionSetup?.hasGithubAccessToken ? "먼저 토큰을 저장하세요" : "저장된 토큰으로 GitHub 인증 검증"}
            onClick={async () => {
              if (!projectId.trim()) return;
              setBusyGithubAuth("validate");
              try {
                const { res, json } = await postExecutionSetupValidate(projectId, { scope: "github_auth" });
                if (!res.ok || !json.success) {
                  setExecutionMessage(json.message || "GitHub 인증 검증에 실패했습니다.");
                  return;
                }
                if (json.data) {
                  setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                }
                const detail = (json.data?.messages ?? []).join(" / ");
                setExecutionMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #0f766e",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : busyGithubAuth === "validate" ? "wait" : "pointer",
            }}
          >
            {busyGithubAuth === "validate" ? "검증 중…" : "다시 검증"}
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup || busyGithubAuth === "save"}
            onClick={async () => {
              if (!projectId.trim()) return;
              setBusyGithubAuth("save");
              try {
                const body: Parameters<typeof patchExecutionSetup>[1] = {};
                if (githubTokenDraft.trim()) body.githubAccessToken = githubTokenDraft.trim();
                const { res, json } = await patchExecutionSetup(projectId, body);
                if (!res.ok || !json.success || !json.data) {
                  setExecutionMessage(json.message || "저장에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setGithubTokenDraft("");
                setGithubReplaceMode(false);
                setGithubTokenRevealPlaintext(null);
                setExecutionMessage("GitHub 토큰을 저장했습니다. 「다시 검증」으로 연결을 확인할 수 있습니다.");
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : busyGithubAuth === "save" ? "wait" : "pointer",
            }}
          >
            {busyGithubAuth === "save" ? "저장 중…" : githubReplaceMode ? "새 토큰 저장" : "저장"}
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup || busyGithubAuth != null}
            onClick={() => {
              setGithubReplaceMode(true);
              setGithubTokenDraft("");
              setGithubTokenRevealPlaintext(null);
            }}
            style={ghostBtn}
          >
            새 토큰 교체
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup?.hasGithubAccessToken || busyGithubAuth != null}
            onClick={async () => {
              const ok = window.confirm("저장된 GitHub 토큰을 삭제합니다. 계속할까요?");
              if (!ok) return;
              if (!projectId.trim()) return;
              setBusyGithubAuth("delete");
              try {
                const { res, json } = await patchExecutionSetup(projectId, { githubAccessToken: null });
                if (!res.ok || !json.success || !json.data) {
                  setExecutionMessage(json.message || "삭제에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setGithubTokenDraft("");
                setGithubReplaceMode(false);
                setGithubTokenRevealPlaintext(null);
                setExecutionMessage("저장된 GitHub 토큰을 삭제했습니다.");
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{ ...ghostBtn, color: "#b91c1c", borderColor: "#fecaca" }}
          >
            {busyGithubAuth === "delete" ? "삭제 중…" : "삭제"}
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup?.hasGithubAccessToken || busyGithubAuth != null}
            onClick={async () => {
              if (!projectId.trim()) return;
              setBusyGithubAuth("reveal");
              try {
                const { res, json } = await postRevealGithubAccessToken(projectId);
                if (!res.ok || !json.success || !json.data?.plaintext) {
                  setExecutionMessage(json.message || "토큰을 표시할 수 없습니다. (프로젝트 소유자만 가능합니다.)");
                  return;
                }
                setGithubTokenRevealPlaintext(json.data.plaintext);
                setTimeout(() => setGithubTokenRevealPlaintext(null), 8000);
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={ghostBtn}
          >
            {busyGithubAuth === "reveal" ? "불러오는 중…" : "보기 / 숨기기"}
          </button>
        </div>

        {(() => {
          const cap = es?.githubCapabilityValidation;
          if (!cap) {
            if (es?.githubAuthValidatedAt && hasTok) {
              return (
                <p style={{ marginTop: 14, fontSize: 11, color: "#b45309", lineHeight: 1.55 }}>
                  세부 GitHub 권한(저장소/PR 조회/PR 생성/PR 머지) 스냅샷이 없습니다. 「다시 검증」으로 최신 권한을
                  확인하세요.
                </p>
              );
            }
            return null;
          }
          const okLabel = (v: boolean) => (v ? "정상" : "실패");
          return (
            <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.65, color: "#334155" }}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>권한 단계별 결과</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  저장소 접근: <strong>{okLabel(cap.repoAccessOk)}</strong>
                </li>
                <li>
                  PR 조회: <strong>{okLabel(cap.prReadOk)}</strong>
                </li>
                <li>
                  PR 생성 권한: <strong>{okLabel(cap.prCreateOk)}</strong>
                </li>
                <li>
                  PR 머지 권한: <strong>{okLabel(cap.prMergeOk)}</strong>
                </li>
                <li>
                  최종 GitHub 운영 가능: <strong>{cap.githubOperableOk ? "정상" : "실패"}</strong>
                </li>
              </ul>
              {cap.canonicalRepoGetAcceptedPermissions ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "#f8fafc",
                    borderRadius: 8,
                    fontSize: 10,
                    fontFamily: "ui-monospace, monospace",
                    wordBreak: "break-all",
                    color: "#334155",
                  }}
                >
                  GET /repos (기준) X-Accepted-GitHub-Permissions: {cap.canonicalRepoGetAcceptedPermissions}
                </div>
              ) : null}
              {cap.tokenSourceUsed != null ? (
                <div style={{ marginTop: 6, fontSize: 10, color: "#64748b" }}>
                  검증 시 토큰 출처: <strong>{String(cap.tokenSourceUsed).toUpperCase()}</strong>
                  {cap.validationEpoch != null ? ` · 검증 에포크: ${cap.validationEpoch}` : null}
                </div>
              ) : null}
              {!cap.githubOperableOk ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    background: "#fef2f2",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#7f1d1d",
                    lineHeight: 1.55,
                  }}
                >
                  {cap.tokenMismatchHintKr ? (
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>{cap.tokenMismatchHintKr}</div>
                  ) : null}
                  {cap.lastErrorMessage ? <div>{cap.lastErrorMessage}</div> : null}
                  {cap.lastHttpStatus != null ? <div style={{ marginTop: 4 }}>HTTP {cap.lastHttpStatus}</div> : null}
                  {cap.acceptedPermissionsHeader ? (
                    <div style={{ marginTop: 4, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                      X-Accepted-GitHub-Permissions: {cap.acceptedPermissionsHeader}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })()}
      </div>
    );
  })();

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
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
              AI, Cursor, Git 연동이 정상인지 간단한 테스트 Task와 PR 생성으로 확인합니다.
            </p>
            <button
              type="button"
              disabled={!canEdit || busyEnvTest || busyEnvTestStage2 || !specWorkflowConfirmed || !envTestStartOk}
              onClick={() => void handleEnvironmentTest()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor:
                  !canEdit || busyEnvTest || busyEnvTestStage2 || !specWorkflowConfirmed || !envTestStartOk
                    ? "not-allowed"
                    : "pointer",
              }}
              title={
                !specWorkflowConfirmed
                  ? "Spec 확정 후 사용"
                  : !executionReady
                    ? "저장소·Cursor 검증 완료 필요"
                    : !baseBranchConfigured
                      ? "기본 브랜치 설정이 필요합니다"
                      : !autoPushOn
                        ? "ENV_TEST는 Push 가능한 실행 정책에서만 실행할 수 있습니다"
                        : undefined
              }
            >
              {busyEnvTest ? "실행 중…" : "연결 테스트 실행 (Stage 1)"}
            </button>
            <button
              type="button"
              disabled={!canEdit || busyEnvTest || busyEnvTestStage2 || !specWorkflowConfirmed || !envTestStartOk}
              onClick={() => void handleEnvironmentTestStage2()}
              style={{
                marginLeft: 8,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #5b21b6",
                background: "#6d28d9",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor:
                  !canEdit || busyEnvTest || busyEnvTestStage2 || !specWorkflowConfirmed || !envTestStartOk
                    ? "not-allowed"
                    : "pointer",
              }}
              title="리뷰 PASS 후에만 머지되는 Stage 2 readiness"
            >
              {busyEnvTestStage2 ? "실행 중…" : "Stage 2 (리뷰→SCM)"}
            </button>
            {!specWorkflowConfirmed ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>Spec 확정 후 사용할 수 있습니다.</p>
            ) : null}
            {specWorkflowConfirmed && !executionReady ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>
                저장소·Cursor 검증을 모두 통과한 뒤 실행하세요.
              </p>
            ) : null}
            {specWorkflowConfirmed && executionReady && !baseBranchConfigured ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>기본 브랜치 설정이 필요합니다.</p>
            ) : null}
            {specWorkflowConfirmed && executionReady && baseBranchConfigured && !autoPushOn ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>
                ENV_TEST는 Push 가능한 실행 정책에서만 실행할 수 있습니다.
              </p>
            ) : null}
            {envTestLast ? (
              <div style={{ marginTop: 12, fontSize: 11, color: "#334155", lineHeight: 1.65 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>최근 결과</div>
                <div>
                  {normalizeWorkflowForUi(envTestLast.workflowStatus) === EXECUTION_WORKFLOW.PR_OPENED &&
                  envTestLast.envTestMergeStartedAt &&
                  !envTestLast.mergedAt
                    ? "머지 진행 중"
                    : environmentTestStatusMessage(envTestLast.workflowStatus, envTestLast.taskStatus)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: "#64748b" }}>작업 이름</span> {envTestLast.name}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>상태</span>{" "}
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    {environmentTestWorkflowLabel(envTestLast.workflowStatus)}
                  </span>
                  {(() => {
                    const code = environmentTestWorkflowInternalCode(envTestLast.workflowStatus);
                    return code ? (
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}> · {code}</span>
                    ) : null;
                  })()}
                  {(() => {
                    const tk = environmentTestTaskStatusKorean(envTestLast.taskStatus);
                    return tk ? (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}> · 작업 {tk}</span>
                    ) : null;
                  })()}
                </div>
                {envTestLast.branchName ? (
                  <div>
                    <span style={{ color: "#64748b" }}>브랜치</span> {envTestLast.branchName}
                  </div>
                ) : null}
                {envTestLast.prUrl ? (
                  <div>
                    <span style={{ color: "#64748b" }}>PR</span>{" "}
                    <a href={envTestLast.prUrl} target="_blank" rel="noreferrer">
                      링크 열기
                    </a>
                  </div>
                ) : null}
                {normalizeWorkflowForUi(envTestLast.workflowStatus) === EXECUTION_WORKFLOW.PR_OPENED ? (
                  <div>
                    <span style={{ color: "#64748b" }}>머지</span>{" "}
                    {envTestLast.envTestMergeBlockedReason ? (
                      <span style={{ fontWeight: 800, color: "#b91c1c" }}>차단됨</span>
                    ) : envTestLast.envTestMergeStartedAt ? (
                      <span style={{ fontWeight: 700 }}>진행 중</span>
                    ) : (
                      <span style={{ fontWeight: 600 }}>대기 (자동 머지 진행)</span>
                    )}
                    {envTestLast.envTestMergeBlockedReason ? (
                      <div style={{ marginTop: 4, color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
                        머지 차단 사유: {envTestLast.envTestMergeBlockedReason}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {normalizeWorkflowForUi(envTestLast.workflowStatus) === EXECUTION_WORKFLOW.MERGED ? (
                  <div>
                    <span style={{ color: "#64748b" }}>머지</span>{" "}
                    <span style={{ fontWeight: 700, color: "#15803d" }}>완료</span>
                    {envTestLast.mergeCommitSha ? (
                      <span style={{ marginLeft: 6, color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>
                        {envTestLast.mergeCommitSha.slice(0, 7)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {envTestLast.mergedAt ? (
                  <div>
                    <span style={{ color: "#64748b" }}>머지 시각</span> {formatTestedAt(envTestLast.mergedAt)}
                  </div>
                ) : null}
                {envTestLast.envTestRemoteBranchDeletedAt ? (
                  <div style={{ color: "#15803d", fontWeight: 700 }}>
                    브랜치 정리가 완료되었습니다 ({formatTestedAt(envTestLast.envTestRemoteBranchDeletedAt)})
                  </div>
                ) : null}
                {(() => {
                  const line = environmentTestFollowUpLine(envTestLast);
                  if (!line) return null;
                  return (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ color: "#64748b" }}>후속 진행</span>{" "}
                      <span style={{ color: "#334155" }}>{line}</span>
                      {envTestLast.nextTaskReady === true && envTestLast.nextTaskName ? (
                        <span style={{ fontSize: 11, color: "#64748b" }}> · {envTestLast.nextTaskName}</span>
                      ) : null}
                    </div>
                  );
                })()}
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  업데이트 {formatTestedAt(envTestLast.updatedAt)}
                </div>
              </div>
            ) : null}
            {envTestLastStage2 ? (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #cbd5e1", fontSize: 11, color: "#334155" }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Stage 2 (역할 분리)</div>
                <div>
                  <span style={{ color: "#64748b" }}>단계</span>{" "}
                  <span style={{ fontWeight: 700 }}>{environmentTestWorkflowLabel(envTestLastStage2.workflowStatus)}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>리뷰</span>{" "}
                  {envTestLastStage2.stage2ReviewerResult ? (
                    <span style={{ fontWeight: 800, color: envTestLastStage2.stage2ReviewerResult === "PASS" ? "#15803d" : "#b91c1c" }}>
                      {envTestLastStage2.stage2ReviewerResult}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                  {envTestLastStage2.stage2ReviewerReason ? (
                    <span style={{ marginLeft: 6, color: "#64748b" }}>{envTestLastStage2.stage2ReviewerReason}</span>
                  ) : null}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Security</span>{" "}
                  {envTestLastStage2.stage2SecurityResult ? (
                    <span
                      style={{
                        fontWeight: 800,
                        color: envTestLastStage2.stage2SecurityResult === "PASS" ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {envTestLastStage2.stage2SecurityResult}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                  {envTestLastStage2.stage2SecurityReason ? (
                    <span style={{ marginLeft: 6, color: "#64748b" }}>{envTestLastStage2.stage2SecurityReason}</span>
                  ) : null}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>SCM</span>{" "}
                  {envTestLastStage2.stage2ScmResult ? (
                    <span style={{ fontWeight: 800 }}>{envTestLastStage2.stage2ScmResult}</span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                  {envTestLastStage2.stage2ScmReason ? (
                    <span style={{ marginLeft: 6, color: "#64748b" }}>{envTestLastStage2.stage2ScmReason}</span>
                  ) : null}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>총 시간</span>{" "}
                  {typeof envTestLastStage2.stage2TotalTimeMs === "number" ? (
                    <span style={{ fontWeight: 700 }}>{`${(envTestLastStage2.stage2TotalTimeMs / 1000).toFixed(1)}s`}</span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>병목 Top1</span>{" "}
                  {envTestLastStage2.stage2TopBottleneckStage ? (
                    <span style={{ fontWeight: 700 }}>
                      {stage2BottleneckLabel(envTestLastStage2.stage2TopBottleneckStage)}
                      {typeof envTestLastStage2.stage2TopBottleneckMs === "number"
                        ? ` (${envTestLastStage2.stage2TopBottleneckMs}ms)`
                        : ""}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </div>
                {normalizeWorkflowForUi(envTestLastStage2.workflowStatus) === EXECUTION_WORKFLOW.MERGED ? (
                  <div style={{ marginTop: 4, color: "#15803d", fontWeight: 700 }}>Stage 2 완료</div>
                ) : null}
              </div>
            ) : null}
          </div>
          {githubAuthSlot}
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
            <span style={{ color: "#64748b" }}>GitHub 인증:</span>{" "}
            <strong
              style={{
                color: toneColor(
                  githubEffectiveOk
                    ? "ok"
                    : githubAuthOk === false || (githubCap && !githubCap.githubOperableOk)
                      ? "bad"
                      : "warn"
                ),
              }}
            >
              {githubEffectiveOk
                ? "정상 (머지 권한 포함)"
                : githubAuthOk === false
                  ? "필요"
                  : githubAuthOk === true && !githubCap
                    ? "재검증 필요"
                    : githubCap && !githubCap.githubOperableOk
                      ? "권한 부족"
                      : "미검증"}
            </strong>
            {githubCap ? (
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, fontWeight: 500, color: "#334155" }}>
                <li>저장소 접근: {githubCap.repoAccessOk ? "정상" : "실패"}</li>
                <li>PR 조회: {githubCap.prReadOk ? "정상" : "실패"}</li>
                <li>PR 생성 권한: {githubCap.prCreateOk ? "정상" : "실패"}</li>
                <li>PR 머지 권한: {githubCap.prMergeOk ? "정상" : "실패"}</li>
                <li>최종 GitHub 운영: {githubCap.githubOperableOk ? "정상" : "실패"}</li>
              </ul>
            ) : null}
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
