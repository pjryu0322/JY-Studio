import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { CodeTaskPromptTargetRepoKind } from "@/lib/prototype/codeTaskPromptPathPolicy";

export type ImplementationTaskExecutionHints = Readonly<{
  candidateDirectories: readonly string[];
  candidateFiles: readonly string[];
  candidateApiRoutes: readonly string[];
  candidateComponents: readonly string[];
  candidateTests: readonly string[];
  forbiddenPaths: readonly string[];
  testCommands: readonly string[];
  manualVerification: readonly string[];
  expectedBehavior: readonly string[];
  regressionScope: readonly string[];
}>;

export type BuildImplementationTaskExecutionHintsInput = Readonly<{
  taskTitle: string;
  sourceArtifactTypes: readonly string[];
  projectArtifacts: readonly ProjectArtifact[];
  featureDraftTitles?: readonly string[];
  targetRepoKind?: CodeTaskPromptTargetRepoKind;
}>;

export const COMMON_FORBIDDEN_PATHS: readonly string[] = [
  "package.json",
  "pnpm-lock.yaml",
  "../../",
  "projects/JYGallery/**",
  "projects/JYAccount/**",
  "Stage1/Stage2/ENV_TEST 실행 파이프라인",
];

const WEB_ROOT = "projects/JYOrchestration/apps/web";

const BASE_TEST_COMMANDS: readonly string[] = [
  `cd ${WEB_ROOT}`,
  "pnpm test -- implementation",
  "pnpm test -- prototypeExecution",
  "pnpm test -- orchestration",
  "pnpm build",
];

type TaskKind = "ui" | "api" | "orchestration" | "general";

function inferTaskKind(title: string, artifactTypes: readonly string[]): TaskKind {
  const t = title.toLowerCase();
  if (artifactTypes.includes("api-spec") || /api|route|endpoint|연동/.test(t)) return "api";
  if (
    artifactTypes.includes("screen-spec") ||
    /화면|ui|컴포넌트|panel|drawer|modal/.test(t)
  ) {
    return "ui";
  }
  if (
    artifactTypes.includes("feature-spec") ||
    artifactTypes.includes("service-flow-doc") ||
    /오케스트|상태|singlechat|prototype|requirements|구현|task|cursor/.test(t)
  ) {
    return "orchestration";
  }
  return "general";
}

function uniq(items: readonly string[]): string[] {
  return [...new Set(items.map((x) => x.trim()).filter(Boolean))];
}

function directoriesForKind(kind: TaskKind): string[] {
  switch (kind) {
    case "ui":
      return [
        `${WEB_ROOT}/src/components`,
        `${WEB_ROOT}/src/app`,
        `${WEB_ROOT}/src/components/preview`,
      ];
    case "api":
      return [`${WEB_ROOT}/src/app/api`, `${WEB_ROOT}/src/lib`];
    case "orchestration":
      return [
        `${WEB_ROOT}/src/lib/prototype`,
        `${WEB_ROOT}/src/lib/requirements`,
        `${WEB_ROOT}/src/components/preview`,
      ];
    default:
      return [`${WEB_ROOT}/src/lib`, `${WEB_ROOT}/src/components`];
  }
}

function testsForKind(kind: TaskKind): string[] {
  switch (kind) {
    case "api":
      return [`${WEB_ROOT}/tests/api`];
    case "ui":
      return [`${WEB_ROOT}/tests`];
    case "orchestration":
      return [`${WEB_ROOT}/tests/api`];
    default:
      return [`${WEB_ROOT}/tests`];
  }
}

function extraTestCommands(kind: TaskKind): string[] {
  switch (kind) {
    case "api":
      return ["pnpm test -- api"];
    case "ui":
      return ["pnpm test -- component"];
    case "orchestration":
      return ["pnpm test -- artifact", "pnpm test -- requirements"];
    default:
      return [];
  }
}

function candidateApiRoutes(kind: TaskKind, title: string): string[] {
  if (kind !== "api") return [];
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const routes = [`${WEB_ROOT}/src/app/api/prototype-chat/**`, `${WEB_ROOT}/src/app/api/projects/**`];
  if (slug) routes.push(`${WEB_ROOT}/src/app/api/**/${slug}/**`);
  return routes;
}

function candidateComponents(kind: TaskKind): string[] {
  if (kind === "ui" || kind === "orchestration") {
    return [
      `${WEB_ROOT}/src/components/preview/PrototypePreviewPanel.tsx`,
      `${WEB_ROOT}/src/components/preview/PrototypeExecutionChatPanel.tsx`,
    ];
  }
  return [];
}

function candidateFilesFromArtifacts(
  artifacts: readonly ProjectArtifact[],
  artifactTypes: readonly string[],
): string[] {
  return artifacts
    .filter((a) => artifactTypes.includes(a.type))
    .map((a) => `${WEB_ROOT}/src/lib/requirements/** (${a.title})`)
    .slice(0, 4);
}

function buildPlatformImplementationTaskExecutionHints(
  input: BuildImplementationTaskExecutionHintsInput,
): ImplementationTaskExecutionHints {
  const kind = inferTaskKind(input.taskTitle, input.sourceArtifactTypes);
  const candidateDirectories = directoriesForKind(kind);
  const candidateTests = testsForKind(kind);
  const testCommands = uniq([...BASE_TEST_COMMANDS, ...extraTestCommands(kind)]);
  const artifactFiles = candidateFilesFromArtifacts(input.projectArtifacts, input.sourceArtifactTypes);

  const manualVerification = [
    `${input.taskTitle}: 정상 플로우에서 기대 동작이 재현되는지 확인`,
    "예외·빈 입력·부분 실패 시 사용자 피드백과 복구 경로 확인",
    "기존 /execution·SingleChat 흐름 회귀 없음 확인",
  ];

  const expectedBehavior = [
    `기획 범위(${input.sourceArtifactTypes.join(", ") || "feature"}) 안에서 ${input.taskTitle}이 동작한다.`,
    "에러 메시지·로딩 상태가 사용자에게 명확히 전달된다.",
  ];

  const regressionScope = [
    "구현 단계 SingleChat bootstrap·chip 라우팅",
    "기존 prototype run / work unit 파이프라인",
    "requirementsStateJson merge·parse",
  ];

  return {
    candidateDirectories: uniq(candidateDirectories),
    candidateFiles: uniq([
      ...artifactFiles,
      `${WEB_ROOT}/src/lib/prototype/implementationTaskPlan.ts`,
      `${WEB_ROOT}/src/lib/prototype/implementationCursorWorkItems.ts`,
    ]).slice(0, 8),
    candidateApiRoutes: uniq(candidateApiRoutes(kind, input.taskTitle)),
    candidateComponents: uniq(candidateComponents(kind)),
    candidateTests: uniq(candidateTests),
    forbiddenPaths: uniq([...COMMON_FORBIDDEN_PATHS, "projects/JYOrchestration 외 경로"]),
    testCommands,
    manualVerification,
    expectedBehavior,
    regressionScope,
  };
}

function buildGeneratedProjectImplementationTaskExecutionHints(
  input: BuildImplementationTaskExecutionHintsInput,
): ImplementationTaskExecutionHints {
  const kind = inferTaskKind(input.taskTitle, input.sourceArtifactTypes);
  const candidateDirectories =
    kind === "api"
      ? ["src/app/api", "app/api", "pages/api", "src/lib"]
      : kind === "ui"
        ? ["src/components", "src/app", "app", "components", "pages"]
        : ["src/components", "src/app", "src/lib", "app", "lib"];

  const manualVerification = [
    `${input.taskTitle}: 정상 플로우에서 기대 동작이 재현되는지 확인`,
    "예외·빈 입력·부분 실패 시 사용자 피드백과 복구 경로 확인",
  ];

  return {
    candidateDirectories: uniq(candidateDirectories),
    candidateFiles: [],
    candidateApiRoutes: kind === "api" ? ["src/app/api/**", "app/api/**"] : [],
    candidateComponents: kind === "ui" ? ["src/components/**", "components/**"] : [],
    candidateTests: ["tests/**", "__tests__/**", "src/**/*.test.ts", "src/**/*.test.tsx"],
    forbiddenPaths: uniq([
      "../",
      "../../",
      "projects/JYOrchestration/**",
      "projects/JYGallery/**",
      "projects/JYAccount/**",
      "projects/Chunk Studio/**",
      "projects/chunk-studio/**",
      ...COMMON_FORBIDDEN_PATHS,
    ]),
    testCommands: [
      "대상 저장소 package.json scripts 확인 후 npm test / npm run build / pnpm test / pnpm build 중 가능한 검증 실행",
    ],
    manualVerification,
    expectedBehavior: [
      `대상 저장소 내부에서 ${input.taskTitle} 요구사항이 충족된다.`,
      "오류/로딩 상태가 사용자에게 명확히 전달된다.",
    ],
    regressionScope: ["동일 기능 회귀 없음", "허용 경로 밖 파일 변경 없음"],
  };
}

export function buildImplementationTaskExecutionHints(
  input: BuildImplementationTaskExecutionHintsInput,
): ImplementationTaskExecutionHints {
  const targetRepoKind = input.targetRepoKind ?? "generated_project";
  if (targetRepoKind === "platform") {
    return buildPlatformImplementationTaskExecutionHints(input);
  }
  return buildGeneratedProjectImplementationTaskExecutionHints(input);
}
