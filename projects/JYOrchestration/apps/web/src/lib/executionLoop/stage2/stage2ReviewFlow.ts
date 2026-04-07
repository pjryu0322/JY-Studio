/**
 * Stage2 review flow (extracted module).
 * Currently delegates to `stage2ReviewScmFlow` to preserve behavior; keep changes minimal.
 */
export { runEnvTestStage2ReviewScmAfterPrOpened as runStage2ReviewFlow } from "./stage2ReviewScmFlow";