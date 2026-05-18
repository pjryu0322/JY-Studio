import {
  recommendPrototypeTemplateFromContext,
  type PrototypeRecommendationContext,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";

export type PrototypeContextAnalysis = Readonly<{
  projectType: string;
  userType: string;
  workflowComplexity: "low" | "medium" | "high";
  recommendedTemplate: PrototypeTemplateType;
  /** 시드 템플릿 외에 함께 쓰면 좋은 화면 힌트 (문구만) */
  recommendedTemplateNotes: readonly string[];
  recommendedPages: readonly string[];
  priorityActions: readonly string[];
  confidence: number;
  missingItems: readonly string[];
}>;

type FlowLite = Readonly<{ title: string; purpose: string; primaryActorId: string }>;
type ActorLite = Readonly<{ name: string; kind: string }>;

function inferProjectType(corpus: string): string {
  const t = corpus.toLowerCase();
  if (/회의록|녹취|minutes|stt|문서\s*자동/.test(t)) return "workflow-document-ai";
  if (/예약|일정|booking|캘린더/.test(t)) return "booking-service";
  if (/상품|주문|판매|마켓|marketplace/.test(t)) return "marketplace";
  if (/랜딩|홍보|소개|가입\s*유도|브랜드/.test(t)) return "landing-marketing";
  if (/대시보드|관리자|운영|kpi|지표/.test(t)) return "internal-ops-dashboard";
  return "general-b2b-app";
}

function inferUserType(corpus: string): string {
  const t = corpus.toLowerCase();
  if (/b2b|기업|사내|팀|관리자/.test(t)) return "b2b-team";
  if (/소비자|일반\s*사용자|앱\s*유저/.test(t)) return "consumer";
  return "mixed";
}

function inferComplexity(steps: readonly FlowLite[]): "low" | "medium" | "high" {
  const n = steps.length;
  if (n <= 3) return "low";
  if (n <= 7) return "medium";
  return "high";
}

function buildRecommendedPages(
  steps: readonly FlowLite[],
  actors: readonly ActorLite[],
  corpus: string,
): string[] {
  const pages = new Set<string>();
  const blob = `${corpus} ${steps.map((s) => `${s.title} ${s.purpose}`).join(" ")}`;
  if (/로그인|인증|sso|회원/.test(blob)) pages.add("로그인 / 계정");
  if (/업로드|파일|첨부|등록/.test(blob)) pages.add("자료 업로드");
  if (/변환|추출|stt|텍스트/.test(blob)) pages.add("변환·처리 상태");
  if (/회의록|초안|문서|에디터/.test(blob)) pages.add("문서 편집");
  if (/승인|확정|결재/.test(blob)) pages.add("승인 요청·함");
  if (/공유|배포|알림|전달/.test(blob)) pages.add("공유·배포");
  if (/대시보드|현황|kpi|지표/.test(blob)) pages.add("관리자 대시보드");
  for (const a of actors) {
    if (a.kind === "human" && /관리|운영/.test(a.name)) pages.add(`${a.name} 콘솔`);
  }
  for (const s of steps.slice(0, 8)) {
    pages.add(s.title.trim() || "단계 화면");
  }
  return [...pages].slice(0, 12);
}

function buildPriorityActions(steps: readonly FlowLite[]): string[] {
  return steps.slice(0, 8).map((s) => s.title.trim()).filter(Boolean);
}

function buildMissingItems(
  ctx: {
    hasIdeaBody: boolean;
    hasActors: boolean;
    hasFlow: boolean;
    ownersComplete: boolean;
    slotGaps: readonly string[];
  },
): string[] {
  const m: string[] = [];
  if (!ctx.hasIdeaBody) m.push("아이디어 요약·배경 부족");
  if (!ctx.hasActors) m.push("액터 미정의");
  if (!ctx.hasFlow) m.push("서비스 흐름 미정의");
  if (ctx.hasFlow && !ctx.ownersComplete) m.push("단계별 담당 미지정");
  m.push(...ctx.slotGaps);
  return m.slice(0, 12);
}

export function analyzePrototypeContext(input: {
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly flowSteps?: readonly FlowLite[];
  readonly actors?: readonly ActorLite[];
  readonly checklistMissingLabels?: readonly string[];
}): PrototypeContextAnalysis {
  const recCtx: PrototypeRecommendationContext = {
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    ideationAssets: input.ideationAssets,
    flowStepTitles: (input.flowSteps ?? []).map((s) => s.title),
    actorNames: (input.actors ?? []).map((a) => a.name),
  };
  const rec = recommendPrototypeTemplateFromContext(recCtx);
  const corpus = [
    input.projectName,
    input.projectDescription,
    ...(input.ideationAssets ?? []).flatMap((a) => [a.title, a.content, a.type]),
    ...(input.flowSteps ?? []).map((s) => `${s.title} ${s.purpose}`),
    ...(input.actors ?? []).map((a) => a.name),
  ]
    .filter(Boolean)
    .join("\n");

  const steps = input.flowSteps ?? [];
  const actors = input.actors ?? [];
  const hasIdeaBody =
    Boolean(String(input.projectDescription ?? "").trim().length > 24) ||
    (input.ideationAssets?.some((a) => String(a.content ?? a.title ?? "").trim().length > 20) ?? false);
  const hasActors = actors.length >= 2;
  const hasFlow = steps.length >= 3;
  const ownersComplete = hasFlow && steps.every((s) => String(s.primaryActorId ?? "").trim().length > 0);

  const missingItems = buildMissingItems({
    hasIdeaBody,
    hasActors,
    hasFlow,
    ownersComplete,
    slotGaps: input.checklistMissingLabels ?? [],
  });

  const projectType = inferProjectType(corpus);
  const userType = inferUserType(corpus);
  const workflowComplexity = inferComplexity(steps);

  const recommendedPages = buildRecommendedPages(steps, actors, corpus);
  const priorityActions = buildPriorityActions(steps);

  const notes: string[] = [];
  if (projectType === "workflow-document-ai") {
    notes.push("워크플로·승인·문서 편집 화면을 함께 구성");
  } else if (rec.templateId === "dashboard") {
    notes.push("목록·상세·상태 위젯 중심");
  }

  const filledSignals = [hasIdeaBody, hasActors, hasFlow, ownersComplete].filter(Boolean).length;
  const confidence = Math.min(100, Math.round(rec.score * 0.45 + filledSignals * 12 + (steps.length > 0 ? 8 : 0)));

  return {
    projectType,
    userType,
    workflowComplexity,
    recommendedTemplate: rec.templateId,
    recommendedTemplateNotes: notes,
    recommendedPages,
    priorityActions,
    confidence,
    missingItems,
  };
}
