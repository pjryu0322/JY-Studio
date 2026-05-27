import { buildFiveStepPipelineRows, resolveActiveWorkUnitForPanel, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import type { PrototypeWorkspaceTimelineCardV1 } from "@/lib/requirements/requirementsStateJson";
import type { PrototypeRun, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";
import { shouldLockInlineChatTemplateSelection } from "@/lib/prototype/prototypeRunUiHelpers";

/** 플래너 진행 단계(1~5) — UI·시뮬레이션과 동일 순서 유지 */
export const PROTOTYPE_PLANNER_STAGE_LABELS_KO = [
  "아이디어 구체화 결과 분석",
  "액터 및 서비스 흐름 분석",
  "선택 템플릿 구조 반영",
  "Cursor 작업단위 분해",
  "최종 작업계획 작성",
] as const;

export type PrototypeChatEnvBadge = "ok" | "needs" | "error" | "loading";

export type PrototypeChatEnvSnapshot = Readonly<{
  git: PrototypeChatEnvBadge;
  github: PrototypeChatEnvBadge;
  cursor: PrototypeChatEnvBadge;
  connectionTest: PrototypeChatEnvBadge;
}>;

export type PrototypeChatMessageRole = "ai" | "user" | "system";

export type PrototypeChatActionIntent =
  | "OPEN_ENV_SETTINGS"
  | "OPEN_TEMPLATE_PREVIEW"
  | "SELECT_TEMPLATE_RECOMMENDED"
  | "SELECT_TEMPLATE"
  | "CREATE_PLAN"
  /** 채팅에 플래너 입력 프롬프트(시스템+유저 메시지)를 표시 */
  | "OPEN_PLANNER_PROMPT_IN_CHAT"
  /** postCreatePrototypeRun(플래너) 실제 호출 */
  | "START_WORK_PLAN_GENERATION"
  /** 작업계획(WorkUnit) 생성만 다시 시도 */
  | "RETRY_PLANNER_GENERATION"
  | "REFRESH_STATUS"
  | "CONFIRM_EXECUTION"
  | "REGENERATE_PLAN"
  | "MODIFY_REQUEST"
  | "CANCEL_RUN"
  | "RESUME_RUN"
  | "RESTART_RUN"
  | "RETRY_FAILED_WU"
  | "OPEN_ACTIONS_URL"
  | "OPEN_CURSOR_PROMPT"
  | "OPEN_PR_URL"
  | "OPEN_PREVIEW"
  | "COPY_PREVIEW_URL"
  | "OPEN_PROTOTYPE_REVIEW";

/** 템플릿 확정 후 작업계획 생성 버튼 노출 여부 등 */
export type PrototypePrePlanGate = "idle" | "need_create_click";

export type PrototypeChatAction = Readonly<{
  id: string;
  label: string;
  intent: PrototypeChatActionIntent;
  disabled?: boolean;
  templateId?: string;
  workUnitOrder?: number;
}>;

export type PrototypeChatBlock =
  | { kind: "text"; text: string }
  | {
      kind: "env_table";
      rows: readonly { key: string; label: string; state: "완료" | "필요" | "오류" | "대기" }[];
    }
  | { kind: "ordered_titles"; items: readonly { order: number; title: string }[] }
  | { kind: "pipeline_grid"; rows: readonly { label: string; stateKo: string; tone: string }[] }
  | { kind: "bullet_list"; items: readonly string[] }
  | { kind: "url_line"; url: string }
  /** currentStep: 1~5 (진행 중인 단계). 이전 단계는 완료, 이후는 대기로 표시 */
  | { kind: "planner_stage_progress"; currentStep: number };

export type PrototypeChatBuiltMessage = Readonly<{
  id: string;
  role: PrototypeChatMessageRole;
  /** 정렬·병합용: 증가하는 단조 키 */
  orderKey: number;
  title?: string;
  body?: string;
  blocks?: readonly PrototypeChatBlock[];
  actions?: readonly PrototypeChatAction[];
  /** 채팅 말풍선 안에 템플릿 콤보·미리보기 렌더 */
  inlineTemplatePicker?: boolean;
}>;

export type BuildPrototypeChatMessagesParams = Readonly<{
  env: PrototypeChatEnvSnapshot;
  canRequestGenerationEnvOk: boolean;
  canRequestGenerationDesignOk: boolean;
  envSettingsHref: string;
  templateChipTemplates: readonly { id: string; nameKo: string }[];
  recommendedTemplateId: string;
  templateConfirmed: boolean;
  /** true면 AI 추천 템플릿을 기본값으로 작업계획 생성 가능(별도 [확정] 없음) */
  templatePlanningReady?: boolean;
  prePlanGate: PrototypePrePlanGate;
  latestRun: PrototypeRun | null;
  awaitingExecutionConfirm: boolean;
  isPlannerRunning: boolean;
  isRunningState: boolean;
  isCancelled: boolean;
  isFailed: boolean;
  isDeployFailed: boolean;
  isCompleted: boolean;
  /** WorkUnit 병합 후 배포 단계 */
  isDeployPhase: boolean;
  automationAvailable: boolean;
  previewUrl: string | null;
  pagesSettingsHref: string | null;
  pagesDeployWorkflowRunUrl: string | null;
  /** 작업계획 요청 직후 등 UI 액션 중복 방지 */
  protoBusy: boolean;
  /** postCreate 직후·응답 전까지 플래너 UI용 */
  plannerCreatePending: boolean;
  /** 1~5 단계 시뮬레이션(또는 완료 직전) — 플래너 진행 말풍선에 전달 */
  plannerProgressStep: number;
  /** 검토 화면 이동 링크용 */
  projectId: string;
  /**
   * true면 환경 점검 카드(구현 첫 화면)를 생략 — Implementation Orchestration bootstrap 메시지가 readiness를 담당.
   */
  omitEnvReadinessCard?: boolean;
}>;

function envLineState(b: PrototypeChatEnvBadge): "완료" | "필요" | "오류" | "대기" {
  if (b === "ok") return "완료";
  if (b === "error") return "오류";
  if (b === "loading") return "대기";
  return "필요";
}

function envLoading(p: BuildPrototypeChatMessagesParams): boolean {
  const { env } = p;
  return env.git === "loading" || env.github === "loading" || env.cursor === "loading" || env.connectionTest === "loading";
}

function sortedUnits(run: PrototypeRun | null): readonly PrototypeWorkUnit[] {
  if (!run?.workUnits?.length) return [];
  return [...run.workUnits].sort((a, b) => a.order - b.order);
}

function hasNoWorkUnitsYet(run: PrototypeRun | null): boolean {
  return sortedUnits(run).length === 0;
}

function firstFailedUnit(run: PrototypeRun | null): PrototypeWorkUnit | null {
  const u = sortedUnits(run).find((x) => x.status === "FAILED");
  return u ?? null;
}

function formatDurationKo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}시간 ${mm}분`;
  if (m > 0) return `${m}분`;
  return `${s}초`;
}

function parseIsoMs(iso: string | null | undefined): number | null {
  const s = String(iso ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** DB에 저장하지 않고 화면용 타임라인 메시지를 조합합니다. */
export function buildPrototypeChatMessages(p: BuildPrototypeChatMessagesParams): readonly PrototypeChatBuiltMessage[] {
  const out: PrototypeChatBuiltMessage[] = [];
  let k = 0;
  const nextKey = () => ++k * 1000;

  if (envLoading(p)) {
    out.push({
      id: "system-env-loading",
      role: "system",
      orderKey: nextKey(),
      body: "실행 환경 정보를 불러오는 중입니다…",
    });
    return out;
  }

  if (!p.omitEnvReadinessCard) {
    const envTable: PrototypeChatBlock = {
      kind: "env_table",
      rows: [
        { key: "git", label: "Git 저장소", state: envLineState(p.env.git) },
        { key: "gh", label: "GitHub 인증", state: envLineState(p.env.github) },
        { key: "cursor", label: "Cursor API", state: envLineState(p.env.cursor) },
        { key: "conn", label: "연결 테스트", state: envLineState(p.env.connectionTest) },
      ],
    };

    out.push({
      id: "ai-env-check",
      role: "ai",
      orderKey: nextKey(),
      title: "프로토타입 실행 환경을 점검했습니다.",
      blocks: [envTable],
      actions: p.canRequestGenerationEnvOk
        ? undefined
        : [{ id: "a-env", label: "환경설정 열기", intent: "OPEN_ENV_SETTINGS" }],
    });

    if (p.canRequestGenerationEnvOk) {
      out.push({
        id: "ai-env-ready",
        role: "ai",
        orderKey: nextKey(),
        body: "환경이 준비되었습니다.",
      });
    } else {
      return out;
    }
  } else if (!p.canRequestGenerationEnvOk) {
    return out;
  }

  const unitsForGate = sortedUnits(p.latestRun);
  if (p.isFailed && !p.isDeployFailed && p.latestRun?.id && unitsForGate.length === 0) {
    const lines: string[] = [];
    if (p.latestRun.plannerError?.trim()) lines.push(String(p.latestRun.plannerError).trim());
    if (p.latestRun.statusReason) lines.push(`사유 코드: ${p.latestRun.statusReason}`);
    out.push({
      id: "ai-planner-failed-preplan",
      role: "ai",
      orderKey: nextKey(),
      title: "작업계획 생성 중 문제가 발생했습니다.",
      blocks: lines.length ? [{ kind: "bullet_list", items: lines }] : [{ kind: "text", text: "세부 사유를 확인할 수 없습니다." }],
      actions: [
        { id: "a-retry-planner", label: "다시 시도", intent: "RETRY_PLANNER_GENERATION", disabled: p.protoBusy },
        { id: "a-restart-planner-fail", label: "처음부터 다시 생성", intent: "RESTART_RUN", disabled: p.protoBusy },
      ],
    });
    return out;
  }

  if (p.isCancelled && p.latestRun?.id) {
    out.push({
      id: "ai-cancelled",
      role: "ai",
      orderKey: nextKey(),
      title: "실행이 중단되었습니다.",
      body: "이전 실행이 중단되었습니다. 이어 진행하거나 처음부터 다시 생성할 수 있습니다.",
      actions: [
        { id: "a-resume", label: "이어 진행", intent: "RESUME_RUN", disabled: false },
        { id: "a-restart", label: "처음부터 다시 생성", intent: "RESTART_RUN", disabled: false },
      ],
    });
    return out;
  }

  if ((p.isFailed || p.isDeployFailed) && p.latestRun?.id) {
    const fu = firstFailedUnit(p.latestRun);
    const lines: string[] = [];
    if (p.latestRun.statusReason) lines.push(`사유 코드: ${p.latestRun.statusReason}`);
    if (p.latestRun.deployFailureDetail?.trim()) lines.push(String(p.latestRun.deployFailureDetail));
    if (fu) lines.push(`실패 작업: #${fu.order} ${fu.title}`);
    out.push({
      id: "ai-failed",
      role: "ai",
      orderKey: nextKey(),
      title: "실행 중 문제가 발생했습니다.",
      blocks: lines.length ? [{ kind: "bullet_list", items: lines }] : [{ kind: "text", text: "자세한 사유는 아래를 확인해 주세요." }],
      actions: [
        { id: "a-resume-f", label: "이어 진행", intent: "RESUME_RUN" },
        { id: "a-restart-f", label: "처음부터 다시 생성", intent: "RESTART_RUN" },
        ...(fu ? [{ id: "a-retry-wu", label: "실패 작업 재실행", intent: "RETRY_FAILED_WU" as const, workUnitOrder: fu.order }] : []),
      ],
    });
    return out;
  }

  if (p.latestRun?.id && p.latestRun.status === "BLOCKED") {
    const lines: string[] = [];
    if (p.latestRun.statusReason) lines.push(`사유 코드: ${p.latestRun.statusReason}`);
    out.push({
      id: "ai-blocked",
      role: "ai",
      orderKey: nextKey(),
      title: "자동 생성이 중단되었습니다.",
      body: "Cursor 자동 실행을 시작할 수 없는 상태입니다. 실행 설정을 확인한 뒤 상태를 새로고침해 주세요.",
      blocks: lines.length ? [{ kind: "bullet_list", items: lines }] : undefined,
      actions: [
        { id: "a-env-b", label: "환경설정 열기", intent: "OPEN_ENV_SETTINGS" },
        { id: "a-refresh-b", label: "상태 새로고침", intent: "REFRESH_STATUS" },
        { id: "a-restart-b", label: "처음부터 다시 생성", intent: "RESTART_RUN" },
      ],
    });
    return out;
  }

  const templateReadyForPlanning = p.templateConfirmed || p.templatePlanningReady === true;

  /** 구현 bootstrap(omitEnvReadinessCard) 또는 환경 미완료 시 템플릿 선택 말풍선 숨김 */
  const showPreRunTemplateRow =
    p.canRequestGenerationEnvOk &&
    !p.omitEnvReadinessCard &&
    !shouldLockInlineChatTemplateSelection(p.latestRun) &&
    hasNoWorkUnitsYet(p.latestRun) &&
    !p.isCancelled &&
    !p.isFailed &&
    !p.isDeployFailed;

  if (showPreRunTemplateRow) {
    out.push({
      id: "ai-template-combo-hint",
      role: "ai",
      orderKey: nextKey(),
      title: "템플릿 선택",
      body: p.templateConfirmed
        ? p.isPlannerRunning || p.plannerCreatePending
          ? "지금 템플릿을 바꾸면 작업계획 생성이 처음부터 다시 시작됩니다. 변경 후 다시 [확정]을 눌러 주세요."
          : "템플릿이 확정되었습니다. 다른 유형으로 바꾸면 자동으로 확정이 해제되니, 변경 후 다시 [확정]을 눌러 주세요."
        : "AI 추천 템플릿을 기본값으로 사용합니다. 필요하면 템플릿을 변경하거나 미리볼 수 있습니다.",
      inlineTemplatePicker: true,
    });
    if (!templateReadyForPlanning) return out;
  }

  const planningUiActive = (p.isPlannerRunning || p.plannerCreatePending) && hasNoWorkUnitsYet(p.latestRun);
  if (planningUiActive) {
    const step = Math.min(5, Math.max(1, Math.floor(Number(p.plannerProgressStep) || 1)));
    out.push({
      id: "ai-planner-running",
      role: "ai",
      orderKey: nextKey(),
      title: "작업계획을 생성 중입니다.",
      body: "① 서버에 실행 생성 요청이 반영되었습니다.\n② OpenAI(Chat Completions)로 WorkUnit 초안을 생성하는 중입니다. (키가 없으면 보조 규칙 모드로 진행됩니다.)\n③ 아래 단계 표가 실시간으로 갱신됩니다.",
      blocks: [{ kind: "planner_stage_progress", currentStep: step }],
    });
    return out;
  }

  const canShowCreatePlanCard =
    !p.latestRun?.id || p.latestRun.status === "DRAFT" || p.latestRun.status === "PROMPT_READY";
  const showNeedCreatePlan =
    templateReadyForPlanning &&
    hasNoWorkUnitsYet(p.latestRun) &&
    !p.isPlannerRunning &&
    !p.plannerCreatePending &&
    canShowCreatePlanCard &&
    p.prePlanGate === "need_create_click";

  if (showNeedCreatePlan) {
    out.push({
      id: "ai-preplan",
      role: "ai",
      orderKey: nextKey(),
      body: "프로토타입 제작을 위한 작업 목록을 만들겠습니다.",
      actions: [
        {
          id: "a-create-plan",
          label: "작업계획 생성",
          intent: "CREATE_PLAN",
          disabled:
            p.protoBusy ||
            p.plannerCreatePending ||
            p.isPlannerRunning ||
            !p.canRequestGenerationDesignOk,
        },
        {
          id: "a-open-planner-prompt-preplan",
          label: "프롬프트 보기",
          intent: "OPEN_PLANNER_PROMPT_IN_CHAT",
          disabled: p.protoBusy || p.plannerCreatePending || p.isPlannerRunning,
        },
      ],
    });
    return out;
  }

  const run = p.latestRun;
  const units = sortedUnits(run);
  const plannerDone = run?.plannerStatus === "DONE" || units.length > 0;

  if (run?.id && units.length > 0 && plannerDone) {
    const titles = units.map((u) => ({ order: u.order, title: u.title }));
    const planActions: PrototypeChatAction[] = [];
    if (p.awaitingExecutionConfirm) {
      planActions.push(
        { id: "a-go", label: "이 계획으로 실행", intent: "CONFIRM_EXECUTION", disabled: !p.automationAvailable },
        { id: "a-regen", label: "작업계획 다시 생성", intent: "REGENERATE_PLAN" },
        { id: "a-mod", label: "수정 요청", intent: "MODIFY_REQUEST" },
      );
    }
    out.push({
      id: `ai-plan-${run.id}-${units.length}`,
      role: "ai",
      orderKey: nextKey(),
      title: "작업계획이 생성되었습니다.",
      body: `총 ${units.length}개의 작업으로 구성했습니다.`,
      blocks: [{ kind: "ordered_titles", items: titles }],
      actions: planActions.length ? planActions : undefined,
    });
    if (p.awaitingExecutionConfirm) return out;
  }

  if (p.isCompleted && run?.id) {
    const url = (p.previewUrl ?? run.previewUrl ?? run.suggestedPreviewUrl ?? "").trim();
    const note =
      "프로토타입 초안이 생성되었습니다. 검토 화면에서 Preview를 확인하세요." +
      (url ? " (GitHub Pages 기준 후보 URL이며, 정식 공개는 검토 단계의 배포 요청 후에 이루어집니다.)" : "");
    out.push({
      id: "ai-done",
      role: "ai",
      orderKey: nextKey(),
      title: "초안 생성 완료",
      body: note,
      blocks: url ? [{ kind: "url_line", url }] : undefined,
      actions: [
        { id: "a-open", label: "결과 보기", intent: "OPEN_PREVIEW", disabled: !url },
        { id: "a-copy", label: "URL 복사", intent: "COPY_PREVIEW_URL", disabled: !url },
        {
          id: "a-review",
          label: "프로토타입 검토로 이동",
          intent: "OPEN_PROTOTYPE_REVIEW",
          disabled: !p.projectId.trim(),
        },
        { id: "a-restart-done", label: "처음부터 다시 생성", intent: "RESTART_RUN" },
      ],
    });
    return out;
  }

  if (p.isDeployPhase && run?.id && !p.isCompleted) {
    const actionsUrl = p.pagesDeployWorkflowRunUrl?.trim() ?? "";
    const lines: string[] = [];
    const s = run.status;
    if (s === "MERGED") lines.push("GitHub Pages 설정: 준비");
    if (s === "DEPLOY_CONFIGURING") lines.push("GitHub Pages 설정: 진행 중");
    if (s === "DEPLOYING") lines.push("GitHub Actions 배포: 진행 중");
    lines.push("결과 URL: 확인 중");
    out.push({
      id: "ai-deploy",
      role: "ai",
      orderKey: nextKey(),
      title: "모든 WorkUnit이 완료되었습니다.",
      body: "플랫폼이 GitHub Pages 배포를 진행합니다.",
      blocks: [{ kind: "bullet_list", items: lines }],
      actions: [
        ...(actionsUrl ? [{ id: "a-actions", label: "Actions 보기", intent: "OPEN_ACTIONS_URL" as const }] : []),
        { id: "a-refresh-d", label: "상태 새로고침", intent: "REFRESH_STATUS" },
      ],
    });
    return out;
  }

  if (p.isRunningState && run?.id && units.length > 0 && !p.isDeployPhase) {
    const active = resolveActiveWorkUnitForPanel(run);
    const total = units.length;
    const current = active?.order ?? run.currentWorkUnitOrder ?? 1;
    const rows = active ? buildFiveStepPipelineRows(active, run) : [];
    const act: PrototypeChatAction[] = [
      { id: "a-ref-r", label: "상태 새로고침", intent: "REFRESH_STATUS" },
      { id: "a-can", label: "자동 생성 중단", intent: "CANCEL_RUN" },
    ];
    if (active?.cursorPrompt?.trim()) {
      act.push({ id: "a-cp", label: "Cursor 프롬프트 보기", intent: "OPEN_CURSOR_PROMPT", workUnitOrder: active.order });
    }
    if (active?.prUrl?.trim()) {
      act.push({ id: "a-pr", label: "PR 보기", intent: "OPEN_PR_URL", workUnitOrder: active.order });
    }
    out.push({
      id: `ai-run-${run.id}-${current}`,
      role: "ai",
      orderKey: nextKey(),
      title: `현재 WorkUnit ${current} / ${total}을 진행 중입니다.`,
      body: active ? active.title : "진행 중인 작업을 확인하는 중입니다.",
      blocks: (() => {
        const blocks: PrototypeChatBlock[] = [];
        if (rows.length) {
          blocks.push({ kind: "pipeline_grid", rows: rows.map((r) => ({ label: r.label, stateKo: r.stateKo, tone: r.tone })) });
        }
        if (active) {
          const lines: string[] = [];
          if (active.cursorRunId?.trim()) lines.push(`Cursor 에이전트 ID: ${active.cursorRunId.trim()}`);
          if (active.cursorAgentStatusUpper?.trim()) lines.push(`Cursor 상태: ${active.cursorAgentStatusUpper.trim()}`);
          const started = active.executionStartedAt ?? active.startedAt;
          if (started) {
            const t0 = Date.parse(started);
            if (Number.isFinite(t0)) lines.push(`실행 경과: ${formatDurationKo(Date.now() - t0)}`);
          }
          if (active.cursorLastPolledAt) {
            const t1 = Date.parse(active.cursorLastPolledAt);
            if (Number.isFinite(t1)) lines.push(`마지막 상태 확인: ${formatDurationKo(Date.now() - t1)} 전`);
          }
          if (active.cursorLastSummary?.trim()) lines.push(`최근 요약: ${active.cursorLastSummary.trim()}`);
          const tStarted = parseIsoMs(active.executionStartedAt ?? active.startedAt);
          const longRunning = tStarted ? Date.now() - tStarted > 10 * 60 * 1000 : false;
          if (longRunning && (active.cursorAgentStatusUpper ?? "").toUpperCase() === "RUNNING") {
            lines.push("Cursor 실행이 장시간 진행 중입니다. 필요하면 [자동 생성 중단] 후 다시 시도해 주세요.");
          }
          if (lines.length) blocks.push({ kind: "bullet_list", items: lines });
        }
        return blocks.length ? blocks : undefined;
      })(),
      actions: act,
    });
    return out;
  }

  if (run?.id && units.length === 0 && !p.isPlannerRunning && !p.plannerCreatePending && templateReadyForPlanning) {
    out.push({
      id: "ai-preplan-run",
      role: "ai",
      orderKey: nextKey(),
      body: "실행은 시작됐지만 아직 작업 목록이 비어 있습니다. 상태를 새로고침하거나 잠시 후 다시 확인해 주세요.",
      actions: [{ id: "a-refresh-1", label: "상태 새로고침", intent: "REFRESH_STATUS" }],
    });
  }

  return out;
}

/** DB에 저장된 타임라인 카드를 채팅 말풍선 형태로 변환합니다. */
export function buildTimelineArchiveMessages(
  cards: readonly PrototypeWorkspaceTimelineCardV1[],
): readonly PrototypeChatBuiltMessage[] {
  const out: PrototypeChatBuiltMessage[] = [];
  let k = 0;
  const nextKey = () => ++k * 1000;
  for (const card of cards) {
    const baseId = `tl-${card.id}`;
    if (card.kind === "plan_ready") {
      let items: readonly { order: number; title: string }[] = [];
      const raw = card.workUnitTitlesJson?.trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            items = parsed
              .map((row) => {
                if (!row || typeof row !== "object") return null;
                const o = row as Record<string, unknown>;
                const order = typeof o.order === "number" && Number.isFinite(o.order) ? o.order : NaN;
                const title = typeof o.title === "string" ? o.title.trim() : "";
                if (!Number.isFinite(order) || !title) return null;
                return { order, title };
              })
              .filter((x): x is { order: number; title: string } => Boolean(x))
              .sort((a, b) => a.order - b.order);
          }
        } catch {
          items = [];
        }
      }
      out.push({
        id: baseId,
        role: "ai",
        orderKey: nextKey(),
        title: card.title,
        ...(card.body?.trim() ? { body: card.body.trim() } : {}),
        blocks: items.length ? [{ kind: "ordered_titles", items }] : undefined,
      });
      continue;
    }
    if (card.kind === "workunit_merged") {
      const lines: string[] = [];
      if (card.body?.trim()) lines.push(card.body.trim());
      if (card.prUrl?.trim()) lines.push(`PR: ${card.prUrl.trim()}`);
      out.push({
        id: baseId,
        role: "ai",
        orderKey: nextKey(),
        title: card.title,
        blocks: lines.length ? [{ kind: "bullet_list", items: lines }] : undefined,
      });
      continue;
    }
  }
  return out;
}

/**
 * 현재 단계용 `live` 메시지 앞에, 완료된 WorkUnit·계획 카드가 자연스럽게 끼어들도록 합칩니다.
 * (정렬 키만으로는 실행 중 카드보다 앞선 완료 카드를 표현하기 어려워 별도 합성합니다.)
 */
export function mergeTimelineArchiveIntoLive(
  live: readonly PrototypeChatBuiltMessage[],
  arch: readonly PrototypeChatBuiltMessage[],
): readonly PrototypeChatBuiltMessage[] {
  if (!arch.length) return live;
  const wuOrder = (m: PrototypeChatBuiltMessage): number => {
    const m2 = /^tl-wu-(\d+)-/.exec(m.id);
    return m2 ? Number(m2[1]) : 0;
  };
  const planArch = arch.filter((m) => m.id.startsWith("tl-plan-"));
  const wuArch = arch
    .filter((m) => m.id.startsWith("tl-wu-"))
    .slice()
    .sort((a, b) => wuOrder(a) - wuOrder(b));

  const iRun = live.findIndex((m) => m.id.startsWith("ai-run-"));
  const iDeploy = live.findIndex((m) => m.id === "ai-deploy");
  const iDone = live.findIndex((m) => m.id === "ai-done");
  const insertBeforeDynamic =
    iRun >= 0 ? iRun : iDeploy >= 0 ? iDeploy : iDone >= 0 ? iDone : Math.max(0, live.length);

  let merged = [...live];
  const insertBlock = [...planArch, ...wuArch];
  if (insertBlock.length) {
    merged = [...merged.slice(0, insertBeforeDynamic), ...insertBlock, ...merged.slice(insertBeforeDynamic)];
  }
  return merged.map((m, i) => ({ ...m, orderKey: (i + 1) * 1000 }));
}

/** WorkUnit이 모두 끝난 뒤 배포 단계인지 */
export function isPrototypeDeployPhase(run: PrototypeRun | null): boolean {
  if (!run) return false;
  if (!workUnitProgressAllMerged(run)) return false;
  return run.status === "MERGED" || run.status === "DEPLOY_CONFIGURING" || run.status === "DEPLOYING";
}
