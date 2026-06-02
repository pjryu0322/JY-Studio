import { formatPrototypeTemplateLayoutContract } from "@/lib/prototype/prototypeTemplateLayoutContract";
import {
  PROTOTYPE_TEMPLATES,
  buildPrototypeRecommendationCorpus,
  recommendPrototypeTemplateFromContext,
  type PrototypeRecommendationContext,
  type PrototypeTemplate,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

export const DEV_FRAME_TASK_ID = "DEV-FRAME-001" as const;

export type SelectedPrototypeTemplateSource = "recommended" | "user_selected" | "fallback";

export type SelectedPrototypeTemplateV1 = Readonly<{
  templateId: PrototypeTemplateType;
  templateNameKo: string;
  templateNameEn: string;
  description: string;
  navigationItems: readonly string[];
  summaryCards: readonly string[];
  primarySections: readonly string[];
  layoutContract: string;
  source: SelectedPrototypeTemplateSource;
  matchedKeywords?: readonly string[];
  score?: number;
}>;

function findTemplate(templateId: PrototypeTemplateType): PrototypeTemplate {
  return PROTOTYPE_TEMPLATES.find((t) => t.id === templateId) ?? PROTOTYPE_TEMPLATES[1]!;
}

function appendMobileShellNote(layoutContract: string, corpus: string): string {
  const text = corpus.toLowerCase();
  const mobileLike =
    /(모바일|mobile|앱\s*서비스|단일\s*서비스|native\s*app|ios|android)/i.test(text);
  if (!mobileLike) return layoutContract;
  return [
    layoutContract,
    "",
    "모바일 단일 서비스 shell:",
    "- mobile service shell 기준 viewport/container를 우선 적용합니다.",
    "- 데스크톱 템플릿 IA는 모바일 drawer/stack navigation으로 재배치합니다.",
  ].join("\n");
}

export function buildSelectedPrototypeTemplate(input: {
  readonly templateId: PrototypeTemplateType;
  readonly source: SelectedPrototypeTemplateSource;
  readonly matchedKeywords?: readonly string[];
  readonly score?: number;
  readonly recommendationCorpus?: string;
}): SelectedPrototypeTemplateV1 {
  const template = findTemplate(input.templateId);
  const corpus = input.recommendationCorpus ?? "";
  const layoutContract = appendMobileShellNote(
    formatPrototypeTemplateLayoutContract(template.id),
    corpus,
  );
  return {
    templateId: template.id,
    templateNameKo: template.nameKo,
    templateNameEn: template.nameEn,
    description: template.description,
    navigationItems: template.navigationItems,
    summaryCards: template.summaryCards,
    primarySections: template.primarySections,
    layoutContract,
    source: input.source,
    ...(input.matchedKeywords?.length ? { matchedKeywords: [...input.matchedKeywords] } : {}),
    ...(typeof input.score === "number" ? { score: input.score } : {}),
  };
}

export function buildPrototypeRecommendationContextFromSeed(input: {
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly seed: ImplementationSeedV1;
}): PrototypeRecommendationContext {
  const flowStepTitles = input.seed.processImplementationItems.map((p) => p.processName);
  const actorNames = input.seed.actorCapabilityMatrix.map((r) => r.actor);
  const ideationAssets = [
    ...input.seed.screenImplementationItems.map((s) => ({
      type: "screen",
      title: s.screenName,
      content: [...s.actions, ...s.states].join("\n"),
    })),
    ...input.seed.commonDetailFeatures.map((f) => ({
      type: "common_feature",
      title: f.name,
      content: f.description,
    })),
  ];
  return {
    ...(input.projectName?.trim() ? { projectName: input.projectName.trim() } : {}),
    ...(input.projectDescription?.trim()
      ? { projectDescription: input.projectDescription.trim() }
      : {}),
    ideationAssets,
    flowStepTitles,
    actorNames,
  };
}

export function resolveSelectedPrototypeTemplateForPlanning(input: {
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly seed: ImplementationSeedV1;
  readonly userSelectedTemplateId?: PrototypeTemplateType | null;
}): SelectedPrototypeTemplateV1 {
  const recCtx = buildPrototypeRecommendationContextFromSeed({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    seed: input.seed,
  });
  const corpus = buildPrototypeRecommendationCorpus(recCtx);
  const userId = input.userSelectedTemplateId?.trim() as PrototypeTemplateType | undefined;
  if (userId && PROTOTYPE_TEMPLATES.some((t) => t.id === userId)) {
    return buildSelectedPrototypeTemplate({
      templateId: userId,
      source: "user_selected",
      recommendationCorpus: corpus,
    });
  }

  const recommendation = recommendPrototypeTemplateFromContext(recCtx);
  if (!corpus.trim() || recommendation.score <= 0) {
    return buildSelectedPrototypeTemplate({
      templateId: "dashboard",
      source: "fallback",
      matchedKeywords: recommendation.matchedKeywords,
      score: recommendation.score,
      recommendationCorpus: corpus,
    });
  }

  return buildSelectedPrototypeTemplate({
    templateId: recommendation.templateId,
    source: "recommended",
    matchedKeywords: recommendation.matchedKeywords,
    score: recommendation.score,
    recommendationCorpus: corpus,
  });
}

export function attachTemplateContextToSeed(input: {
  readonly seed: ImplementationSeedV1;
  readonly templateContext: SelectedPrototypeTemplateV1;
}): ImplementationSeedV1 {
  return {
    ...input.seed,
    templateContext: input.templateContext,
    updatedAt: input.seed.updatedAt,
  };
}

export function shouldCreateDevFrameTask(seed: ImplementationSeedV1): boolean {
  return (
    (seed.screenImplementationItems?.length ?? 0) > 0 ||
    (seed.processImplementationItems?.length ?? 0) > 0 ||
    (seed.commonDetailFeatures?.length ?? 0) > 0
  );
}

const UI_ORIENTED_COMMON_KEYWORDS =
  /화면|ui|로딩|오류|에러|빈\s*결과|권한\s*안내|상태\s*표시|알림|toast|modal|navigation|메뉴|layout|레이아웃/i;

export function isUiOrientedCommonFeature(input: {
  readonly name: string;
  readonly description?: string;
}): boolean {
  const text = `${input.name} ${input.description ?? ""}`;
  return UI_ORIENTED_COMMON_KEYWORDS.test(text);
}
