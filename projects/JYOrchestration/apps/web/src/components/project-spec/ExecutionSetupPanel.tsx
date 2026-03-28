"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { patchExecutionSetup, postExecutionSetupValidate, type ExecutionSetupDto } from "@/components/project-spec/api";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import { WORKSPACE_SECTION_META } from "@/components/project-spec/workspaceSectionMeta";

type BusyKey = "save-repo" | "save-policy" | "val-repo" | "val-executor" | "val-all" | null;

const PLACEHOLDERS = {
  gitRepoUrl: "https://github.com/your-org/my-ai-chat",
  gitRepoName: "your-org/my-ai-chat",
  baseBranch: "main",
  globs: "src/**\napp/**\ntests/**",
} as const;

function connectionToneColor(tone: "muted" | "ok" | "bad" | "warn"): string {
  if (tone === "ok") return "#15803d";
  if (tone === "bad") return "#b91c1c";
  if (tone === "warn") return "#b45309";
  return "#64748b";
}

function connectionStatus(ok: boolean | null | undefined): { label: string; tone: "muted" | "ok" | "bad" | "warn" } {
  if (ok === true) return { label: "정상", tone: "ok" };
  if (ok === false) return { label: "실패", tone: "bad" };
  return { label: "검증 필요", tone: "warn" };
}

type ValidateResponseData = {
  status: ExecutionSetupDto["status"];
  lastValidatedAt: string | null;
  needsRevalidation?: boolean;
  lastValidationError?: string | null;
  repoConnectionOk?: boolean | null;
  executorConnectionOk?: boolean | null;
  repoValidatedAt?: string | null;
  executorValidatedAt?: string | null;
  repoValidationError?: string | null;
  executorValidationError?: string | null;
};

function mergeValidateIntoSetup(prev: ExecutionSetupDto, d: ValidateResponseData): ExecutionSetupDto {
  return {
    ...prev,
    status: d.status,
    lastValidatedAt: d.lastValidatedAt ?? prev.lastValidatedAt,
    needsRevalidation: d.needsRevalidation ?? prev.needsRevalidation,
    lastValidationError: d.lastValidationError ?? null,
    repoConnectionOk: d.repoConnectionOk ?? prev.repoConnectionOk ?? null,
    executorConnectionOk: d.executorConnectionOk ?? prev.executorConnectionOk ?? null,
    repoValidatedAt: d.repoValidatedAt ?? prev.repoValidatedAt ?? null,
    executorValidatedAt: d.executorValidatedAt ?? prev.executorValidatedAt ?? null,
    repoValidationError: d.repoValidationError ?? prev.repoValidationError ?? null,
    executorValidationError: d.executorValidationError ?? prev.executorValidationError ?? null,
  };
}

type PolicyRow = { key: keyof Pick<
  ExecutionSetupDto,
  | "autoCommit"
  | "autoPush"
  | "autoPr"
  | "requireApprovalBeforeApply"
  | "requireTestsBeforePush"
  | "dryRunAllowed"
  | "autoAdvanceToNextTask"
  | "stopOnTestFailure"
  | "stopOnRepeatedFailure"
  | "stopOnOutOfScopeChange"
  | "requireApprovalForSensitiveTasks"
>; label: string; help: string };

const POLICY_AUTO: PolicyRow[] = [
  {
    key: "autoCommit",
    label: "자동 커밋",
    help: "원격 Cursor Background Agent가 작업 후 커밋할지 여부입니다(저장소는 Git 원격 기준).",
  },
  { key: "autoPush", label: "자동 푸시", help: "커밋 후 원격 저장소로 자동 푸시할지 설정합니다." },
  { key: "autoPr", label: "자동 PR 생성", help: "브랜치 푸시 후 PR 생성까지 자동으로 이어갈지 정합니다." },
];

const POLICY_GATES: PolicyRow[] = [
  {
    key: "requireTestsBeforePush",
    label: "푸시 전 테스트 필수",
    help: "테스트·검증 단계를 통과하기 전에는 푸시하지 않도록 합니다.",
  },
  {
    key: "stopOnRepeatedFailure",
    label: "동일 실행/평가 오류 2회 연속 시 중단",
    help: "같은 오류가 반복되면 재시도를 멈추고 사람이 개입할 수 있게 합니다.",
  },
  {
    key: "stopOnOutOfScopeChange",
    label: "허용 경로 위반 또는 과다 변경 파일 시 중단",
    help: "허용 글로브 밖 파일이나 비정상적으로 많은 변경이 감지되면 실행을 중단합니다.",
  },
  {
    key: "stopOnTestFailure",
    label: "평가 결과에 테스트/빌드 실패 징후가 있으면 중단",
    help: "요약·평가 단계에서 테스트/빌드 실패 힌트가 보이면 즉시 실패 처리합니다.",
  },
];

const POLICY_APPROVAL: PolicyRow[] = [
  {
    key: "requireApprovalBeforeApply",
    label: "반영 전 승인 필요",
    help: "코드 반영(커밋/푸시 등) 전에 사람의 승인을 받습니다.",
  },
  {
    key: "requireApprovalForSensitiveTasks",
    label: "인증/비밀정보 관련 작업은 사람 승인 필요",
    help: "토큰·비밀번호·인증 등 민감해 보이는 작업은 자동 진행하지 않습니다.",
  },
  { key: "dryRunAllowed", label: "드라이런 허용", help: "실제 반영 없이 시뮬레이션·검토만 하는 흐름을 허용합니다." },
  {
    key: "autoAdvanceToNextTask",
    label: "검토 통과 시 다음 Task 자동 진행",
    help: "DAG에서 현재 작업이 통과하면 다음 준비된 Task로 자동 이어집니다.",
  },
];

export function ExecutionSetupPanel(props: {
  projectId: string;
  canEdit: boolean;
  specWorkflowConfirmed: boolean;
  executionSetup: ExecutionSetupDto | null | undefined;
  setExecutionSetup: Dispatch<SetStateAction<ExecutionSetupDto | null | undefined>>;
  setMessage: (msg: string | null) => void;
  formatTestedAt: (iso: string) => string;
}) {
  const { projectId, canEdit, specWorkflowConfirmed, executionSetup, setExecutionSetup, setMessage, formatTestedAt } =
    props;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);

  const applyGithubExample = useCallback(() => {
    setExecutionSetup((p) => {
      const base = p ?? ({} as ExecutionSetupDto);
      return {
        ...base,
        gitRepoUrl: "https://github.com/your-org/my-ai-chat",
        gitRepoProvider: "github",
        gitRepoName: "your-org/my-ai-chat",
        baseBranch: "main",
        allowedPathGlobs: ["src/**", "app/**", "tests/**"],
      } as ExecutionSetupDto;
    });
    setMessage("GitHub 예시 값을 폼에 채웠습니다. 저장 후 저장소·원격 실행 검증을 진행하세요.");
  }, [setExecutionSetup, setMessage]);

  const nr = executionSetup?.needsRevalidation ?? false;
  const ready = executionSetup?.status === "validated" && !nr;
  const repoS = connectionStatus(executionSetup?.repoConnectionOk);
  const execS = connectionStatus(executionSetup?.executorConnectionOk);

  const badgeLabelKr = executionSetup?.status === "invalid" ? "오류" : ready ? "준비됨" : "미완료";
  const badgeColors =
    ready
      ? { bg: "#dcfce7", fg: "#166534", bd: "#86efac" }
      : executionSetup?.status === "invalid"
        ? { bg: "#fee2e2", fg: "#991b1b", bd: "#fecaca" }
        : { bg: "#ffedd5", fg: "#9a3412", bd: "#fdba74" };
  const frameBorder =
    ready ? "2px solid #22c55e" : executionSetup?.status === "invalid" ? "2px solid #f87171" : "1px solid #e2e8f0";
  const frameBg = ready ? "#f0fdf4" : "#fff";

  if (!specWorkflowConfirmed) {
    return (
      <div
        data-ui-label="[F-1-3-6] Workspace — Execution Setup (locked)"
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <WorkspaceLabelBadge section="executionSetup" />
          <strong style={{ fontSize: 14 }}>{WORKSPACE_SECTION_META.executionSetup.title}</strong>
          <span style={{ fontSize: 12, color: "#64748b" }}>프로젝트 스펙이 확정된 뒤에 설정할 수 있습니다.</span>
        </div>
      </div>
    );
  }

  const es = executionSetup ?? null;

  return (
    <div
      data-ui-label="[F-1-3-6] Workspace — Execution Setup"
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        border: frameBorder,
        background: frameBg,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginBottom: open ? 10 : 6,
        }}
      >
        <WorkspaceLabelBadge section="executionSetup" />
        <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{WORKSPACE_SECTION_META.executionSetup.title}</h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.4,
            padding: "4px 8px",
            borderRadius: 8,
            border: `1px solid ${badgeColors.bd}`,
            background: badgeColors.bg,
            color: badgeColors.fg,
          }}
        >
          {badgeLabelKr}
        </span>
        <span style={{ fontSize: 12, fontWeight: 900, color: ready ? "#15803d" : "#b45309" }}>
          {ready ? "실행 준비 완료" : "실행 준비 안 됨"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>

      {!open ? (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          Cursor는 지정된 Git 저장소를 기준으로 원격에서 작업합니다. 저장소 연결과 원격 실행(릴레이) 검증이 모두 완료되면 실행 준비가
          됩니다.
        </p>
      ) : (
        <>
          {nr ? (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                color: "#92400e",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              설정이 바뀌었습니다. 변경된 영역은 다시 저장한 뒤 연결 검증을 진행해 주세요.
            </div>
          ) : null}

          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #bae6fd",
              background: "#f0f9ff",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 13, color: "#0c4a6e" }}>연결 상태 요약</div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <strong>저장소 상태:</strong>{" "}
              <span style={{ color: connectionToneColor(repoS.tone), fontWeight: 800 }}>{repoS.label}</span>
              {es?.repoValidatedAt ? (
                <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.repoValidatedAt)}</span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <strong>원격 실행(Relay) 상태:</strong>{" "}
              <span style={{ color: connectionToneColor(execS.tone), fontWeight: 800 }}>{execS.label}</span>
              {es?.executorValidatedAt ? (
                <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.executorValidatedAt)}</span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <strong>실행 준비 상태:</strong>{" "}
              <span style={{ color: ready ? "#15803d" : "#b45309", fontWeight: 800 }}>
                {ready ? "준비 완료" : "준비 안 됨"}
              </span>
              <span style={{ color: "#64748b", fontWeight: 500 }}> (저장소·원격 실행 검증이 모두 성공해야 완료)</span>
            </div>
            {(es?.repoValidationError || es?.executorValidationError) && (
              <div style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.45 }}>
                {es?.repoValidationError ? <div>저장소: {es.repoValidationError}</div> : null}
                {es?.executorValidationError ? <div>원격 실행: {es.executorValidationError}</div> : null}
              </div>
            )}
          </div>

          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
            Cursor는 지정된 Git 저장소를 기반으로 작업을 수행하며, 코드 수정 및 커밋/푸시는 원격 저장소에서 처리됩니다. 플랫폼은
            로컬에서 코드를 실행하지 않습니다. 저장소는 Git HTTP로, 원격 실행은 서버에 설정된 릴레이의{" "}
            <code style={{ fontSize: 12 }}>task-execute</code> 경로로 확인합니다.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setExamplesOpen((v) => !v)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #94a3b8",
                background: "#fff",
                fontWeight: 700,
                fontSize: 12,
                cursor: canEdit ? "pointer" : "not-allowed",
              }}
            >
              {examplesOpen ? "설정 예시 접기" : "설정 예시 보기"}
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => void applyGithubExample()}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: canEdit ? "#f5f3ff" : "#f1f5f9",
                fontWeight: 700,
                fontSize: 12,
                cursor: canEdit ? "pointer" : "not-allowed",
                color: "#5b21b6",
              }}
            >
              GitHub 예시 적용
            </button>
          </div>

          {examplesOpen ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: "1px dashed #94a3b8",
                background: "#f8fafc",
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.55,
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "pre-wrap",
              }}
            >
              {`저장소 URL: ${PLACEHOLDERS.gitRepoUrl}
저장소 full name: ${PLACEHOLDERS.gitRepoName}
베이스 브랜치: ${PLACEHOLDERS.baseBranch}

허용 경로 글로브(선택):
${PLACEHOLDERS.globs}`}
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fafafa" }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>
                Git 저장소 · Cursor (원격 실행)
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Cursor는 지정된 Git 저장소를 기반으로 작업을 수행하며, 코드 수정 및 커밋/푸시는 원격 저장소에서 처리됩니다. 저장소
                URL·브랜치·브랜치 전략과 선택적 허용 경로 글로브를 설정합니다.
              </p>
              <label style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>저장소 URL</span>
                <input
                  value={es?.gitRepoUrl ?? ""}
                  disabled={!canEdit}
                  placeholder={PLACEHOLDERS.gitRepoUrl}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), gitRepoUrl: e.target.value }))
                  }
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>호스팅 제공자</span>
                <select
                  value={es?.gitRepoProvider ?? "github"}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), gitRepoProvider: e.target.value }))
                  }
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                >
                  <option value="github">GitHub</option>
                  <option value="other">기타</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>저장소 full name (선택)</span>
                <input
                  value={es?.gitRepoName ?? ""}
                  disabled={!canEdit}
                  placeholder={PLACEHOLDERS.gitRepoName}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({
                      ...(p ?? ({} as ExecutionSetupDto)),
                      gitRepoName: e.target.value || null,
                    }))
                  }
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>베이스 브랜치</span>
                  <input
                    value={es?.baseBranch ?? "main"}
                    disabled={!canEdit}
                    placeholder={PLACEHOLDERS.baseBranch}
                    onChange={(e) =>
                      setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), baseBranch: e.target.value }))
                    }
                    style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>브랜치 전략</span>
                  <select
                    value={es?.branchStrategy ?? "manual"}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setExecutionSetup((p) => ({
                        ...(p ?? ({} as ExecutionSetupDto)),
                        branchStrategy: e.target.value as ExecutionSetupDto["branchStrategy"],
                      }))
                    }
                    style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                  >
                    <option value="feature-per-workflow">워크플로마다 기능 브랜치</option>
                    <option value="feature-per-task">작업마다 기능 브랜치</option>
                    <option value="manual">수동</option>
                  </select>
                </label>
              </div>
              <label style={{ display: "grid", gap: 4, marginTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>작업 브랜치 접두어 (선택)</span>
                <input
                  value={es?.branchPrefix ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({
                      ...(p ?? ({} as ExecutionSetupDto)),
                      branchPrefix: e.target.value || null,
                    }))
                  }
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, marginTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>허용 경로 글로브 (선택, 줄바꿈으로 구분)</span>
                <textarea
                  value={(es?.allowedPathGlobs ?? []).join("\n")}
                  disabled={!canEdit}
                  placeholder={PLACEHOLDERS.globs}
                  rows={3}
                  onChange={(e) => {
                    const raw = e.target.value
                      .split(/[\n,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), allowedPathGlobs: raw }));
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  disabled={!canEdit || busy === "save-repo"}
                  onClick={async () => {
                    if (!projectId || !es) return;
                    setBusy("save-repo");
                    try {
                      const { res, json } = await patchExecutionSetup(projectId, {
                        gitRepoUrl: es.gitRepoUrl,
                        gitRepoProvider: es.gitRepoProvider,
                        gitRepoName: es.gitRepoName,
                        baseBranch: es.baseBranch,
                        branchStrategy: es.branchStrategy,
                        branchPrefix: es.branchPrefix,
                        allowedPathGlobs: es.allowedPathGlobs ?? [],
                      });
                      if (!res.ok || !json.success || !json.data) {
                        setMessage(json.message || "저장에 실패했습니다.");
                        return;
                      }
                      setExecutionSetup(json.data);
                      setMessage("저장소·실행 범위 설정을 저장했습니다.");
                    } finally {
                      setBusy(null);
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
                    cursor: !canEdit ? "not-allowed" : busy === "save-repo" ? "wait" : "pointer",
                  }}
                >
                  {busy === "save-repo" ? "저장 중…" : "설정 저장"}
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy === "val-repo"}
                  onClick={async () => {
                    if (!projectId) return;
                    setBusy("val-repo");
                    try {
                      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "repository" });
                      if (!res.ok || !json.success) {
                        setMessage(json.message || "저장소 검증에 실패했습니다.");
                        return;
                      }
                      if (json.data) {
                        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                      }
                      const detail = (json.data?.messages ?? []).join(" / ");
                      setMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
                    } finally {
                      setBusy(null);
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
                    cursor: !canEdit ? "not-allowed" : busy === "val-repo" ? "wait" : "pointer",
                  }}
                >
                  {busy === "val-repo" ? "검증 중…" : "저장소 연결 검증"}
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy === "val-executor"}
                  onClick={async () => {
                    if (!projectId) return;
                    setBusy("val-executor");
                    try {
                      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "cursor" });
                      if (!res.ok || !json.success) {
                        setMessage(json.message || "원격 실행 검증에 실패했습니다.");
                        return;
                      }
                      if (json.data) {
                        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                      }
                      const detail = (json.data?.messages ?? []).join(" / ");
                      setMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
                    } finally {
                      setBusy(null);
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
                    cursor: !canEdit ? "not-allowed" : busy === "val-executor" ? "wait" : "pointer",
                  }}
                >
                  {busy === "val-executor" ? "검증 중…" : "원격 실행 검증"}
                </button>
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fafafa", gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>실행 정책</div>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                자동 반영·검증·승인 규칙입니다. 정책만 바꿀 때는 저장소/원격 실행 검증 상태를 지우지 않습니다.
              </p>

              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "10px 0 6px" }}>자동 반영</div>
              <div style={{ display: "grid", gap: 10 }}>
                {POLICY_AUTO.map(({ key, label, help }) => (
                  <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={Boolean(es?.[key])}
                        onChange={(e) =>
                          setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                        }
                      />
                      <strong>{label}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
                  </label>
                ))}
              </div>

              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>검증 / 중단 조건</div>
              <div style={{ display: "grid", gap: 10 }}>
                {POLICY_GATES.map(({ key, label, help }) => (
                  <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={es ? (es[key] !== false) : true}
                        onChange={(e) =>
                          setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                        }
                      />
                      <strong>{label}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
                  </label>
                ))}
              </div>

              <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>승인 정책 · 진행</div>
              <div style={{ display: "grid", gap: 10 }}>
                {POLICY_APPROVAL.map(({ key, label, help }) => (
                  <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={
                          key === "requireApprovalForSensitiveTasks"
                            ? es?.requireApprovalForSensitiveTasks === true
                            : es
                              ? (es[key] !== false)
                              : true
                        }
                        onChange={(e) =>
                          setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                        }
                      />
                      <strong>{label}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
                  </label>
                ))}
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                  color: "#334155",
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <span style={{ fontWeight: 800 }}>Task당 최대 자동 재시도 횟수</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  disabled={!canEdit}
                  value={es?.maxAutoRetriesPerTask ?? 2}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    const v = Number.isFinite(n) ? Math.min(20, Math.max(0, n)) : 2;
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), maxAutoRetriesPerTask: v }));
                  }}
                  style={{
                    width: 72,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                  }}
                />
                <span style={{ fontSize: 11, color: "#64748b", flex: "1 1 200px" }}>
                  한 Task에서 실행/평가 오류가 날 때 자동으로 재시도하는 최대 횟수입니다.
                </span>
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  disabled={!canEdit || busy === "save-policy"}
                  onClick={async () => {
                    if (!projectId || !es) return;
                    setBusy("save-policy");
                    try {
                      const { res, json } = await patchExecutionSetup(projectId, {
                        autoCommit: es.autoCommit,
                        autoPush: es.autoPush,
                        autoPr: es.autoPr,
                        requireApprovalBeforeApply: es.requireApprovalBeforeApply,
                        requireTestsBeforePush: es.requireTestsBeforePush,
                        dryRunAllowed: es.dryRunAllowed,
                        autoAdvanceToNextTask: es.autoAdvanceToNextTask,
                        maxAutoRetriesPerTask: es.maxAutoRetriesPerTask,
                        stopOnTestFailure: es.stopOnTestFailure,
                        stopOnRepeatedFailure: es.stopOnRepeatedFailure,
                        stopOnOutOfScopeChange: es.stopOnOutOfScopeChange,
                        requireApprovalForSensitiveTasks: es.requireApprovalForSensitiveTasks,
                      });
                      if (!res.ok || !json.success || !json.data) {
                        setMessage(json.message || "정책 저장에 실패했습니다.");
                        return;
                      }
                      setExecutionSetup(json.data);
                      setMessage("실행 정책을 저장했습니다.");
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #475569",
                    background: "#334155",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: !canEdit ? "not-allowed" : busy === "save-policy" ? "wait" : "pointer",
                  }}
                >
                  {busy === "save-policy" ? "저장 중…" : "실행 정책 저장"}
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy === "val-all"}
                  onClick={async () => {
                    if (!projectId) return;
                    setBusy("val-all");
                    try {
                      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "all" });
                      if (!res.ok || !json.success) {
                        setMessage(json.message || "검증에 실패했습니다.");
                        return;
                      }
                      if (json.data) {
                        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                      }
                      const detail = (json.data?.messages ?? []).join(" / ");
                      setMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #0f766e",
                    background: "#fff",
                    color: "#0f766e",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: !canEdit ? "not-allowed" : busy === "val-all" ? "wait" : "pointer",
                  }}
                >
                  {busy === "val-all" ? "검증 중…" : "저장소+원격 실행 한 번에 검증"}
                </button>
              </div>

              {es?.lastValidatedAt ? (
                <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
                  마지막 검증 시각(전체): {formatTestedAt(es.lastValidatedAt)}
                </div>
              ) : null}
              {es?.lastValidationError && !es.repoValidationError && !es.executorValidationError ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{es.lastValidationError}</div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
