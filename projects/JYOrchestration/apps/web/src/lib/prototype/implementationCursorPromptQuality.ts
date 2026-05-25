import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

export type CursorWorkItemQualityGate = Readonly<{
  promptReady: boolean;
  missing: readonly string[];
  score: number;
}>;

export const CURSOR_PROMPT_MIN_LENGTH = 400;
export const CURSOR_WORK_ITEM_MIN_QUALITY_SCORE = 0.75;

const REQUIRED_PROMPT_SECTIONS: readonly { readonly marker: string; readonly label: string }[] = [
  { marker: "## 1. 작업 목적", label: "작업 목적" },
  { marker: "## 2. 작업 범위", label: "작업 범위" },
  { marker: "## 3. 참조 산출물", label: "참조 산출물" },
  { marker: "## 4. 예상 수정 위치", label: "예상 수정 위치" },
  { marker: "## 5. 구현 요구사항", label: "구현 요구사항" },
  { marker: "## 6. 검수 기준", label: "검수 기준" },
  { marker: "## 7. 보안 기준", label: "보안 기준" },
  { marker: "## 8. 테스트 명령", label: "테스트 명령" },
  { marker: "## 9. 수동 확인 기준", label: "수동 확인 기준" },
  { marker: "## 10. 금지사항", label: "금지사항" },
  { marker: "## 11. 완료 보고 형식", label: "완료 보고 형식" },
];

type QualityCheck = Readonly<{ readonly weight: number; readonly ok: boolean; readonly label: string }>;

export function evaluateCursorWorkItemQuality(item: CursorWorkItem): CursorWorkItemQualityGate {
  const prompt = item.prompt.trim();
  const checks: QualityCheck[] = [
    {
      weight: 0.08,
      ok: prompt.length >= CURSOR_PROMPT_MIN_LENGTH,
      label: "prompt 최소 길이",
    },
    ...REQUIRED_PROMPT_SECTIONS.map((s) => ({
      weight: 0.07,
      ok: prompt.includes(s.marker),
      label: s.label,
    })),
    {
      weight: 0.05,
      ok: item.testCommands.length > 0,
      label: "테스트 명령",
    },
    {
      weight: 0.05,
      ok: item.forbiddenPaths.length > 0,
      label: "금지 경로",
    },
    {
      weight: 0.05,
      ok: item.requiredFilesHint.length > 0,
      label: "참조 파일 힌트",
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.filter((c) => c.ok).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) / 100 : 0;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const promptReady =
    score >= CURSOR_WORK_ITEM_MIN_QUALITY_SCORE &&
    item.testCommands.length > 0 &&
    item.forbiddenPaths.length > 0 &&
    prompt.includes("## 4. 예상 수정 위치");

  return { promptReady, missing, score };
}

/** Gate용: score만으로 promptReady 판정(누락 2개 이하 허용은 evaluate 내부와 동일). */
export function isCursorWorkItemPromptReady(item: CursorWorkItem): boolean {
  return evaluateCursorWorkItemQuality(item).promptReady;
}
