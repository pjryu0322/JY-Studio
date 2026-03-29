"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { patchExecutionSetup, postExecutionSetupValidate, type ExecutionSetupDto } from "@/components/project-spec/api";
import {
  mergeValidateIntoSetup,
  type CursorApiValidationPayload,
  type ValidateResponseData,
} from "@/components/project-spec/executionSetupValidateMerge";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import { WORKSPACE_SECTION_META } from "@/components/project-spec/workspaceSectionMeta";

type BusyKey = "save-cursor" | "save-exec-options" | "save-policy" | "val-executor" | "val-all" | null;

const GLOB_PLACEHOLDER = "src/**\napp/**\ntests/**";
const CURSOR_API_DEFAULT_URL = "https://api.cursor.com";

function connectionToneColor(tone: "muted" | "ok" | "bad" | "warn"): string {
  if (tone === "ok") return "#15803d";
  if (tone === "bad") return "#b91c1c";
  if (tone === "warn") return "#b45309";
  return "#64748b";
}

/** 저장소·Cursor API 단일 축 */
function axisStatus(ok: boolean | null | undefined): { label: string; tone: "muted" | "ok" | "bad" | "warn" } {
  if (ok === true) return { label: "정상", tone: "ok" };
  if (ok === false) return { label: "실패", tone: "bad" };
  return { label: "미검증", tone: "warn" };
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
    help: "원격 에이전트가 변경 후 커밋할지 여부입니다.",
  },
  { key: "autoPush", label: "자동 푸시", help: "커밋 후 원격 저장소로 푸시할지 정합니다." },
  { key: "autoPr", label: "자동 PR 생성", help: "푸시 후 PR 생성까지 자동으로 이어갈지 정합니다." },
];

const POLICY_GATES: PolicyRow[] = [
  {
    key: "requireTestsBeforePush",
    label: "푸시 전 테스트 필수",
    help: "테스트·검증을 통과하기 전에는 푸시하지 않습니다.",
  },
  {
    key: "stopOnRepeatedFailure",
    label: "동일 오류 반복 시 중단",
    help: "같은 오류가 연속으로 나면 재시도를 멈추고 사람이 개입할 수 있게 합니다.",
  },
  {
    key: "stopOnOutOfScopeChange",
    label: "허용 경로 위반 시 중단",
    help: "허용 글로브 밖 파일이나 비정상적으로 많은 변경이 감지되면 중단합니다.",
  },
  {
    key: "stopOnTestFailure",
    label: "테스트·빌드 실패 징후 시 중단",
    help: "요약·평가에서 테스트나 빌드 실패 힌트가 보이면 즉시 실패 처리합니다.",
  },
];

const POLICY_APPROVAL: PolicyRow[] = [
  {
    key: "requireApprovalBeforeApply",
    label: "반영 전 승인 필요",
    help: "코드 반영(커밋·푸시 등) 전에 사람의 승인을 받습니다.",
  },
  {
    key: "requireApprovalForSensitiveTasks",
    label: "인증·비밀정보 관련 작업은 사람 승인 필요",
    help: "토큰·비밀번호·인증 등 민감한 작업은 자동으로 진행하지 않습니다.",
  },
];

const POLICY_EXTRA: PolicyRow[] = [
  { key: "dryRunAllowed", label: "드라이런 허용", help: "실제 반영 없이 시뮬레이션·검토만 하는 흐름을 허용합니다." },
  {
    key: "autoAdvanceToNextTask",
    label: "검토 통과 시 다음 작업 자동 진행",
    help: "현재 작업이 통과하면 다음 준비된 작업으로 자동 이어집니다.",
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
  /** Git 탭 등: 펼침/접기 없이 한 화면에 표시, 저장소 참고 블록 생략 */
  flatLayout?: boolean;
}) {
  const {
    projectId,
    canEdit,
    specWorkflowConfirmed,
    executionSetup,
    setExecutionSetup,
    setMessage,
    formatTestedAt,
    flatLayout = false,
  } = props;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [cursorApiValidationResult, setCursorApiValidationResult] = useState<CursorApiValidationPayload | null>(null);
  const [cursorApiDetailOpen, setCursorApiDetailOpen] = useState(false);
  const [cursorHelpOpen, setCursorHelpOpen] = useState(false);
  const [cursorApiKeyDraft, setCursorApiKeyDraft] = useState("");

  const nr = executionSetup?.needsRevalidation ?? false;
  const repoOk = executionSetup?.repoConnectionOk;
  const execOk = executionSetup?.executorConnectionOk;
  const ready = executionSetup?.status === "validated" && !nr;
  const repoAxis = axisStatus(repoOk);
  const execAxis = axisStatus(execOk);

  const badgeLabelKr = executionSetup?.status === "invalid" ? "오류" : ready ? "준비됨" : "미완료";
  const badgeColors =
    ready
      ? { bg: "#dcfce7", fg: "#166534", bd: "#86efac" }
      : executionSetup?.status === "invalid"
        ? { bg: "#fee2e2", fg: "#991b1b", bd: "#fecaca" }
        : { bg: "#ffedd5", fg: "#9a3412", bd: "#fdba74" };
  const frameBorder = flatLayout
    ? "1px solid #e2e8f0"
    : ready
      ? "2px solid #22c55e"
      : executionSetup?.status === "invalid"
        ? "2px solid #f87171"
        : "1px solid #e2e8f0";
  const frameBg = flatLayout ? "#fafafa" : ready ? "#f0fdf4" : "#fff";

  if (!specWorkflowConfirmed) {
    return (
      <div
        data-ui-label="[F-1-3-6] 실행 환경 설정 (스펙 미확정)"
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
          <span style={{ fontSize: 12, color: "#64748b" }}>
            프로젝트 스펙이 확정된 뒤 Cursor API·실행 옵션·정책을 설정할 수 있습니다.
          </span>
        </div>
      </div>
    );
  }

  const es = executionSetup ?? null;
  const showBody = flatLayout || open;
  const showCursorHelp = flatLayout || cursorHelpOpen;
  const showExecExamples = flatLayout || examplesOpen;
  const showCursorApiDetail = flatLayout
    ? Boolean(cursorApiValidationResult && !cursorApiValidationResult.overallOk)
    : cursorApiDetailOpen;

  return (
    <div
      data-ui-label="[F-1-3-6] 실행 환경 설정"
      style={{
        marginTop: flatLayout ? 8 : 16,
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
          marginBottom: showBody ? 10 : 6,
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
        {!flatLayout ? (
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
        ) : null}
      </div>

      {!showBody ? (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          Git 연동에서 저장소를 연결하고, 여기서 Cursor API와 실행 옵션·정책을 설정한 뒤 연결 검증을 마치면 실행 준비가
          완료됩니다.
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
              설정이 바뀌었습니다. 해당 항목을 저장한 뒤 필요한 검증을 다시 실행해 주세요.
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
            <div style={{ fontWeight: 900, fontSize: 13, color: "#0c4a6e" }}>준비 상태 (요약)</div>
            <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              {flatLayout
                ? "저장소는 위 Git 연동에서 검증했습니다. Cursor API를 저장·검증하면 실행 준비가 완료됩니다."
                : "저장소 연결은 Git 연동에서 설정·검증합니다. Cursor API는 아래에서 URL·API 키를 저장한 뒤「Cursor API 연결 검증」으로 확인합니다. 둘 다 성공해야 실행 준비가 완료됩니다."}
            </p>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <strong>저장소 연결 상태</strong> (Git 연동 기준){" "}
              <span style={{ color: connectionToneColor(repoAxis.tone), fontWeight: 800 }}>{repoAxis.label}</span>
              {es?.repoValidatedAt ? (
                <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.repoValidatedAt)}</span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <strong>Cursor API 연결 상태</strong>{" "}
              <span style={{ color: connectionToneColor(execAxis.tone), fontWeight: 800 }}>{execAxis.label}</span>
              {es?.executorValidatedAt ? (
                <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.executorValidatedAt)}</span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
              <strong>실행 준비 상태</strong>{" "}
              <span style={{ color: ready ? "#15803d" : "#b45309", fontWeight: 800 }}>
                {ready ? "준비 완료" : "준비 안 됨"}
              </span>
              <span style={{ color: "#64748b", fontWeight: 500 }}> (위 두 항목이 모두 성공해야 완료)</span>
            </div>
            {(es?.repoValidationError || es?.executorValidationError) && (
              <div style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                {es?.repoValidationError ? (
                  <div>
                    <strong>저장소</strong> {es.repoValidationError}
                  </div>
                ) : null}
                {es?.executorValidationError ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Cursor API</strong> {es.executorValidationError}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #c4b5fd",
              background: "#faf5ff",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>Cursor API 연결</div>
            <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
              {flatLayout
                ? `Cloud Agents API · 기본 URL ${CURSOR_API_DEFAULT_URL}. 키는 서버에만 저장됩니다.`
                : `JYOrchestration은 Cursor Cloud Agents API를 직접 호출합니다. 기본 URL은 ${CURSOR_API_DEFAULT_URL} 이며, 프로젝트마다 다른 주소로 바꿀 수 있습니다. API 키는 서버에만 저장되며 응답으로 전체 값이 내려가지 않습니다.`}
            </p>
            {!flatLayout ? (
              <button
                type="button"
                onClick={() => setCursorHelpOpen((v) => !v)}
                style={{
                  marginBottom: 10,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #94a3b8",
                  background: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {cursorHelpOpen ? "Cursor API 키 안내 접기" : "Cursor API 키 확인 방법"}
              </button>
            ) : null}
            {showCursorHelp ? (
              <ol
                style={{
                  margin: "0 0 12px 0",
                  paddingLeft: 20,
                  fontSize: 12,
                  color: "#334155",
                  lineHeight: 1.6,
                }}
              >
                <li>Cursor 대시보드(cursor.com)에 로그인합니다.</li>
                <li>설정 → Integrations 또는 Cloud Agents 메뉴로 이동합니다.</li>
                <li>API key를 생성합니다.</li>
                <li>생성한 키를 아래 입력란에 붙여넣고「Cursor 연결 저장」을 누릅니다.</li>
                <li>「Cursor API 연결 검증」으로 연결·인증을 확인합니다.</li>
              </ol>
            ) : null}
            <label style={{ display: "grid", gap: 4, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Cursor API URL</span>
              <input
                value={es?.cursorApiUrl?.trim() ? es.cursorApiUrl : CURSOR_API_DEFAULT_URL}
                disabled={!canEdit || !es}
                placeholder={CURSOR_API_DEFAULT_URL}
                onChange={(e) =>
                  setExecutionSetup((p) => ({
                    ...(p ?? ({} as ExecutionSetupDto)),
                    cursorApiUrl: e.target.value.trim() || CURSOR_API_DEFAULT_URL,
                  }))
                }
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Cursor API 키</span>
              <input
                type="password"
                autoComplete="off"
                value={cursorApiKeyDraft}
                disabled={!canEdit || !es}
                placeholder={
                  es?.hasCursorToken
                    ? "새 키를 입력하면 기존 키가 교체됩니다"
                    : "key_ 로 시작하는 키를 붙여넣기"
                }
                onChange={(e) => setCursorApiKeyDraft(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
              />
            </label>
            {es?.hasCursorToken && es?.cursorApiTokenMasked ? (
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                저장된 키(일부만 표시): {es.cursorApiTokenMasked}
              </div>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                disabled={!canEdit || !es || busy === "save-cursor"}
                onClick={async () => {
                  if (!projectId || !es) return;
                  setBusy("save-cursor");
                  const keyTouched = Boolean(cursorApiKeyDraft.trim());
                  try {
                    const body: Parameters<typeof patchExecutionSetup>[1] = {
                      cursorApiUrl: es.cursorApiUrl?.trim() || CURSOR_API_DEFAULT_URL,
                    };
                    if (keyTouched) body.cursorApiToken = cursorApiKeyDraft.trim();
                    const { res, json } = await patchExecutionSetup(projectId, body);
                    if (!res.ok || !json.success || !json.data) {
                      setMessage(json.message || "저장에 실패했습니다.");
                      return;
                    }
                    setExecutionSetup(json.data);
                    setCursorApiKeyDraft("");
                    setMessage(
                      keyTouched
                        ? "Cursor API URL·키를 저장했습니다. 이어서 연결 검증을 실행할 수 있습니다."
                        : "Cursor API URL을 저장했습니다."
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #7c3aed",
                  background: "#7c3aed",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: !canEdit || !es ? "not-allowed" : busy === "save-cursor" ? "wait" : "pointer",
                }}
              >
                {busy === "save-cursor" ? "저장 중…" : "Cursor 연결 저장"}
              </button>
              <button
                type="button"
                disabled={!canEdit || !es || busy === "val-executor"}
                onClick={async () => {
                  if (!projectId || !es) return;
                  setBusy("val-executor");
                  try {
                    const { res, json } = await postExecutionSetupValidate(projectId, { scope: "cursor" });
                    if (!res.ok || !json.success) {
                      setMessage(json.message || "Cursor API 연결 검증에 실패했습니다.");
                      return;
                    }
                    if (json.data) {
                      setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                      const d = json.data as ValidateResponseData;
                      if (d.cursorApiValidation) {
                        setCursorApiValidationResult(d.cursorApiValidation);
                        setCursorApiDetailOpen(!d.cursorApiValidation.overallOk);
                      }
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
                  cursor: !canEdit || !es ? "not-allowed" : busy === "val-executor" ? "wait" : "pointer",
                }}
              >
                {busy === "val-executor" ? "검증 중…" : "Cursor API 연결 검증"}
              </button>
            </div>
          </div>

          {cursorApiValidationResult ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${cursorApiValidationResult.overallOk ? "#86efac" : "#fecaca"}`,
                background: cursorApiValidationResult.overallOk ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>
                {cursorApiValidationResult.overallOk
                  ? "Cursor API 연결 검증 — 성공"
                  : "Cursor API 연결 검증 — 실패"}
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: "#334155",
                  fontFamily: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              >
                {cursorApiValidationResult.summaryKr}
              </pre>
              {!flatLayout ? (
                <button
                  type="button"
                  onClick={() => setCursorApiDetailOpen((v) => !v)}
                  style={{
                    marginTop: 10,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #94a3b8",
                    background: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {cursorApiDetailOpen ? "상세 접기" : "상세 보기"}
                </button>
              ) : null}
              {showCursorApiDetail ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: "#1e293b",
                  }}
                >
                  {cursorApiValidationResult.detailLines.map((line, i) => (
                    <div key={i} style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace" }}>
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {!flatLayout ? (
            <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
              검증 단계: (1) URL·API 키·실행 설정 확인 (2) Cursor API 연결 (3) API 키 인증{" "}
              <code style={{ fontSize: 12 }}>GET /v0/me</code> (4) GitHub HTTPS 저장소 형식 확인
            </p>
          ) : (
            <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b" }}>
              Cursor 검증: URL·키·<code>GET /v0/me</code>·저장소 형식
            </p>
          )}

          {!flatLayout ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fafafa",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>연결된 Git (참고)</div>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                저장소 URL·베이스 브랜치는 Git 연동에서만 수정합니다. 여기 값은 검증·실행에 사용되는 현재 저장 내용입니다.
              </p>
              {!es ? (
                <div style={{ fontSize: 13, color: "#b45309" }}>
                  실행 환경 레코드가 없습니다. Git 연동에서「저장소 설정 저장」을 먼저 실행하세요.
                </div>
              ) : !es.gitRepoUrl?.trim() ? (
                <div style={{ fontSize: 13, color: "#b45309" }}>
                  저장소 URL이 비어 있습니다. Git 연동에서 URL과 베이스 브랜치를 저장하세요.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#0f172a", lineHeight: 1.6 }}>
                  <li>
                    <strong>저장소 URL:</strong> {es.gitRepoUrl}
                  </li>
                  <li>
                    <strong>제공자:</strong> {es.gitRepoProvider === "github" ? "GitHub" : "기타"}
                  </li>
                  {es.gitRepoName ? (
                    <li>
                      <strong>저장소 전체 이름(owner/repo):</strong> {es.gitRepoName}
                    </li>
                  ) : null}
                  <li>
                    <strong>베이스 브랜치:</strong> {es.baseBranch || "main"}
                  </li>
                </ul>
              )}
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {!flatLayout ? (
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
                {examplesOpen ? "실행 옵션 예시 접기" : "실행 옵션 예시 보기"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canEdit || !es}
              onClick={() => {
                if (!es) return;
                setExecutionSetup({
                  ...es,
                  branchStrategy: "feature-per-workflow",
                  branchPrefix: "jy/agent/",
                  allowedPathGlobs: ["src/**", "app/**", "tests/**"],
                });
                setMessage("브랜치 전략·접두어·허용 경로에 예시 값을 채웠습니다.「실행 옵션 저장」으로 저장하세요.");
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: canEdit && es ? "#f5f3ff" : "#f1f5f9",
                fontWeight: 700,
                fontSize: 12,
                cursor: !canEdit || !es ? "not-allowed" : "pointer",
                color: "#5b21b6",
              }}
            >
              실행 옵션 예시 적용
            </button>
          </div>

          {showExecExamples ? (
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
              {`브랜치 전략 예: 워크플로마다 기능 브랜치 / 작업마다 기능 브랜치 / 수동
작업 브랜치 접두어 예: jy/agent/
허용 경로 glob 예:
${GLOB_PLACEHOLDER}`}
            </div>
          ) : null}

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fafafa", marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>실행 옵션</div>
            <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              브랜치 전략·작업 브랜치 접두어·허용 경로만 이 패널에서 저장합니다. 저장소는 Git 연동을 사용하세요.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>브랜치 전략</span>
                <select
                  value={es?.branchStrategy ?? "manual"}
                  disabled={!canEdit || !es}
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
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>작업 브랜치 접두어 (선택)</span>
                <input
                  value={es?.branchPrefix ?? ""}
                  disabled={!canEdit || !es}
                  placeholder="jy/agent/"
                  onChange={(e) =>
                    setExecutionSetup((p) => ({
                      ...(p ?? ({} as ExecutionSetupDto)),
                      branchPrefix: e.target.value || null,
                    }))
                  }
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 4, marginTop: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
                허용 경로 glob (선택, 줄바꿈으로 구분)
              </span>
              <textarea
                value={(es?.allowedPathGlobs ?? []).join("\n")}
                disabled={!canEdit || !es}
                placeholder={GLOB_PLACEHOLDER}
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
                disabled={!canEdit || !es || busy === "save-exec-options"}
                onClick={async () => {
                  if (!projectId || !es) return;
                  setBusy("save-exec-options");
                  try {
                    const { res, json } = await patchExecutionSetup(projectId, {
                      branchStrategy: es.branchStrategy,
                      branchPrefix: es.branchPrefix,
                      allowedPathGlobs: es.allowedPathGlobs ?? [],
                    });
                    if (!res.ok || !json.success || !json.data) {
                      setMessage(json.message || "저장에 실패했습니다.");
                      return;
                    }
                    setExecutionSetup(json.data);
                    setMessage("실행 옵션을 저장했습니다.");
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
                  cursor: !canEdit || !es ? "not-allowed" : busy === "save-exec-options" ? "wait" : "pointer",
                }}
              >
                {busy === "save-exec-options" ? "저장 중…" : "실행 옵션 저장"}
              </button>
            </div>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fafafa" }}>
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>실행 정책</div>
            <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              자동 반영·검증·승인 규칙입니다. 정책만 변경한 경우 저장소·Cursor API 검증 결과는 유지됩니다.
            </p>

            <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "10px 0 6px" }}>자동 반영</div>
            <div style={{ display: "grid", gap: 10 }}>
              {POLICY_AUTO.map(({ key, label, help }) => (
                <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      disabled={!canEdit || !es}
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

            <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>검증·중단 조건</div>
            <div style={{ display: "grid", gap: 10 }}>
              {POLICY_GATES.map(({ key, label, help }) => (
                <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      disabled={!canEdit || !es}
                      checked={es ? es[key] !== false : true}
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

            <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>승인 정책</div>
            <div style={{ display: "grid", gap: 10 }}>
              {POLICY_APPROVAL.map(({ key, label, help }) => (
                <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      disabled={!canEdit || !es}
                      checked={
                        key === "requireApprovalForSensitiveTasks"
                          ? es?.requireApprovalForSensitiveTasks === true
                          : es
                            ? es[key] !== false
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

            <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>추가 옵션</div>
            <div style={{ display: "grid", gap: 10 }}>
              {POLICY_EXTRA.map(({ key, label, help }) => (
                <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      disabled={!canEdit || !es}
                      checked={es ? es[key] !== false : true}
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
              <span style={{ fontWeight: 800 }}>작업당 최대 자동 재시도 횟수</span>
              <input
                type="number"
                min={0}
                max={20}
                disabled={!canEdit || !es}
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
                한 작업에서 오류가 날 때 자동으로 재시도하는 최대 횟수입니다.
              </span>
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                disabled={!canEdit || !es || busy === "save-policy"}
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
                  cursor: !canEdit || !es ? "not-allowed" : busy === "save-policy" ? "wait" : "pointer",
                }}
              >
                {busy === "save-policy" ? "저장 중…" : "실행 정책 저장"}
              </button>
              <button
                type="button"
                disabled={!canEdit || !es || busy === "val-all"}
                onClick={async () => {
                  if (!projectId || !es) return;
                  setBusy("val-all");
                  try {
                    const { res, json } = await postExecutionSetupValidate(projectId, { scope: "all" });
                    if (!res.ok || !json.success) {
                      setMessage(json.message || "검증에 실패했습니다.");
                      return;
                    }
                    if (json.data) {
                      setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                      const d = json.data as ValidateResponseData;
                      if (d.cursorApiValidation) {
                        setCursorApiValidationResult(d.cursorApiValidation);
                        setCursorApiDetailOpen(!d.cursorApiValidation.overallOk);
                      }
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
                  cursor: !canEdit || !es ? "not-allowed" : busy === "val-all" ? "wait" : "pointer",
                }}
              >
                {busy === "val-all" ? "검증 중…" : "저장소·Cursor API 한 번에 검증"}
              </button>
            </div>

            {es?.lastValidatedAt ? (
              <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
                마지막 전체 검증 시각: {formatTestedAt(es.lastValidatedAt)}
              </div>
            ) : null}
            {es?.lastValidationError && !es.repoValidationError && !es.executorValidationError ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{es.lastValidationError}</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
