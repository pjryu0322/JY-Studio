import type { PrototypeDeployStatusSnapshot, PrototypeDeployUiStatus, PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

export function getPrototypeDeployStatusSnapshot(run: PrototypeRun | null): PrototypeDeployStatusSnapshot {
  if (!run) {
    return {
      deployStatus: "NOT_DEPLOYED",
      deploymentStatus: "PENDING",
      previewUrl: null,
      publicUrl: null,
      suggestedPreviewUrl: null,
      resultUrl: null,
      runStatus: "",
      pagesDeployWorkflowRunUrl: null,
    };
  }
  let deployStatus: PrototypeDeployUiStatus = "NOT_DEPLOYED";
  if (run.publicUrl || (run.deploymentStatus === "DONE" && String(run.resultUrl ?? "").trim())) deployStatus = "DEPLOYED";
  else if (run.status === "DEPLOY_FAILED" || run.deploymentStatus === "FAILED") deployStatus = "FAILED";
  else if (run.status === "DEPLOYING" || run.status === "DEPLOY_CONFIGURING" || run.deploymentStatus === "RUNNING")
    deployStatus = "DEPLOYING";
  else if (run.deploymentStatus === "REQUESTED") deployStatus = "DEPLOYING";
  return {
    deployStatus,
    deploymentStatus: run.deploymentStatus,
    previewUrl: run.previewUrl,
    publicUrl: run.publicUrl,
    suggestedPreviewUrl: run.suggestedPreviewUrl,
    resultUrl: run.resultUrl,
    runStatus: run.status,
    pagesDeployWorkflowRunUrl: run.pagesDeployWorkflowRunUrl,
  };
}
