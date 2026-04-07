/**
 * Stage2 SCM flow (extracted module).
 * Currently delegates to `stage2ReviewScmFlow` to preserve behavior; keep changes minimal.
 */
export { runEnvTestStage2ReviewScmAfterPrOpened as runStage2ScmFlow } from "./stage2ReviewScmFlow";