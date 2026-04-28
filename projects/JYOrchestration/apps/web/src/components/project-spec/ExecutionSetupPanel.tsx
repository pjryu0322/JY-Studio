"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  patchExecutionSetup,
  postExecutionSetupValidate,
  postRevealCursorApiToken,
  type ExecutionSetupDto,
} from "@/components/project-spec/api";
import {
  cursorCredentialLooksStored,
  secretMaskedDisplay,
} from "@/components/project-spec/credentialUiMask";
import { mergeValidateIntoSetup, type ValidateResponseData } from "@/components/project-spec/executionSetupValidateMerge";
import type { ExecutionSetupBusyKey as BusyKey } from "@/components/project-spec/executionSetupBusyKey";
import {
  GLOB_PLACEHOLDER,
  POLICY_APPROVAL,
  POLICY_AUTO,
  POLICY_EXTRA,
  POLICY_GATES,
} from "@/components/project-spec/executionSetupPolicyRows";
import { ExecutionSetupUnifiedPolicyBody } from "@/components/project-spec/ExecutionSetupUnifiedPolicyBody";
import { PrototypeSimpleExecutionPolicy } from "@/components/project-spec/PrototypeSimpleExecutionPolicy";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import { WORKSPACE_SECTION_META } from "@/components/project-spec/workspaceSectionMeta";

const CURSOR_API_DEFAULT_URL = "https://api.cursor.com";

export type ExecutionSetupPanelHandle = {
  /** Cursor URL·키를 서버에 저장합니다. 직전 Git PATCH로 갱신된 행을 넘기면 그 스냅샷으로 저장합니다. */
  saveCursorConnection: (setupRow?: ExecutionSetupDto | null) => Promise<boolean>;
};

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

type ExecutionSetupPanelProps = {
  projectId: string;
  canEdit: boolean;
  executionSetup: ExecutionSetupDto | null | undefined;
  setExecutionSetup: Dispatch<SetStateAction<ExecutionSetupDto | null | undefined>>;
  setMessage: (msg: string | null) => void;
  formatTestedAt: (iso: string) => string;
  /** Git 탭 등: 펼침/접기 없이 한 화면에 표시, 저장소 참고 블록 생략 */
  flatLayout?: boolean;
  /**
   * 실행 환경 단일 탭: 섹션 A(연결)는 부모가 Git 폼을 두고, 여기서는 Cursor·정책·실행 상태만 구역으로 나눕니다.
   */
  unifiedExecutionEnvironment?: boolean;
  /** unified + 연결 설정 상단에 Git 폼 삽입(부모 렌더) */
  connectionSlotBeforeCursor?: ReactNode;
  /** prototype 목적: GitHub 인증을 별도 섹션으로 분리 */
  connectionSlotGithubAuth?: ReactNode;
  /** 실행 환경 탭: 1→2→3 플로우, 모니터 섹션 생략, Stage1 슬롯 분리 */
  executionEnvironmentFlow?: boolean;
  /** flow 모드에서 Step 2(Stage1 연결 검증) 본문 */
  connectionSlotAfterCursor?: ReactNode;
  /**
   * prototype 목적 설정 화면: 5개 섹션(저장소/깃허브/커서/정책/검증)을 즉시 노출한다.
   * (검증 로직은 기존 postExecutionSetupValidate/patchExecutionSetup 흐름 그대로)
   */
  prototypeStagedLayout?: boolean;
  /** prototype MVP: Cursor·자동화 두 카드만, 하단 검증 섹션 생략 */
  prototypeMvpLayout?: boolean;
  /** prototype 전용: 연결 테스트까지 성공해야 실행 준비 배지가 완료로 표시된다. */
  connectionTestSatisfied?: boolean;
  /** 프로젝트 OWNER만 저장된 키 전체를 일시 표시 */
  canRevealCursorApiKey?: boolean;
};

export const ExecutionSetupPanel = forwardRef<ExecutionSetupPanelHandle, ExecutionSetupPanelProps>(
  function ExecutionSetupPanel(props, ref) {
  const {
    projectId,
    canEdit,
    executionSetup,
    setExecutionSetup,
    setMessage,
    formatTestedAt,
    flatLayout = false,
    unifiedExecutionEnvironment = false,
    connectionSlotBeforeCursor,
    connectionSlotGithubAuth,
    executionEnvironmentFlow = false,
    connectionSlotAfterCursor,
    prototypeStagedLayout = false,
    prototypeMvpLayout = false,
    connectionTestSatisfied = false,
    canRevealCursorApiKey = false,
  } = props;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [cursorApiDetailOpen, setCursorApiDetailOpen] = useState(false);
  const [cursorApiKeyDraft, setCursorApiKeyDraft] = useState("");
  const [lastValidateKind, setLastValidateKind] = useState<"cursor_api" | "cursor_execution" | "all" | null>(null);
  const [cursorKeyReplaceMode, setCursorKeyReplaceMode] = useState(false);
  const [cursorKeyRevealPlaintext, setCursorKeyRevealPlaintext] = useState<string | null>(null);
  const [cursorRevealSecondsRemaining, setCursorRevealSecondsRemaining] = useState<number | null>(null);
  const revealCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (revealCountdownRef.current) clearInterval(revealCountdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!cursorCredentialLooksStored(executionSetup)) {
      setCursorKeyRevealPlaintext(null);
      setCursorRevealSecondsRemaining(null);
      setCursorKeyReplaceMode(false);
      if (revealCountdownRef.current) {
        clearInterval(revealCountdownRef.current);
        revealCountdownRef.current = null;
      }
    }
  }, [executionSetup]);

  function beginExecutionValidationRequest() {
    setLastValidateKind(null);
    setCursorApiDetailOpen(false);
    setExecutionSetup((p) => (p ? { ...p, cursorApiValidation: null } : p));
  }

  function scheduleCursorRevealHide() {
    if (revealCountdownRef.current) clearInterval(revealCountdownRef.current);
    let remaining = 8;
    setCursorRevealSecondsRemaining(8);
    revealCountdownRef.current = setInterval(() => {
      remaining -= 1;
      setCursorRevealSecondsRemaining(remaining > 0 ? remaining : null);
      if (remaining <= 0) {
        if (revealCountdownRef.current) clearInterval(revealCountdownRef.current);
        revealCountdownRef.current = null;
        setCursorKeyRevealPlaintext(null);
      }
    }, 1000);
  }

  const nr = executionSetup?.needsRevalidation ?? false;
  const repoOk = executionSetup?.repoConnectionOk;
  const cursorApiOk = executionSetup?.cursorApiConnectionOk ?? null;
  const execOk = executionSetup?.executorConnectionOk;
  const unified = Boolean(unifiedExecutionEnvironment && flatLayout);
  const stagedPrototype = Boolean(unified && prototypeStagedLayout);
  const prototypeMvp = Boolean(stagedPrototype && prototypeMvpLayout);
  const connectionGateOk = !stagedPrototype || connectionTestSatisfied === true;
  const ready =
    executionSetup?.status === "validated" &&
    !nr &&
    repoOk === true &&
    cursorApiOk === true &&
    execOk === true &&
    connectionGateOk;
  /** 단일 진실 원천: 실행 준비 완료 여부(요약·상세·오류 표시 모두 이 값과 일치) */
  const executionReady = ready;
  const repoAxis = axisStatus(repoOk);
  const cursorApiAxis = axisStatus(cursorApiOk);
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

  const flowMode = Boolean(unified && executionEnvironmentFlow);

  const es = executionSetup ?? null;
  const githubOperableOk =
    es?.githubCapabilityValidation &&
    typeof es.githubCapabilityValidation === "object" &&
    (es.githubCapabilityValidation as { githubOperableOk?: boolean }).githubOperableOk === true;
  const githubAuthConn = es?.githubAuthConnectionOk ?? null;
  const githubAxis =
    githubOperableOk === true
      ? axisStatus(true)
      : githubAuthConn === false
        ? axisStatus(false)
        : githubAuthConn === true
          ? { label: "부분", tone: "warn" as const }
          : axisStatus(null);
  const validationPayload = es?.cursorApiValidation ?? null;
  const validatingExecutionSetup =
    busy === "val-cursor-api" || busy === "val-cursor-exec" || busy === "val-all";
  const showValidationFailureDetails = !executionReady && !validatingExecutionSetup;
  const showCursorValidationCard =
    Boolean(validationPayload) && (!executionReady || Boolean(validationPayload?.overallOk));
  const showBody = flatLayout || open;
  const showExecExamples = flatLayout || examplesOpen;
  const showCursorApiDetail = flatLayout
    ? Boolean(validationPayload && !validationPayload.overallOk && !executionReady)
    : cursorApiDetailOpen;

  const unifiedPolicyBody = (
    <ExecutionSetupUnifiedPolicyBody
      projectId={projectId}
      canEdit={canEdit}
      es={es}
      setExecutionSetup={setExecutionSetup}
      setMessage={setMessage}
      examplesOpen={examplesOpen}
      setExamplesOpen={setExamplesOpen}
      showExecExamples={showExecExamples}
      busy={busy}
      setBusy={setBusy}
    />
  );

  const sectionCard = (
    title: string,
    description: string | null,
    children: ReactNode,
    options?: { variant?: "stage1" }
  ) => (
    <section
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        border: options?.variant === "stage1" ? "2px solid #9333ea" : "1px solid #e2e8f0",
        background: options?.variant === "stage1" ? "linear-gradient(180deg, #faf5ff 0%, #ffffff 64px)" : "#fff",
        boxShadow: options?.variant === "stage1" ? "0 8px 28px rgba(147, 51, 234, 0.12)" : undefined,
      }}
    >
      {options?.variant === "stage1" ? (
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.08em",
            color: "#7c3aed",
            marginBottom: 8,
          }}
        >
          STEP 2 · 핵심 검증
        </div>
      ) : null}
      <h2
        style={{
          fontSize: options?.variant === "stage1" ? 20 : 17,
          fontWeight: 800,
          margin: "0 0 4px 0",
          color: "#0f172a",
        }}
      >
        {title}
      </h2>
      {description ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{description}</p>
      ) : null}
      {children}
    </section>
  );

  const renderCursorConnectionBlock = (opts: { compactTitle: boolean; mvp?: boolean }) => {
    const mvp = Boolean(opts.mvp);
    const cursorLooksStored = cursorCredentialLooksStored(es);
    const showKeyInput = !cursorLooksStored || cursorKeyReplaceMode;
    const cursorKeyBusy =
      busy === "save-cursor" || busy === "val-cursor-api" || busy === "del-cursor" || busy === "reveal-cursor";
    const saveLabel = (() => {
      if (busy === "save-cursor") return "저장 중…";
      if (cursorApiKeyDraft.trim() && cursorKeyReplaceMode) return "새 키 저장";
      if (cursorApiKeyDraft.trim()) return "Cursor 연결 저장";
      return "Cursor URL 저장";
    })();
    const ghostBtn: CSSProperties = {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid #94a3b8",
      background: "#fff",
      color: "#334155",
      fontWeight: 700,
      fontSize: 12,
      cursor: canEdit && es && !cursorKeyBusy ? "pointer" : "not-allowed",
    };

    const inner = (
      <>
        {!mvp ? (
          <div style={{ fontWeight: 900, fontSize: 13, color: "#5b21b6", marginBottom: 4 }}>
            {opts.compactTitle ? "Cursor API" : "2. Cursor 연결"}
          </div>
        ) : null}
        <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          {mvp ? (
            <>기본 URL은 {CURSOR_API_DEFAULT_URL} 입니다. URL·키는 아래 저장으로 서버에 반영됩니다.</>
          ) : (
            <>
              검증(다시 검증)은 <strong>서버에 저장된 키</strong>로만 수행됩니다. 키를 다시 입력할 필요가 없습니다. 기본 URL:{" "}
              {CURSOR_API_DEFAULT_URL}
            </>
          )}
        </p>
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

        {showKeyInput ? (
          <label style={{ display: "grid", gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Cursor API 키</span>
            {cursorKeyReplaceMode && cursorLooksStored ? (
              <div style={{ marginBottom: 6, fontSize: 11, color: "#475569", lineHeight: 1.45 }}>
                현재 저장:{" "}
                <code style={{ fontSize: 11, color: "#0f172a" }}>
                  {secretMaskedDisplay(es?.cursorApiTokenMasked ?? null, cursorKeyRevealPlaintext, cursorLooksStored)}
                </code>
              </div>
            ) : null}
            <input
              type="password"
              autoComplete="off"
              value={cursorApiKeyDraft}
              disabled={!canEdit || !es}
              placeholder={
                cursorKeyReplaceMode
                  ? "새 키를 붙여넣기 (crsr_… / key_…)"
                  : cursorLooksStored
                    ? "(서버에 저장됨)"
                    : "key_ 또는 crsr_ 로 시작하는 키를 붙여넣기"
              }
              onChange={(e) => setCursorApiKeyDraft(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
          </label>
        ) : (
          <div style={{ marginBottom: 10, fontSize: 12, color: "#334155" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>저장된 키 (마스킹)</div>
            <code
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#f5f3ff",
                border: "1px solid #ddd6fe",
                fontSize: 13,
                wordBreak: "break-all",
                fontFamily: "ui-monospace, monospace",
                color: "#0f172a",
              }}
            >
              {secretMaskedDisplay(es?.cursorApiTokenMasked ?? null, cursorKeyRevealPlaintext, cursorLooksStored)}
            </code>
            {cursorKeyRevealPlaintext && cursorRevealSecondsRemaining != null ? (
              <div style={{ marginTop: 6, fontSize: 11, color: "#b45309" }}>
                {cursorRevealSecondsRemaining}초 후 자동으로 숨깁니다.
              </div>
            ) : null}
          </div>
        )}

        {cursorLooksStored && cursorKeyReplaceMode ? (
          <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              disabled={!canEdit || cursorKeyBusy}
              onClick={() => {
                setCursorKeyReplaceMode(false);
                setCursorApiKeyDraft("");
              }}
              style={{ ...ghostBtn, fontSize: 11, padding: "4px 10px" }}
            >
              키 교체 취소
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {!mvp ? (
            <button
              type="button"
              disabled={!canEdit || !es || busy === "val-cursor-api" || !cursorLooksStored}
              title={!cursorLooksStored ? "먼저 API 키를 저장하세요" : "저장된 키로 Cursor API 검증"}
              onClick={async () => {
                if (!projectId || !es) return;
                beginExecutionValidationRequest();
                setBusy("val-cursor-api");
                try {
                  const { res, json } = await postExecutionSetupValidate(projectId, { scope: "cursor_api" });
                  if (!res.ok || !json.success) {
                    setMessage(json.message || "Cursor API 검증에 실패했습니다.");
                    return;
                  }
                  if (json.data) {
                    setLastValidateKind("cursor_api");
                    setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                    const d = json.data as ValidateResponseData;
                    if (d.cursorApiValidation) {
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
                cursor:
                  !canEdit || !es || !cursorLooksStored || busy === "val-cursor-api" ? "not-allowed" : "pointer",
              }}
            >
              {busy === "val-cursor-api" ? "검증 중…" : "다시 검증"}
            </button>
          ) : null}

          {!mvp ? (
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
                  if (keyTouched) setCursorKeyReplaceMode(false);
                  setMessage(
                    keyTouched
                      ? "키를 저장했습니다. 「다시 검증」으로 연결을 확인할 수 있습니다."
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
              {saveLabel}
            </button>
          ) : null}

          <button
            type="button"
            disabled={!canEdit || !es || cursorKeyBusy}
            onClick={() => {
              setCursorKeyReplaceMode(true);
              setCursorApiKeyDraft("");
              setCursorKeyRevealPlaintext(null);
              setCursorRevealSecondsRemaining(null);
              if (revealCountdownRef.current) {
                clearInterval(revealCountdownRef.current);
                revealCountdownRef.current = null;
              }
            }}
            style={ghostBtn}
          >
            새 키로 교체
          </button>

          <button
            type="button"
            disabled={!canEdit || !es || !cursorLooksStored || cursorKeyBusy}
            onClick={async () => {
              const ok = window.confirm("저장된 Cursor API 키를 삭제합니다. 계속할까요?");
              if (!ok) return;
              if (!projectId || !es) return;
              setBusy("del-cursor");
              try {
                const { res, json } = await patchExecutionSetup(projectId, { cursorApiToken: null });
                if (!res.ok || !json.success || !json.data) {
                  setMessage(json.message || "키 삭제에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setCursorApiKeyDraft("");
                setCursorKeyReplaceMode(false);
                setCursorKeyRevealPlaintext(null);
                setCursorRevealSecondsRemaining(null);
                if (revealCountdownRef.current) {
                  clearInterval(revealCountdownRef.current);
                  revealCountdownRef.current = null;
                }
                setMessage("저장된 Cursor API 키를 삭제했습니다.");
              } finally {
                setBusy(null);
              }
            }}
            style={{ ...ghostBtn, color: "#b91c1c", borderColor: "#fecaca" }}
          >
            {busy === "del-cursor" ? "삭제 중…" : "삭제"}
          </button>

          {canRevealCursorApiKey ? (
            <button
              type="button"
              disabled={
                !cursorLooksStored || busy === "reveal-cursor" || busy === "val-cursor-api" || busy === "del-cursor"
              }
              onClick={async () => {
                if (!projectId) return;
                setBusy("reveal-cursor");
                try {
                  const { res, json } = await postRevealCursorApiToken(projectId);
                  if (!res.ok || !json.success || !json.data?.plaintext) {
                    setMessage(json.message || "키를 표시할 수 없습니다. (프로젝트 소유자만 가능합니다.)");
                    return;
                  }
                  setCursorKeyRevealPlaintext(json.data.plaintext);
                  scheduleCursorRevealHide();
                } finally {
                  setBusy(null);
                }
              }}
              style={ghostBtn}
            >
              {busy === "reveal-cursor" ? "불러오는 중…" : "👁 키 보기"}
            </button>
          ) : null}
        </div>
      </>
    );

    if (mvp) return <div style={{ marginBottom: 0 }}>{inner}</div>;
    return (
      <div
        style={{
          marginBottom: 14,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #c4b5fd",
          background: "#faf5ff",
        }}
      >
        {inner}
      </div>
    );
  };

  useImperativeHandle(
    ref,
    () => ({
      saveCursorConnection: async (setupRow?: ExecutionSetupDto | null) => {
        if (!prototypeMvp) return true;
        const cur = setupRow ?? executionSetup ?? null;
        const pid = projectId.trim();
        if (!pid || !cur) {
          setMessage("GitHub·저장소 설정을 먼저 저장해 주세요.");
          return false;
        }
        setBusy("save-cursor");
        try {
          const keyTouched = Boolean(cursorApiKeyDraft.trim());
          const body: Parameters<typeof patchExecutionSetup>[1] = {
            cursorApiUrl: cur.cursorApiUrl?.trim() || CURSOR_API_DEFAULT_URL,
          };
          if (keyTouched) body.cursorApiToken = cursorApiKeyDraft.trim();
          const { res, json } = await patchExecutionSetup(pid, body);
          if (!res.ok || !json.success || !json.data) {
            setMessage(json.message || "Cursor 설정 저장에 실패했습니다.");
            return false;
          }
          setExecutionSetup(json.data);
          setCursorApiKeyDraft("");
          if (keyTouched) setCursorKeyReplaceMode(false);
          return true;
        } finally {
          setBusy(null);
        }
      },
    }),
    [prototypeMvp, projectId, executionSetup, cursorApiKeyDraft, setExecutionSetup, setMessage]
  );

  return (
    <div
      id="execution-setup-panel"
      data-ui-label="[F-1-3-6] 실행 환경 설정"
      style={{
        marginTop: unified ? 0 : flatLayout ? 8 : 16,
        padding: unified ? 0 : 16,
        borderRadius: unified ? 0 : 12,
        border: unified ? "none" : frameBorder,
        background: unified ? "transparent" : frameBg,
      }}
    >
      {!unified ? (
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
      ) : null}

      {!showBody ? (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          {unified
            ? flowMode
              ? "1. 외부 시스템 연결 → 2. 연결 테스트 실행 → 3. (선택) 실행 정책 설정"
              : "연결 설정에서 저장소를 저장한 뒤 Cursor API·실행 정책·검증을 같은 화면에서 마칩니다."
            : "Git 연동에서 저장소를 연결하고, 여기서 Cursor API와 실행 옵션·정책을 설정한 뒤 연결 검증을 마치면 실행 준비가 완료됩니다."}
        </p>
      ) : unified ? (
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
          {stagedPrototype ? (
            prototypeMvp ? (
              <>
                {sectionCard(
                  "Cursor API 연결",
                  null,
                  renderCursorConnectionBlock({ compactTitle: true, mvp: true })
                )}
                {sectionCard(
                  "자동화 설정",
                  null,
                  <PrototypeSimpleExecutionPolicy
                    projectId={projectId}
                    canEdit={canEdit}
                    es={es}
                    setExecutionSetup={setExecutionSetup}
                    setMessage={setMessage}
                    setBusy={setBusy}
                    busy={busy}
                  />
                )}
              </>
            ) : (
              <>
                {sectionCard("1. Git 저장소", null, connectionSlotBeforeCursor ?? null)}
                {sectionCard("2. GitHub 인증", null, connectionSlotGithubAuth ?? null)}
                {sectionCard("3. Cursor API", null, renderCursorConnectionBlock({ compactTitle: true }))}
                {sectionCard(
                  "4. 실행 정책",
                  "프로토타입 자동화에 필요한 최소 옵션만 표시합니다.",
                  <PrototypeSimpleExecutionPolicy
                    projectId={projectId}
                    canEdit={canEdit}
                    es={es}
                    setExecutionSetup={setExecutionSetup}
                    setMessage={setMessage}
                    setBusy={setBusy}
                    busy={busy}
                  />
                )}
              </>
            )
          ) : flowMode ? (
            <>
              {sectionCard(
                "1 외부 시스템 연결",
                "Git 저장소·GitHub 인증·Cursor API를 설정합니다. 저장 후 검증으로 연결됨을 확인하세요.",
                <>
                  {connectionSlotBeforeCursor}
                  {renderCursorConnectionBlock({ compactTitle: true })}
                </>
              )}
              {connectionSlotAfterCursor
                ? sectionCard(
                    "2 연결 테스트",
                    "1단계가 준비되면 샘플 작업·커밋·푸시·PR까지 실제 경로를 확인합니다.",
                    connectionSlotAfterCursor,
                    { variant: "stage1" }
                  )
                : null}
              <details
                style={{
                  marginBottom: 16,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  padding: "0 16px 16px",
                }}
              >
                <summary
                  style={{
                    padding: "14px 0",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 16,
                    color: "#0f172a",
                    listStyle: "none",
                  }}
                >
                  3 실행 정책{" "}
                  <span style={{ fontWeight: 600, color: "#64748b", fontSize: 13 }}>(고급 설정 · 선택)</span>
                </summary>
                <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
                  연결 테스트에 필수는 아닙니다. 브랜치·푸시·승인·재시도 규칙을 바꿀 때만 펼쳐 주세요.
                </p>
                {unifiedPolicyBody}
              </details>
            </>
          ) : (
            <>
              {sectionCard(
                "연결 설정",
                "Git 저장소와 Cursor API를 한곳에서 연결합니다. 저장소는 먼저 저장한 뒤 저장소 연결 검증을 실행하세요.",
                <>
                  {connectionSlotBeforeCursor}
                  {renderCursorConnectionBlock({ compactTitle: true })}
                </>
              )}
              {sectionCard(
                "실행 정책",
                "브랜치·경로·자동 반영·승인·재시도 등 실행 시 적용되는 규칙입니다.",
                unifiedPolicyBody
              )}
            </>
          )}
          {!flowMode && !prototypeMvp ? (
          <section
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#fff",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px 0", color: "#0f172a" }}>
              {stagedPrototype ? "5. 환경 검증" : "실행 상태"}
            </h2>
            <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              {stagedPrototype
                ? "기본 검증으로 Git·GitHub·Cursor를 확인한 뒤, 연결 테스트로 샘플 작업부터 PR까지 검증합니다."
                : "연결·검증 결과와 저장소 실행 가능 여부를 확인합니다. 실패 시 아래 사유를 참고하세요."}
            </p>
            {stagedPrototype ? (
              <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
                기존 연결 정보를 불러올 수 있으면 자동으로 사용합니다. 저장소명과 기본 브랜치는 프로젝트별로
                설정합니다.
              </p>
            ) : null}
            {stagedPrototype ? (
              <div style={{ marginBottom: 14, fontSize: 12.5, color: "#334155", lineHeight: 1.65 }}>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#0f172a" }}>기본 검증 실행</div>
                <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
                  <li>Git 저장소</li>
                  <li>GitHub 인증</li>
                  <li>Cursor API</li>
                </ul>
              </div>
            ) : null}
            <>
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #bae6fd",
                  background: "#f0f9ff",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13, color: "#0c4a6e", marginBottom: 8 }}>연결·실행 요약</div>
                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
                  <div>
                    <strong>Git 연결 상태</strong>{" "}
                    <span style={{ color: connectionToneColor(repoAxis.tone), fontWeight: 800 }}>{repoAxis.label}</span>
                    {es?.repoValidatedAt ? (
                      <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.repoValidatedAt)}</span>
                    ) : null}
                  </div>
                  {stagedPrototype ? (
                    <div style={{ marginTop: 6 }}>
                      <strong>GitHub 인증</strong>{" "}
                      <span style={{ color: connectionToneColor(githubAxis.tone), fontWeight: 800 }}>{githubAxis.label}</span>
                      {es?.githubAuthValidatedAt ? (
                        <span style={{ color: "#64748b", fontWeight: 500 }}>
                          {" "}
                          · {formatTestedAt(es.githubAuthValidatedAt)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 6 }}>
                    <strong>Cursor 연결 상태</strong> (API 검증){" "}
                    <span style={{ color: connectionToneColor(cursorApiAxis.tone), fontWeight: 800 }}>
                      {cursorApiAxis.label}
                    </span>
                    {es?.cursorApiValidatedAt ? (
                      <span style={{ color: "#64748b", fontWeight: 500 }}>
                        {" "}
                        · {formatTestedAt(es.cursorApiValidatedAt)}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <strong>최종 실행 준비 상태</strong> (저장소 작업 검증){" "}
                    <span style={{ color: connectionToneColor(execAxis.tone), fontWeight: 800 }}>{execAxis.label}</span>
                    {es?.executorValidatedAt ? (
                      <span style={{ color: "#64748b", fontWeight: 500 }}>
                        {" "}
                        · {formatTestedAt(es.executorValidatedAt)}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <strong>실행 가능 여부</strong>{" "}
                    <span style={{ color: ready ? "#15803d" : "#b45309", fontWeight: 800 }}>
                      {ready ? "준비 완료" : "준비 안 됨"}
                    </span>
                  </div>
                  {showValidationFailureDetails &&
                    (es?.repoValidationError || es?.cursorApiValidationError || es?.executorValidationError) && (
                    <div style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.45, whiteSpace: "pre-wrap", marginTop: 10 }}>
                      {es?.repoValidationError ? (
                        <div>
                          <strong>Git</strong> {es.repoValidationError}
                        </div>
                      ) : null}
                      {es?.cursorApiValidationError ? (
                        <div style={{ marginTop: 6 }}>
                          <strong>Cursor API</strong> {es.cursorApiValidationError}
                        </div>
                      ) : null}
                      {es?.executorValidationError ? (
                        <div style={{ marginTop: 6 }}>
                          <strong>실행</strong> {es.executorValidationError}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #a5b4fc",
                  background: "#eef2ff",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13, color: "#3730a3", marginBottom: 4 }}>
                  저장소 실행 검증
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  Cursor가 이 저장소에서 작업 가능한지 확인합니다. 먼저 Cursor API 검증을 통과하세요.
                </p>
                <button
                  type="button"
                  disabled={!canEdit || !es || busy === "val-cursor-exec" || !es.hasCursorToken}
                  onClick={async () => {
                    if (!projectId || !es) return;
                    beginExecutionValidationRequest();
                    setBusy("val-cursor-exec");
                    try {
                      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "cursor_execution" });
                      if (!res.ok || !json.success) {
                        setMessage(json.message || "실행 검증에 실패했습니다.");
                        return;
                      }
                      if (json.data) {
                        setLastValidateKind("cursor_execution");
                        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                        const d = json.data as ValidateResponseData;
                        if (d.cursorApiValidation) {
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
                    border: "1px solid #4338ca",
                    background: "#4f46e5",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor:
                      !canEdit || !es || !es.hasCursorToken ? "not-allowed" : busy === "val-cursor-exec" ? "wait" : "pointer",
                  }}
                >
                  {busy === "val-cursor-exec" ? "검증 중…" : "Cursor 저장소 접근 검증"}
                </button>
              </div>
              {showCursorValidationCard && validationPayload ? (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${validationPayload.overallOk ? "#86efac" : "#fecaca"}`,
                    background: validationPayload.overallOk ? "#f0fdf4" : "#fef2f2",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>
                    {(() => {
                      const label =
                        lastValidateKind === "cursor_api"
                          ? "Cursor API 검증"
                          : lastValidateKind === "all"
                            ? "전체 검증"
                            : "실행 검증";
                      return `${label} — ${validationPayload.overallOk ? "성공" : "실패"}`;
                    })()}
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
                    {validationPayload.summaryKr}
                  </pre>
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
                      {validationPayload.detailLines.map((line, i) => (
                        <div key={i} style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace" }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  disabled={!canEdit || !es || busy === "val-all"}
                  onClick={async () => {
                    if (!projectId || !es) return;
                    beginExecutionValidationRequest();
                    setBusy("val-all");
                    try {
                      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "all" });
                      if (!res.ok || !json.success) {
                        setMessage(json.message || "검증에 실패했습니다.");
                        return;
                      }
                      if (json.data) {
                        setLastValidateKind("all");
                        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                        const d = json.data as ValidateResponseData;
                        if (d.cursorApiValidation) {
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
                  {busy === "val-all" ? "검증 중…" : stagedPrototype ? "기본 검증 실행" : "세 단계 한 번에 검증"}
                </button>
              </div>
              {es?.lastValidatedAt ? (
                <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
                  마지막 전체 검증 시각: {formatTestedAt(es.lastValidatedAt)}
                </div>
              ) : null}
              {showValidationFailureDetails &&
              es?.lastValidationError &&
              !es.repoValidationError &&
              !es.cursorApiValidationError &&
              !es.executorValidationError ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{es.lastValidationError}</div>
              ) : null}
              {stagedPrototype && connectionSlotAfterCursor ? (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8, color: "#0f172a", fontSize: 13 }}>연결 테스트</div>
                  <ul style={{ margin: "0 0 12px 18px", padding: 0, fontSize: 12.5, color: "#334155", lineHeight: 1.65 }}>
                    <li>샘플 작업 생성</li>
                    <li>Cursor 요청</li>
                    <li>Commit 감지</li>
                    <li>Push 감지</li>
                    <li>PR 생성</li>
                    <li>(옵션) Merge 완료</li>
                  </ul>
                  {connectionSlotAfterCursor}
                </div>
              ) : null}
            </>
          </section>
          ) : null}
        </>
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

          {!flatLayout ? (
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
                Git 연동에서 저장소를, 이 패널에서 Cursor API·실행 검증을 순서대로 완료하세요.
              </p>
              <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
                <strong>Git 상태</strong>{" "}
                <span style={{ color: connectionToneColor(repoAxis.tone), fontWeight: 800 }}>{repoAxis.label}</span>
                {es?.repoValidatedAt ? (
                  <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.repoValidatedAt)}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
                <strong>Cursor 상태</strong> (API 검증){" "}
                <span style={{ color: connectionToneColor(cursorApiAxis.tone), fontWeight: 800 }}>{cursorApiAxis.label}</span>
                {es?.cursorApiValidatedAt ? (
                  <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.cursorApiValidatedAt)}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
                <strong>실행 가능 상태</strong> (저장소 작업 검증){" "}
                <span style={{ color: connectionToneColor(execAxis.tone), fontWeight: 800 }}>{execAxis.label}</span>
                {es?.executorValidatedAt ? (
                  <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatTestedAt(es.executorValidatedAt)}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.55 }}>
                <strong>전체</strong>{" "}
                <span style={{ color: ready ? "#15803d" : "#b45309", fontWeight: 800 }}>
                  {ready ? "준비 완료" : "준비 안 됨"}
                </span>
              </div>
              {showValidationFailureDetails &&
                (es?.repoValidationError || es?.cursorApiValidationError || es?.executorValidationError) && (
                <div style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                  {es?.repoValidationError ? (
                    <div>
                      <strong>Git</strong> {es.repoValidationError}
                    </div>
                  ) : null}
                  {es?.cursorApiValidationError ? (
                    <div style={{ marginTop: 6 }}>
                      <strong>Cursor API</strong> {es.cursorApiValidationError}
                    </div>
                  ) : null}
                  {es?.executorValidationError ? (
                    <div style={{ marginTop: 6 }}>
                      <strong>실행</strong> {es.executorValidationError}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {renderCursorConnectionBlock({ compactTitle: false })}

          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #a5b4fc",
              background: "#eef2ff",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 13, color: "#3730a3", marginBottom: 4 }}>3. 실행 검증</div>
            <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              Cursor가 이 저장소에서 작업 가능한지 확인합니다. 먼저 위에서 Cursor API 검증을 통과하세요.
            </p>
            <button
              type="button"
              disabled={!canEdit || !es || busy === "val-cursor-exec" || !es.hasCursorToken}
              onClick={async () => {
                if (!projectId || !es) return;
                beginExecutionValidationRequest();
                setBusy("val-cursor-exec");
                try {
                  const { res, json } = await postExecutionSetupValidate(projectId, { scope: "cursor_execution" });
                  if (!res.ok || !json.success) {
                    setMessage(json.message || "실행 검증에 실패했습니다.");
                    return;
                  }
                  if (json.data) {
                    setLastValidateKind("cursor_execution");
                    setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                    const d = json.data as ValidateResponseData;
                    if (d.cursorApiValidation) {
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
                border: "1px solid #4338ca",
                background: "#4f46e5",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor:
                  !canEdit || !es || !es.hasCursorToken ? "not-allowed" : busy === "val-cursor-exec" ? "wait" : "pointer",
              }}
            >
              {busy === "val-cursor-exec" ? "검증 중…" : "Cursor 저장소 접근 검증"}
            </button>
          </div>

          {showCursorValidationCard && validationPayload ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${validationPayload.overallOk ? "#86efac" : "#fecaca"}`,
                background: validationPayload.overallOk ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>
                {(() => {
                  const label =
                    lastValidateKind === "cursor_api"
                      ? "Cursor API 검증"
                      : lastValidateKind === "all"
                        ? "전체 검증"
                        : "실행 검증";
                  return `${label} — ${validationPayload.overallOk ? "성공" : "실패"}`;
                })()}
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
                {validationPayload.summaryKr}
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
                  {validationPayload.detailLines.map((line, i) => (
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
              Git 연동 → Cursor API 검증 → 실행 검증 순서를 권장합니다.
            </p>
          ) : null}

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
                  beginExecutionValidationRequest();
                  setBusy("val-all");
                  try {
                    const { res, json } = await postExecutionSetupValidate(projectId, { scope: "all" });
                    if (!res.ok || !json.success) {
                      setMessage(json.message || "검증에 실패했습니다.");
                      return;
                    }
                    if (json.data) {
                      setLastValidateKind("all");
                      setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                      const d = json.data as ValidateResponseData;
                      if (d.cursorApiValidation) {
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
                {busy === "val-all" ? "검증 중…" : "세 단계 한 번에 검증"}
              </button>
            </div>

            {es?.lastValidatedAt ? (
              <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
                마지막 전체 검증 시각: {formatTestedAt(es.lastValidatedAt)}
              </div>
            ) : null}
            {showValidationFailureDetails &&
            es?.lastValidationError &&
            !es.repoValidationError &&
            !es.cursorApiValidationError &&
            !es.executorValidationError ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{es.lastValidationError}</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
});

ExecutionSetupPanel.displayName = "ExecutionSetupPanel";
