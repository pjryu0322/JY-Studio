/**
 * Stage1(ENV_TEST) 전용 스모크 파이프라인 진입점.
 * Stage2(reflection·compare·reviewer·SCM)와 코드·import 경로를 분리해 혼선을 줄인다.
 *
 * 실행 순서(고정): Cursor push → 브랜치 확정 → 플랫폼 PR → merge → 완료.
 * 구현 본문은 `envTestExecutionHelpers`에 두되, 호출부는 `runStage1SmokePipeline` 사용을 권장한다.
 */

export {
  applyStage1EnvTestPrCreateTerminalFailure,
  getEnvTestStage1PrFirstRetryConfig,
  runStage1EnvTestPrSmokePath,
  runStage1EnvTestSimplePipeline,
  runStage1EnvTestSimplePipeline as runStage1SmokePipeline,
} from "./envTestExecutionHelpers";
