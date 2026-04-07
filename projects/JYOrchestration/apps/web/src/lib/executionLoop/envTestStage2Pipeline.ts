/**
 * Stage2(ENV_TEST_STAGE2) 전용 파이프라인. 구현은 `stage2/*`에 두고 이 파일은 공개 진입·문서 역할.
 *
 * STAGE1 PROTECTION: Stage1(`ENV_TEST`)는 `envTestStage1Pipeline`만 사용. 이 모듈을 Stage1에서 import하지 않는다.
 */
export {
  runEnvTestAfterGithubPushConfirmed,
  runEnvTestReflectionConfirmedPipeline,
  runEnvTestReflectionNotConfirmedGithubBypass,
  type EnvTestReflectionNotConfirmedBypassResult,
} from "./stage2/runStage2EnvTestPipeline";
