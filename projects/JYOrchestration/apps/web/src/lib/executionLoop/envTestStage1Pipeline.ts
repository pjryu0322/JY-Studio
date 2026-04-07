/**
 * Stage1(ENV_TEST) 전용 스모크 파이프라인 진입점.
 * Stage2(reflection·compare·reviewer·SCM)와 코드·import 경로를 분리해 혼선을 줄인다.
 *
 * 실행 순서(고정): Cursor push → 브랜치 확정 → 플랫폼 PR → merge → 완료.
 * STAGE1 PROTECTION: 구현은 `envTestStage1Helpers`에만 있으며 Stage2 모듈을 import하지 않는다.
 */

export {
  applyStage1EnvTestPrCreateTerminalFailure,
  getEnvTestStage1PrFirstRetryConfig,
  runStage1EnvTestPrSmokePath,
  runStage1EnvTestSimplePipeline,
  runStage1EnvTestSimplePipeline as runStage1SmokePipeline,
} from "./envTestStage1Helpers";
