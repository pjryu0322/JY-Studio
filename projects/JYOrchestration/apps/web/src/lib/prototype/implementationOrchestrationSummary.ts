import { getWorkspaceAiMember, type WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { PrototypeChatEnvBadge, PrototypeChatEnvSnapshot } from "@/lib/prototype/buildPrototypeChatMessages";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { PROJECT_ARTIFACT_LABELS, type ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";

export const IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE = "IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_V1";

export type ImplementationOrchestrationSummaryInput = Readonly<{
  readonly projectId: string;
  readonly env: PrototypeChatEnvSnapshot;
  readonly envOk: boolean;
  readonly envSettingsHref: string;
  readonly featureDraftTitles: readonly string[];
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1: ArtifactOrchestrationStateV1 | null | undefined;
  readonly designOk: boolean;
  readonly nowIso?: string;
}>;

function envLineState(b: PrototypeChatEnvBadge): string {
  if (b === "ok") return "완료";
  if (b === "error") return "오류";
  if (b === "loading") return "대기";
  return "필요";
}

function defaultTaskTitles(input: ImplementationOrchestrationSummaryInput): string[] {
  const fromFeatures = input.featureDraftTitles.map((t) => String(t ?? "").trim()).filter(Boolean);
  if (fromFeatures.length) return fromFeatures.slice(0, 8);
  const fromArtifacts = input.projectArtifacts
    .map((a) => String(a.title ?? PROJECT_ARTIFACT_LABELS[a.type as ProjectArtifactType] ?? a.type).trim())
    .filter(Boolean);
  if (fromArtifacts.length) return fromArtifacts.slice(0, 8);
  const planned = input.artifactOrchestrationV1?.planned ?? [];
  return planned.map((p) => String(p.title ?? "").trim()).filter(Boolean).slice(0, 8);
}

function implementationEntryChips(input: ImplementationOrchestrationSummaryInput): readonly string[] {
  const base = ["구현 작업안 확정", "환경설정 열기", "구현 범위 수정", "산출물 다시 보기"];
  if (input.envOk && input.designOk) return [...base, "구현 실행"];
  return base;
}

function memberMessage(input: {
  readonly memberId: WorkspaceAiMemberId;
  readonly speakerName?: string;
  readonly content: string;
  readonly suggestions?: readonly string[];
  readonly order: number;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember(input.memberId);
  const title = input.speakerName?.trim() || def?.title || input.memberId;
  return newRequirementsMessage({
    id: `impl-orch-bootstrap-${input.memberId}-${input.order}`,
    role: "ai",
    speakerType: "AI",
    speakerId: input.memberId,
    speakerName: title,
    messageType: "STATEMENT",
    content: input.content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: input.suggestions?.length ? [...input.suggestions] : undefined,
      interviewAllowCustomInput: true,
      prototypeOrderKey: input.order * 1000,
    },
  });
}

export function hasImplementationOrchestrationBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => m.meta.internalType === IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE);
}

/** 구현 단계 진입 시 AI멤버별 제안 메시지(환경 readiness는 SCM 메시지에 포함). */
export function buildImplementationOrchestrationSummary(
  input: ImplementationOrchestrationSummaryInput,
): readonly RequirementsMessage[] {
  const now = input.nowIso ?? new Date().toISOString();
  const tasks = defaultTaskTitles(input);
  const chips = implementationEntryChips(input);
  const out: RequirementsMessage[] = [];
  let order = 1;

  const devLines: string[] = [
    "현재 산출물 기준으로 다음 구현 task를 제안합니다.",
    "",
    ...tasks.map((t, i) => `${i + 1}. ${t}`),
    "",
    "현재 개발 준비 상태:",
    `- Git 저장소: ${envLineState(input.env.git)}`,
    `- AI 개발 도구 연결: ${envLineState(input.env.cursor)}`,
  ];
  if (!tasks.length) {
    devLines.splice(1, 0, "기능·산출물에서 구체 task를 추출하지 못했습니다. 구현 범위 수정으로 범위를 알려 주세요.");
  }

  out.push(
    memberMessage({
      memberId: "prototype_build",
      content: devLines.join("\n"),
      suggestions: order === 1 ? chips : undefined,
      order: order++,
      nowIso: now,
    }),
  );

  out.push(
    memberMessage({
      memberId: "prototype_review",
      content: [
        "기능 정의서와 화면 정의서 기준으로 다음 검수 기준이 필요합니다.",
        "",
        "- 업로드·입력 실패 처리",
        "- 대용량·장시간 처리 시 사용자 안내",
        "- 빈 결과·부분 실패 시 복구 경로",
        "- 요약·산출물 수정 가능 여부",
      ].join("\n"),
      order: order++,
      nowIso: now,
    }),
  );

  out.push(
    memberMessage({
      memberId: "security_reviewer",
      content: [
        "구현 범위에는 다음 보안·프라이버시 기준이 필요합니다.",
        "",
        "- 허용 파일 형식·크기 제한",
        "- 개인정보·민감 데이터 처리·보관 정책",
        "- 외부 연동 시 자격·토큰 노출 방지",
        "- 임시 파일·로그 보관·삭제",
      ].join("\n"),
      order: order++,
      nowIso: now,
    }),
  );

  const scmLines = [
    "구현 실행을 위해 연결 상태를 점검했습니다.",
    "",
    `- Git 저장소: ${envLineState(input.env.git)}`,
    `- GitHub 인증: ${envLineState(input.env.github)}`,
    `- 코드 실행 엔진: ${envLineState(input.env.cursor)}`,
    `- 연결 테스트: ${envLineState(input.env.connectionTest)}`,
    "",
    input.envOk
      ? "필수 연결은 준비된 상태입니다. 작업안을 확정한 뒤 구현 실행을 진행할 수 있습니다."
      : "환경설정이 필요한 항목이 있습니다. 아래에서 [환경설정 열기]로 세부 설정을 완료해 주세요.",
  ];

  out.push(
    memberMessage({
      memberId: "memo",
      speakerName: "SCM",
      content: scmLines.join("\n"),
      suggestions: !input.envOk ? ["환경설정 열기", "상태 새로고침"] : ["상태 새로고침"],
      order: order++,
      nowIso: now,
    }),
  );

  return out;
}
