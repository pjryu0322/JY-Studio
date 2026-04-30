import { buildFiveStepPipelineRows, resolveActiveWorkUnitForPanel, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
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
  | "COPY_PREVIEW_URL";

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

  /** PROMPT_READY 등 실행 row만 있고 아직 WU가 없을 때도 콤보 노출 — `!latestRun?.id`만 보면 스텁 때문에 말풍선이 사라짐 */
  const showPreRunTemplateRow =
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
        ? (p.isPlannerRunning || p.plannerCreatePending
            ? "지금 템플릿을 바꾸면 작업계획 생성이 처음부터 다시 시작됩니다. 변경 후 다시 [확정]을 눌러 주세요."
            : "템플릿이 확정되었습니다. 다른 유형으로 바꾸면 자동으로 확정이 해제되니, 변경 후 다시 [확정]을 눌러 주세요.")
        : "콤보에서 프로토타입 유형을 고른 뒤 [확정]을 눌러 주세요. [미리보기]로 화면 형태를 먼저 볼 수 있습니다.",
      inlineTemplatePicker: true,
    });
    if (!p.templateConfirmed) return out;
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
    p.templateConfirmed &&
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
    const url = (p.previewUrl ?? run.previewUrl ?? "").trim();
    out.push({
      id: "ai-done",
      role: "ai",
      orderKey: nextKey(),
      title: "프로토타입 생성이 완료되었습니다.",
      blocks: url ? [{ kind: "url_line", url }] : undefined,
      actions: [
        { id: "a-open", label: "결과 보기", intent: "OPEN_PREVIEW", disabled: !url },
        { id: "a-copy", label: "URL 복사", intent: "COPY_PREVIEW_URL", disabled: !url },
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
    const rows = active ? buildFiveStepPipelineRows(active) : [];
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
      blocks: rows.length ? [{ kind: "pipeline_grid", rows: rows.map((r) => ({ label: r.label, stateKo: r.stateKo, tone: r.tone })) }] : undefined,
      actions: act,
    });
    return out;
  }

  if (run?.id && units.length === 0 && !p.isPlannerRunning && !p.plannerCreatePending && p.templateConfirmed) {
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

/** WorkUnit이 모두 끝난 뒤 배포 단계인지 */
export function isPrototypeDeployPhase(run: PrototypeRun | null): boolean {
  if (!run) return false;
  if (!workUnitProgressAllMerged(run)) return false;
  return run.status === "MERGED" || run.status === "DEPLOY_CONFIGURING" || run.status === "DEPLOYING";
}
