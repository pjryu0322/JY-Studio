/**
 * Slot/context 기반 artifact section generation — empty placeholder 제거.
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import { collectFastPlanFieldSnapshots } from "@/lib/requirements/fastPlanSlotAssumptions";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";
import { buildServiceFlowStateSummaryMessage } from "@/lib/requirements/serviceFlowProposalDecision";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type ArtifactSectionPlan = Readonly<{
  readonly artifactType: ProjectArtifactType;
  readonly sectionId: string;
  readonly title: string;
  readonly sourceSlots: readonly string[];
  readonly sourceRoles: readonly string[];
  readonly completeness: number;
}>;

export type ArtifactContentQuality = Readonly<{
  readonly completenessScore: number;
  readonly isPlaceholderOnly: boolean;
  readonly sections: readonly ArtifactSectionPlan[];
  readonly hubReadinessLabel: string;
  readonly improvementHint?: string;
}>;

export const PLACEHOLDER_CONTENT_MARKERS: readonly string[] = [
  "아직 비어 있습니다",
  "아직 없습니다",
  "데이터가 없습니다",
  "다시 생성해 주세요",
  "본문을 생성하지 못했",
  "내용이 부족",
] as const;

export type ArtifactSlotContext = Omit<FastPlanGenerationInput, "nowIso" | "sourceStage">;

function uniqueLines(items: readonly string[], max = 16): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const t = String(raw ?? "").trim();
    if (!t || t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function parseListFromText(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length >= 2);
  const inline = text.split(/[,·;]/).map((x) => x.trim()).filter((x) => x.length >= 2);
  return uniqueLines([...lines, ...inline], 16);
}

function linesFromMemberDraft(drafts: readonly PlatformMemberDraft[] | undefined, role: PlatformMemberRole): string[] {
  const body = String((drafts ?? []).find((d) => d.role === role)?.content ?? "").trim();
  if (!body) return [];
  return parseListFromText(body);
}

function defaultScreensForProject(projectName: string, projectDescription: string): string[] {
  const blob = `${projectName} ${projectDescription}`;
  if (/회의|녹취|minutes|meeting/i.test(blob)) {
    return ["회의 녹취 업로드 화면", "요약·TODO 결과 화면", "검수·승인 화면", "설정·연동 화면"];
  }
  return ["홈(대시보드)", "목록 화면", "상세·작업 화면", "설정 화면"];
}

function defaultFlowSteps(features: readonly string[], projectName: string): string[] {
  if (features.length >= 2) {
    return ["서비스 진입·인증", ...features.slice(0, 5).map((f) => `${f} 처리`), "결과 저장·공유"];
  }
  if (/회의|녹취/i.test(projectName)) {
    return [
      "사용자 로그인",
      "녹취 파일 업로드",
      "발화자 분리·전사",
      "주제별 요약 생성",
      "TODO·액션 아이템 추출",
      "검수·승인",
      "결과 저장·공유",
    ];
  }
  return ["서비스 진입", "핵심 작업 수행", "결과 확인", "저장·완료"];
}

function featureSectionsFromPlanning(fp: FeaturePlanningSlotsArtifactV1 | null | undefined): string[] {
  const names: string[] = [];
  for (const slot of fp?.slots ?? []) {
    if (slot.legacy) continue;
    const title = String(slot.slotName ?? slot.slotKey ?? "").trim();
    if (title) names.push(title);
    for (const item of slot.items ?? []) {
      const n = String(item.name ?? "").trim();
      if (n) names.push(n);
    }
  }
  return uniqueLines(names);
}

export function buildArtifactSectionPlans(input: {
  readonly artifactType: ProjectArtifactType;
  readonly collected: ReturnType<typeof collectFastPlanFieldSnapshots>;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly sourceSlotKeys?: readonly string[];
  readonly sourceRoles?: readonly string[];
}): readonly ArtifactSectionPlan[] {
  const { artifactType, collected } = input;
  const slots = input.sourceSlotKeys ?? [];
  const roles = input.sourceRoles ?? [];

  if (artifactType === "feature-spec") {
    const features = uniqueLines([
      ...featureSectionsFromPlanning(input.featurePlanning),
      ...collected.featureCandidates,
    ]);
    return features.map((title, i) => ({
      artifactType,
      sectionId: `feature-${i}`,
      title,
      sourceSlots: slots,
      sourceRoles: roles,
      completeness: title.length >= 4 ? 0.85 : 0.5,
    }));
  }

  if (artifactType === "screen-spec") {
    const screens = uniqueLines(collected.screenCandidates);
    return screens.map((title, i) => ({
      artifactType,
      sectionId: `screen-${i}`,
      title,
      sourceSlots: slots,
      sourceRoles: roles,
      completeness: 0.8,
    }));
  }

  if (artifactType === "service-flow-doc") {
    return collected.flowSteps.map((title, i) => ({
      artifactType,
      sectionId: `flow-${i}`,
      title,
      sourceSlots: slots,
      sourceRoles: roles,
      completeness: 0.85,
    }));
  }

  return [];
}

export function buildRichArtifactContent(input: {
  readonly artifactType: ProjectArtifactType;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly sourceStage: string;
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly featurePlanning: FeaturePlanningSlotsArtifactV1 | null;
  readonly slotContext: ArtifactSlotContext | null | undefined;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
}): string {
  const projectName = String(input.projectName ?? "프로젝트").trim() || "프로젝트";
  const desc = String(input.projectDescription ?? "").trim();
  const stage = String(input.sourceStage ?? "IDEATION");
  const ctx = input.slotContext;

  const collected =
    ctx ?
      collectFastPlanFieldSnapshots({
        orchestration: ctx.orchestration,
        definitions: ctx.slotDefinitions,
        interview: ctx.problemInterview,
        projectName: ctx.projectName ?? projectName,
        projectDescription: ctx.projectDescription ?? desc,
        conversationMessages: ctx.conversationMessages,
        serviceFlow: input.serviceFlow ?? ctx.serviceFlow,
        featurePlanning: input.featurePlanning ?? ctx.featurePlanning,
      })
    : null;

  const flow = input.serviceFlow ? hydrateServiceFlowStepsFromAlternativePayload(input.serviceFlow) : null;

  switch (input.artifactType) {
    case "service-flow-doc": {
      const steps =
        (flow?.steps?.length ?? 0) > 0
          ? [...(flow?.steps ?? [])].sort((a, b) => a.order - b.order).map((s) => String(s.title ?? "").trim()).filter(Boolean)
          : collected
            ? defaultFlowSteps(collected.featureCandidates, projectName)
            : defaultFlowSteps([], projectName);
      const lines = [
        `# ${projectName} — 서비스 흐름 문서`,
        "",
        `구현 단계: ${stage}`,
        "",
        "## 흐름 개요",
        "",
        ...steps.map((s, i) => `${i + 1}. ${s}`),
        "",
      ];
      if (collected?.coreUsers.value) {
        lines.push("## 주요 액터", "", `- ${collected.coreUsers.value}`, "");
      }
      if ((flow?.steps?.length ?? 0) > 0) {
        lines.push("", buildServiceFlowStateSummaryMessage({ flow: flow!, heading: "상세 흐름", cta: "" }));
      }
      return lines.join("\n").trim();
    }

    case "feature-spec": {
      const fromPlanning = featureSectionsFromPlanning(input.featurePlanning);
      const features = uniqueLines([
        ...fromPlanning,
        ...(collected?.featureCandidates ?? []),
        ...linesFromMemberDraft(input.memberDrafts, "architect"),
        ...linesFromMemberDraft(input.memberDrafts, "planner"),
      ]);
      const list =
        features.length >= 3
          ? features
          : features.length
            ? [
                ...features,
                ...defaultFlowSteps([], projectName)
                  .filter((s) => !/진입|인증|저장/.test(s))
                  .slice(0, Math.max(0, 3 - features.length)),
              ]
            : defaultFlowSteps([], projectName)
                .filter((s) => !/진입|저장/.test(s))
                .slice(0, 5)
                .map((s) => s.replace(/ 처리$/, ""));

      const lines = [
        `# ${projectName} — 기능 정의서`,
        "",
        `구현 단계: ${stage}`,
        "",
        collected?.servicePurpose.value ? `> 서비스 목적: ${collected.servicePurpose.value}` : "",
        "",
        "## 핵심 기능",
        "",
      ].filter(Boolean);

      for (const f of list.slice(0, 12)) {
        lines.push(`### ${f}`, "", `- 사용자 가치: ${collected?.coreProblem.value || desc.slice(0, 120) || "핵심 문제 해결"}`, `- MVP 범위 포함`, "");
      }
      if (collected?.expectedOutcome.value) {
        lines.push("## 기대 효과", "", collected.expectedOutcome.value, "");
      }
      return lines.join("\n").trim();
    }

    case "screen-spec": {
      const screens = uniqueLines([
        ...(collected?.screenCandidates ?? []),
        ...linesFromMemberDraft(input.memberDrafts, "designer"),
        ...featureSectionsFromPlanning(input.featurePlanning).map((f) => `${f} 화면`),
      ]);
      const list = screens.length >= 2 ? screens : defaultScreensForProject(projectName, desc);
      const lines = [
        `# ${projectName} — 화면 정의서`,
        "",
        `구현 단계: ${stage}`,
        "",
        "## 주요 화면",
        "",
      ];
      for (const s of list.slice(0, 10)) {
        lines.push(`### ${s}`, "", "- 주요 액션: 조회, 생성, 저장", "- 연결: 이전·다음 화면으로 이동", "");
      }
      return lines.join("\n").trim();
    }

    case "api-spec": {
      const features = uniqueLines(collected?.featureCandidates ?? []);
      const lines = [
        `# ${projectName} — API 명세서`,
        "",
        `구현 단계: ${stage}`,
        "",
        "## 개요",
        "",
        "슬롯·기능 정의를 바탕으로 한 초안 API 목록입니다.",
        "",
        "## 엔드포인트 (초안)",
        "",
        "| 메서드 | 경로 | 설명 |",
        "| --- | --- | --- |",
        "| POST | /api/v1/resources | 리소스 생성 |",
        "| GET | /api/v1/resources | 목록 조회 |",
        "| GET | /api/v1/resources/{id} | 상세 조회 |",
        "| PATCH | /api/v1/resources/{id} | 수정 |",
      ];
      for (const f of features.slice(0, 4)) {
        const slug = f.replace(/\s+/g, "-").toLowerCase().slice(0, 24);
        lines.push(`| POST | /api/v1/${slug} | ${f} 실행 |`);
      }
      return lines.join("\n").trim();
    }

    case "summary": {
      if (!collected) {
        return [`# ${projectName} — 프로젝트 요약서`, "", desc || "_설명 없음_"].join("\n");
      }
      const features = collected.featureCandidates.map((f) => `- ${f}`).join("\n");
      const flow = collected.flowSteps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      return [
        `# ${projectName} — 프로젝트 요약서`,
        "",
        `구현 단계: ${stage}`,
        "",
        "## 개요",
        "",
        collected.summary || desc,
        "",
        "## 서비스 목적",
        "",
        collected.servicePurpose.value,
        "",
        "## 주 사용자",
        "",
        collected.coreUsers.value,
        "",
        "## 핵심 문제",
        "",
        collected.coreProblem.value,
        "",
        "## 기대 효과",
        "",
        collected.expectedOutcome.value,
        "",
        features ? "## 핵심 기능 후보\n\n" + features : "",
        flow ? "\n## 서비스 흐름 스냅샷\n\n" + flow : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    default:
      return "";
  }
}

export function isPlaceholderOnlyArtifactContent(content: string): boolean {
  const t = String(content ?? "").trim();
  if (t.length < 20) return true;
  if (PLACEHOLDER_CONTENT_MARKERS.some((m) => t.includes(m))) return true;
  const bodyWithoutHeaders = t.replace(/^#+\s.+$/gm, "").trim();
  if (bodyWithoutHeaders.length < 40) return true;
  return false;
}

export function evaluateArtifactContentQuality(input: {
  readonly artifactType: ProjectArtifactType;
  readonly content: string;
}): ArtifactContentQuality {
  const content = String(input.content ?? "").trim();
  const isPlaceholderOnly = isPlaceholderOnlyArtifactContent(content);

  let sectionCount = 0;
  if (input.artifactType === "feature-spec") {
    sectionCount = (content.match(/^###\s/gm) ?? []).length;
    if (sectionCount < 2) sectionCount = (content.match(/^-\s+\*\*/gm) ?? []).length;
  } else if (input.artifactType === "screen-spec") {
    sectionCount = (content.match(/^###\s/gm) ?? []).length;
  } else if (input.artifactType === "service-flow-doc") {
    sectionCount = (content.match(/^\d+\.\s/gm) ?? []).length;
  } else if (input.artifactType === "api-spec") {
    sectionCount = (content.match(/^\| (GET|POST|PATCH|PUT|DELETE)/gm) ?? []).length;
  }

  let completenessScore = 0.35;
  if (isPlaceholderOnly) {
    completenessScore = 0.15;
  } else if (input.artifactType === "feature-spec") {
    completenessScore = sectionCount >= 3 ? 0.92 : sectionCount >= 1 ? 0.55 : 0.3;
  } else if (input.artifactType === "screen-spec") {
    completenessScore = sectionCount >= 2 ? 0.88 : sectionCount >= 1 ? 0.5 : 0.3;
  } else if (input.artifactType === "service-flow-doc") {
    completenessScore = sectionCount >= 3 ? 0.9 : sectionCount >= 1 ? 0.55 : 0.3;
  } else if (input.artifactType === "summary") {
    completenessScore = content.length >= 200 ? 0.9 : content.length >= 80 ? 0.65 : 0.4;
  } else {
    completenessScore = content.length >= 120 ? 0.85 : content.length >= 50 ? 0.6 : 0.35;
  }

  const hubReadinessLabel =
    isPlaceholderOnly || completenessScore < 0.35
      ? "초안"
      : completenessScore < 0.55
        ? "보완 필요"
        : completenessScore < 0.85
          ? "부분 구성"
          : "구현 가능";

  const improvementHint =
    isPlaceholderOnly || completenessScore < 0.55
      ? improvementHintForType(input.artifactType)
      : undefined;

  const sections: ArtifactSectionPlan[] = [];
  if (sectionCount > 0) {
    const titles = content.match(/^###\s+(.+)$/gm) ?? content.match(/^\d+\.\s+(.+)$/gm);
    (titles ?? []).slice(0, 12).forEach((m, i) => {
      const title = m.replace(/^###\s+|^\d+\.\s+/, "").trim();
      if (!title) return;
      sections.push({
        artifactType: input.artifactType,
        sectionId: `sec-${i}`,
        title,
        sourceSlots: [],
        sourceRoles: [],
        completeness: completenessScore,
      });
    });
  }

  return {
    completenessScore,
    isPlaceholderOnly,
    sections,
    hubReadinessLabel,
    improvementHint,
  };
}

export function improvementHintForType(type: ProjectArtifactType): string {
  switch (type) {
    case "feature-spec":
      return "AI설계자: 기능 정의가 부족합니다. 핵심 기능·MVP 슬롯을 구체화한 뒤 다시 생성해 주세요.";
    case "screen-spec":
      return "AI디자이너: 주요 화면 후보가 부족합니다. requiredScreens 슬롯을 보완해 주세요.";
    case "service-flow-doc":
      return "분석가: 서비스 흐름 단계가 부족합니다. serviceFlow·액터 슬롯을 확정해 주세요.";
    case "api-spec":
      return "AI설계자: API·연동 범위를 슬롯에 반영한 뒤 다시 생성해 주세요.";
    default:
      return "AI팀: 산출물 본문이 아직 충분하지 않습니다. Quick Design 슬롯을 보완해 주세요.";
  }
}
