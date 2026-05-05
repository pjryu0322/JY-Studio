/**
 * 화면별 전담 AI 멤버(표시명·프롬프트·참여자 패널 공통).
 * ON/OFF: `NEXT_PUBLIC_AI_MEMBER_<KEY>=0|false` (예: NEXT_PUBLIC_AI_MEMBER_MEMO=0)
 */

import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";

export const WORKSPACE_AI_MEMBER_KEYS = [
  "ideation",
  "actor_flow",
  "feature_planning",
  "prototype_build",
  "designer",
  "prototype_review",
  "security_reviewer",
  "memo",
] as const;

export type WorkspaceAiMemberId = (typeof WORKSPACE_AI_MEMBER_KEYS)[number];

/** 아이콘 기반 기본 아바타(외부 URL 비사용). 향후 `avatarUrl`로 덮어쓸 수 있음. */
export const WORKSPACE_AI_AVATAR_GLYPH_KEYS = [
  "document-strategy",
  "data-flow",
  "checklist-blocks",
  "code-terminal",
  "palette-layout",
  "magnifier-check",
  "shield-lock",
  "clipboard-ops",
] as const;

export type WorkspaceAiAvatarGlyphKey = (typeof WORKSPACE_AI_AVATAR_GLYPH_KEYS)[number];

/** 실행 백엔드(연동·감사 표시용). `prototype_build`는 Cursor 기반 작업 흐름을 가정한다. */
export type WorkspaceAiExecutionProviderId = "openai" | "cursor";

/** 플랫폼 AI 멤버가 연 Integrations capability — 카탈로그 실행 주체(openai→LLM, cursor→CODE_AGENT)와 정렬 */
export type WorkspaceAiIntegrationCapability = "LLM" | "CODE_AGENT";

export type PlatformAiMemberDef = {
  readonly id: WorkspaceAiMemberId;
  /** 참여 멤버·토스트 등 UI 표시명 */
  readonly title: string;
  /** 한 줄 역할 */
  readonly briefRole: string;
  /** system 프롬프트 앞에 붙는 정체성(1~2문장) */
  readonly systemIdentity: string;
  /** LLM/에이전트 실행 제공자(참여 멤버 패널·운영 표시) */
  readonly executionProvider: WorkspaceAiExecutionProviderId;
  /** NEXT_PUBLIC_AI_MEMBER_<ENV_SUFFIX> — 없으면 기본 true */
  readonly envDisableSuffix: string;
  /** 기본 아바타 아이콘 키(커스텀 이미지와 구분) */
  readonly avatarGlyphKey: WorkspaceAiAvatarGlyphKey;
  /** 아바타 접근성·툴팁용 짧은 설명 */
  readonly avatarLabel: string;
  /** 아바타 테두리·아이콘 색(HEX) */
  readonly avatarAccent: string;
  /** 향후 프로젝트별 커스텀 이미지 URL — 사람 멤버 avatar와 저장소 분리 */
  readonly avatarUrl?: string | null;
};

/** API·설정 UI용 와이어(사용자 프로필과 필드명 혼동 방지: AI 전용). */
export type WorkspaceAiMemberProfileWire = Readonly<{
  id: string;
  displayName: string;
  roleType: string;
  avatarKey: string;
  avatarLabel: string;
  provider: WorkspaceAiExecutionProviderId;
  avatarUrl: string | null;
}>;

export function toWorkspaceAiMemberProfileWire(id: WorkspaceAiMemberId): WorkspaceAiMemberProfileWire | null {
  const m = getWorkspaceAiMember(id);
  if (!m) return null;
  return {
    id: m.id,
    displayName: m.title,
    roleType: m.id,
    avatarKey: m.avatarGlyphKey,
    avatarLabel: m.avatarLabel,
    provider: m.executionProvider,
    avatarUrl: m.avatarUrl ?? null,
  };
}

const MEMBERS: readonly PlatformAiMemberDef[] = [
  {
    id: "ideation",
    title: "AI 기획자",
    briefRole: "아이디어를 구체 요구사항으로 정리한다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 기획자」이다. 아이디어 구체화 단계에서 사용자와 대화하며 목표·범위·산출물을 명확히 한다.",
    executionProvider: "openai",
    envDisableSuffix: "IDEATION",
    avatarGlyphKey: "document-strategy",
    avatarLabel: "문서·전략",
    avatarAccent: "#2563eb",
    avatarUrl: null,
  },
  {
    id: "actor_flow",
    title: "AI 분석가",
    briefRole: "액터와 서비스 흐름을 함께 정의한다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 분석가」이다. 액터 및 서비스 흐름 정의 단계에서 역할·단계·승인 기준을 정리한다.",
    executionProvider: "openai",
    envDisableSuffix: "ACTOR_FLOW",
    avatarGlyphKey: "data-flow",
    avatarLabel: "데이터·흐름",
    avatarAccent: "#0d9488",
    avatarUrl: null,
  },
  {
    id: "feature_planning",
    title: "AI 기능설계자",
    briefRole: "기능 정리·체크리스트로 범위를 확정한다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 기능설계자」이다. 기능 정리 단계에서 대화와 체크리스트로 사용자 기능을 확정한다.",
    executionProvider: "openai",
    envDisableSuffix: "FEATURE_PLANNING",
    avatarGlyphKey: "checklist-blocks",
    avatarLabel: "블록·체크리스트",
    avatarAccent: "#7c3aed",
    avatarUrl: null,
  },
  {
    id: "prototype_build",
    title: "AI 개발자",
    briefRole: "프로토타입 생성·실행 계획을 돕는다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 개발자」이다. 프로토타입 생성 단계에서 작업 분해·실행·설명을 돕는다.",
    executionProvider: "cursor",
    envDisableSuffix: "PROTOTYPE_BUILD",
    avatarGlyphKey: "code-terminal",
    avatarLabel: "코드·터미널",
    avatarAccent: "#15803d",
    avatarUrl: null,
  },
  {
    id: "designer",
    title: "AI 디자이너",
    briefRole: "UI·레이아웃·시각 톤을 제안한다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 디자이너」이다. 기능·프로토타입 단계에서 레이아웃·타이포·색·간격·접근성을 고려한 UI 방향을 짧고 일관되게 제안한다.",
    executionProvider: "openai",
    envDisableSuffix: "DESIGNER",
    avatarGlyphKey: "palette-layout",
    avatarLabel: "팔레트·레이아웃",
    avatarAccent: "#db2777",
    avatarUrl: null,
  },
  {
    id: "prototype_review",
    title: "AI 검수자",
    briefRole: "프로토타입 검토·개선안을 정리한다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 검수자」이다. 프로토타입 검토 단계에서 품질·개선·요약을 돕는다.",
    executionProvider: "openai",
    envDisableSuffix: "PROTOTYPE_REVIEW",
    avatarGlyphKey: "magnifier-check",
    avatarLabel: "검수·확인",
    avatarAccent: "#ca8a04",
    avatarUrl: null,
  },
  {
    id: "security_reviewer",
    title: "AI 보안관",
    briefRole: "공개 배포 전 취약점·민감정보 노출을 점검한다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 보안관」이다. GitHub Pages 공개 배포 전에 소스·설정·URL 관점에서 보안·프라이버시 리스크를 식별하고 조치 우선순위를 제시한다.",
    executionProvider: "openai",
    envDisableSuffix: "SECURITY_REVIEWER",
    avatarGlyphKey: "shield-lock",
    avatarLabel: "보안 점검",
    avatarAccent: "#b91c1c",
    avatarUrl: null,
  },
  {
    id: "memo",
    title: "AI 운영자",
    briefRole: "메모 요약·요청 분류·우선순위 추천을 돕는다",
    systemIdentity:
      "당신의 공식 표시 이름은「AI 운영자」이다. 작업 메모를 한국어로 요약하고, 사용자의 요청을 짧게 분류하며, 처리 우선순위를 메모 근거로만 추천한다. 새 사실을 지어내지 않는다.",
    executionProvider: "openai",
    envDisableSuffix: "MEMO",
    avatarGlyphKey: "clipboard-ops",
    avatarLabel: "운영·정리",
    avatarAccent: "#475569",
    avatarUrl: null,
  },
];

const byId = Object.fromEntries(MEMBERS.map((m) => [m.id, m])) as Record<WorkspaceAiMemberId, PlatformAiMemberDef>;

export function primaryIntegrationCapabilityForCatalogMember(memberId: WorkspaceAiMemberId): WorkspaceAiIntegrationCapability {
  const m = byId[memberId];
  if (!m) return "LLM";
  return m.executionProvider === "cursor" ? "CODE_AGENT" : "LLM";
}

const EXECUTION_PROVIDER_LABEL: Record<WorkspaceAiExecutionProviderId, string> = {
  openai: "OpenAI",
  cursor: "Cursor",
};

export function getWorkspaceAiExecutionProviderLabel(memberId: WorkspaceAiMemberId): string {
  const m = byId[memberId];
  if (!m) return "";
  return EXECUTION_PROVIDER_LABEL[m.executionProvider] ?? m.executionProvider;
}

function readPublicEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

export function isWorkspaceAiMemberEnabled(id: WorkspaceAiMemberId): boolean {
  const m = byId[id];
  if (!m) return false;
  const raw = readPublicEnv(`NEXT_PUBLIC_AI_MEMBER_${m.envDisableSuffix}`)?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return true;
}

export function listEnabledWorkspaceAiMembers(): readonly PlatformAiMemberDef[] {
  return MEMBERS.filter((m) => isWorkspaceAiMemberEnabled(m.id));
}

/** 멤버 관리 UI — `NEXT_PUBLIC_AI_MEMBER_*` 비활성 여부와 무관한 전체 카탈로그 */
export function listPlatformAiMemberCatalog(): readonly PlatformAiMemberDef[] {
  return MEMBERS;
}

export function getWorkspaceAiMember(id: WorkspaceAiMemberId): PlatformAiMemberDef | undefined {
  return byId[id];
}

export function workspaceAiMemberSystemPrefix(id: WorkspaceAiMemberId): string {
  const m = byId[id];
  if (!m || !isWorkspaceAiMemberEnabled(id)) return "";
  return `${m.systemIdentity}\n\n`;
}

/**
 * 참여 멤버 패널용 — 활성 화면 담당 AI에 상태 라벨·강조 플래그 부여.
 */
function truncateParticipantHint(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildWorkspaceAiParticipantOptions(input: {
  /** 이 화면에서 활성(강조)할 플랫폼 AI — 복수 가능(목록은 이 집합에만 한정) */
  readonly currentMemberIds: readonly WorkspaceAiMemberId[];
  readonly statusLabelForCurrent: string;
  readonly activityByMember?: Partial<
    Record<WorkspaceAiMemberId, { readonly recentSnippet?: string; readonly statusHint?: string }>
  >;
}): ParticipantOption[] {
  const currentSet = new Set(input.currentMemberIds);
  const enabledSubset = listEnabledWorkspaceAiMembers().filter((m) => currentSet.has(m.id));
  return enabledSubset.map((m) => {
    const isCurrent = currentSet.has(m.id);
    const act = input.activityByMember?.[m.id];
    const recentRaw = (act?.recentSnippet ?? "").trim();
    const recentLabel = recentRaw ? `최근: ${truncateParticipantHint(recentRaw, 72)}` : undefined;
    const statusHint = (act?.statusHint ?? "").trim();
    return {
      id: `platform-ai:${m.id}`,
      name: m.title,
      kind: "ai",
      onlineHint: false,
      aiExecutionProviderLabel: getWorkspaceAiExecutionProviderLabel(m.id),
      aiStatusLabel: isCurrent ? input.statusLabelForCurrent : statusHint || undefined,
      aiRecentActivityLabel: isCurrent ? undefined : recentLabel,
      roleLabel: isCurrent ? "이 화면 참여" : "AI",
      platformMemberId: m.id,
      isCurrentScreenAi: isCurrent,
      aiAvatarGlyphKey: m.avatarGlyphKey,
      aiAvatarAccent: m.avatarAccent,
      aiAvatarLabel: m.avatarLabel,
      aiAvatarUrl: m.avatarUrl ?? null,
    };
  });
}

export function workspaceAiEntryToastMessage(memberId: WorkspaceAiMemberId): string {
  const m = byId[memberId];
  if (!m || !isWorkspaceAiMemberEnabled(memberId)) return "";
  return `「${m.title}」가 이 화면을 돕습니다.`;
}
