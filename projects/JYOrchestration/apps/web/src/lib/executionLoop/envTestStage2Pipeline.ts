/**
 * Stage2(ENV_TEST_STAGE2) 역할 분리 파이프라인 진입점.
 * reflection·GitHub compare·플랫폼 PR·reviewer·security·SCM·merge 는 Stage1과 분리한다.
 *
 * Stage1 전용 경로(`runStage1SmokePipeline`)와 혼용하지 않는다.
 */

export {
  runEnvTestAfterGithubPushConfirmed,
  runEnvTestReflectionConfirmedPipeline,
  runEnvTestReflectionNotConfirmedGithubBypass,
} from "./envTestExecutionHelpers";
