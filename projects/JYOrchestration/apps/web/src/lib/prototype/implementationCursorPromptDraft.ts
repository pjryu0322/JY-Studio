import type { ImplementationTaskExecutionHints } from "@/lib/prototype/implementationExecutionHints";

export function buildCursorPromptDraft(input: {
  readonly title: string;
  readonly description: string;
  readonly artifactLabels: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly securityChecks: readonly string[];
  readonly reviewChecks: readonly string[];
  readonly executionHints: ImplementationTaskExecutionHints;
}): string {
  const h = input.executionHints;
  const lines = [
    `# Cursor 작업 지시 — ${input.title}`,
    "",
    "## 1. 작업 목적",
    input.description,
    "",
    "## 2. 작업 범위",
    `- ${input.title} 구현 및 기획 산출물(${input.artifactLabels.join(", ") || "기능 정의"}) 반영`,
    "- projects/JYOrchestration 범위 내 최소 변경",
    "- 기존 컨벤션·타입·테스트 스타일 준수",
    "",
    "## 3. 참조 산출물",
    ...input.artifactLabels.map((l) => `- ${l}`),
    ...(input.artifactLabels.length ? [] : ["- 기능 정의서·화면 정의서·API 명세서"]),
    "",
    "## 4. 예상 수정 위치",
    "### 후보 폴더",
    ...h.candidateDirectories.map((d) => `- ${d}`),
    "",
    "### 후보 파일",
    ...h.candidateFiles.map((f) => `- ${f}`),
    "",
    "### 후보 API Route",
    ...(h.candidateApiRoutes.length
      ? h.candidateApiRoutes.map((r) => `- ${r}`)
      : ["- (해당 없음 — UI/상태 작업일 수 있음)"]),
    "",
    "### 후보 컴포넌트",
    ...(h.candidateComponents.length
      ? h.candidateComponents.map((c) => `- ${c}`)
      : ["- (해당 없음)"]),
    "",
    "### 후보 테스트",
    ...h.candidateTests.map((t) => `- ${t}`),
    "",
    "## 5. 구현 요구사항",
    "- 기획 산출물 범위 안에서 최소 변경으로 구현한다.",
    "- 기존 프로젝트 컨벤션·타입·테스트 스타일을 따른다.",
    "- AI검수자 관점: 업로드·입력 실패, 빈 결과, 부분 실패 복구를 고려한다.",
    "",
    "## 6. 검수 기준",
    ...input.acceptanceCriteria.map((c) => `- ${c}`),
    ...input.reviewChecks.map((c) => `- [검수] ${c}`),
    "",
    "## 7. 보안 기준",
    ...input.securityChecks.map((c) => `- ${c}`),
    "",
    "## 8. 테스트 명령",
    ...h.testCommands.map((c) => `- \`${c}\``),
    "",
    "## 9. 수동 확인 기준",
    ...h.manualVerification.map((c) => `- ${c}`),
    "",
    "### 기대 동작",
    ...h.expectedBehavior.map((c) => `- ${c}`),
    "",
    "### 회귀 범위",
    ...h.regressionScope.map((c) => `- ${c}`),
    "",
    "## WIP 작업 정책",
    "- 이 작업은 검토용 WIP 작업이다.",
    "- main 브랜치에 직접 반영하지 않는다.",
    "- 공식 push/PR/merge를 수행하지 않는다.",
    "- WIP branch에서만 작업한다.",
    "- 작업 완료 후 WIP commit을 생성한다.",
    "- 변경 파일 목록, diff 요약, 테스트 결과, 미해결 이슈를 보고한다.",
    "- AI개발자 승인 전에는 공식 반영 대상으로 보지 않는다.",
    "",
    "## 10. 금지사항",
    ...h.forbiddenPaths.map((p) => `- ${p}`),
    "- projects/JYOrchestration 외 수정 금지",
    "- Stage1/Stage2/ENV_TEST 실행 파이프라인 수정 금지",
    "- package.json / lockfile 수정 금지",
    "",
    "## 11. 완료 보고 형식",
    "- 변경 파일 목록",
    "- 핵심 동작 요약",
    "- 실행한 테스트 명령과 결과",
    "- 미해결 리스크(있을 경우)",
    "",
    "## 완료 전 자체 점검",
    "- 검수 기준·보안 기준을 모두 충족했는지 확인",
    "- 금지 경로를 수정하지 않았는지 확인",
    "- 테스트 명령을 최소 1회 실행했는지 확인",
  ];
  return lines.join("\n");
}
