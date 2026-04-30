import { buildFiveStepPipelineRows, resolveActiveWorkUnitForPanel, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import type { PrototypeRun, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";

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

/** 템플릿 선택 후 작업계획 API 호출 전 단계 */
export type PrototypePrePlanGate = "idle" | "need_create_click" | "await_work_start";

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
  | { kind: "url_line"; url: string };

export type PrototypeChatBuiltMessage = Readonly<{
  id: string;
  role: PrototypeChatMessageRole;
  /** 정렬·병합용: 증가하는 단조 키 */
  orderKey: number;
  title?: string;
  body?: string;
  blocks?: readonly PrototypeChatBlock[];
  actions?: readonly PrototypeChatAction[];
}>;

export type BuildPrototypeChatMessagesParams = Readonly<{
  env: PrototypeChatEnvSnapshot;
  canRequestGenerationEnvOk: boolean;
  canRequestGenerationDesignOk: boolean;
  envSettingsHref: string;
  recommendedTemplateNameKo: string;
  templateChipTemplates: readonly { id: string; nameKo: string }[];
  recommendedTemplateId: string;
  chatTemplateSelected: boolean;
  /** 템플릿은 상단 콤보로만 선택; 타임라인에는 가로 칩을 넣지 않음 */
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
      body: "환경이 준비되었습니다. 템플릿을 선택한 뒤 작업계획을 만들 수 있습니다.",
    });
  } else {
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

  if (!p.chatTemplateSelected) {
    out.push({
      id: "ai-template-combo-hint",
      role: "ai",
      orderKey: nextKey(),
      title: "템플릿 선택",
      body: `화면 상단의 템플릿 목록에서 유형을 선택해 주세요. 설계 기준 추천 템플릿은 ${p.recommendedTemplateNameKo} 입니다.`,
    });
    return out;
  }

  if (p.isPlannerRunning && p.latestRun?.id) {
    out.push({
      id: "ai-planner-running",
      role: "ai",
      orderKey: nextKey(),
      title: "작업계획 생성",
      body: "아이디어 구체화·액터 및 서비스 흐름 산출물을 바탕으로 작업계획을 생성하는 중입니다…",
    });
    return out;
  }

  if (p.prePlanGate === "await_work_start" && !p.latestRun?.id && !p.isPlannerRunning) {
    out.push({
      id: "ai-preplan-await-start",
      role: "ai",
      orderKey: nextKey(),
      body: "아이디어 구체화·액터 및 서비스 흐름 산출물을 바탕으로 작업계획을 생성하는 중입니다…",
      actions: [
        { id: "a-open-planner-prompt", label: "프롬프트 보기", intent: "OPEN_PLANNER_PROMPT_IN_CHAT", disabled: p.protoBusy },
        {
          id: "a-start-work",
          label: "작업 시작",
          intent: "START_WORK_PLAN_GENERATION",
          disabled: p.protoBusy || !p.canRequestGenerationDesignOk,
        },
      ],
    });
    return out;
  }

  const showNeedCreatePlan =
    p.chatTemplateSelected && !p.latestRun?.id && !p.isPlannerRunning && p.prePlanGate !== "await_work_start";

  if (showNeedCreatePlan) {
    out.push({
      id: "ai-preplan",
      role: "ai",
      orderKey: nextKey(),
      body: "아이디어 구체화 결과와 액터 및 서비스 흐름 정의 결과를 바탕으로 Cursor가 작업하기 좋은 제작 작업목록을 만들겠습니다.",
      actions: [
        {
          id: "a-create-plan",
          label: "작업계획 생성",
          intent: "CREATE_PLAN",
          disabled: p.protoBusy || !p.canRequestGenerationDesignOk,
        },
        { id: "a-refresh-0", label: "상태 새로고침", intent: "REFRESH_STATUS", disabled: p.protoBusy },
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

  if (run?.id && units.length === 0 && !p.isPlannerRunning && p.chatTemplateSelected) {
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
