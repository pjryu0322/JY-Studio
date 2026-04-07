/**
 * Stage2 finalize module (extracted module).
 * PR_OPENED finalize is handled in `envTestGithubFinalize`.
 */
export { runEnvTestPostPrOpenedMergeAndReadiness as runStage2Finalize } from "@/lib/executionLoop/envTestGithubFinalize";