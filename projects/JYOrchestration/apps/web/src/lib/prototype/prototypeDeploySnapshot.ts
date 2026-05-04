import type {
  PrototypeDeployGateUiLabel,
  PrototypeDeployStatusSnapshot,
  PrototypeDeployUiStatus,
  PrototypeRun,
} from "@/lib/prototype/prototypeRunTypes";

const GATE_LABEL_KO: Record<PrototypeDeployGateUiLabel, string> = {
  BEFORE_DEPLOY: "배포 전",
  SECURITY_CHECKING: "보안 점검 중",
  SECURITY_FIX_REQUIRED: "보안 조치 필요",
  FIX_IN_PROGRESS: "조치 중",
  PENDING_RECHECK: "조치 완료 · 재점검 대기",
  SECURITY_PASSED: "보안 통과",
  DEPLOYING: "배포 중",
  DEPLOYED: "배포 완료",
  FAILED: "배포 실패",
};

function resolveDeployGateUiLabel(run: PrototypeRun, deployStatus: PrototypeDeployUiStatus): PrototypeDeployGateUiLabel {
  if (deployStatus === "DEPLOYED") return "DEPLOYED";
  if (deployStatus === "FAILED") return "FAILED";
  if (deployStatus === "DEPLOYING") return "DEPLOYING";

  const phase = run.deploySecurityGatePhase;
  if (phase === "SECURITY_CHECKING") return "SECURITY_CHECKING";
  if (phase === "SECURITY_FIX_REQUIRED") return "SECURITY_FIX_REQUIRED";
  if (phase === "FIX_IN_PROGRESS") return "FIX_IN_PROGRESS";
  if (phase === "PENDING_RECHECK") return "PENDING_RECHECK";
  if (phase === "SECURITY_PASSED") return "SECURITY_PASSED";
  return "BEFORE_DEPLOY";
}

function gateLabelKo(label: PrototypeDeployGateUiLabel, run: PrototypeRun, deployStatus: PrototypeDeployUiStatus): string {
  if (label === "SECURITY_CHECKING" && run.deploySecurityCheckIsRecheck) return "재점검 중";
  if (label === "SECURITY_CHECKING") return "보안 점검 중";
  if (label === "FAILED" && deployStatus === "FAILED") return "배포 실패";
  return GATE_LABEL_KO[label] ?? label;
}

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
      deploySecurityGatePhase: "NONE",
      deploySecurityFindings: [],
      deployGateUiLabel: "BEFORE_DEPLOY",
      deployGateUiLabelKo: GATE_LABEL_KO.BEFORE_DEPLOY,
    };
  }
  let deployStatus: PrototypeDeployUiStatus = "NOT_DEPLOYED";
  if (run.publicUrl || (run.deploymentStatus === "DONE" && String(run.resultUrl ?? "").trim())) deployStatus = "DEPLOYED";
  else if (run.status === "DEPLOY_FAILED" || run.deploymentStatus === "FAILED") deployStatus = "FAILED";
  else if (run.status === "DEPLOYING" || run.status === "DEPLOY_CONFIGURING" || run.deploymentStatus === "RUNNING")
    deployStatus = "DEPLOYING";
  else if (run.deploymentStatus === "REQUESTED") deployStatus = "DEPLOYING";

  const gateLabel = resolveDeployGateUiLabel(run, deployStatus);
  const gateKo = gateLabelKo(gateLabel, run, deployStatus);

  return {
    deployStatus,
    deploymentStatus: run.deploymentStatus,
    previewUrl: run.previewUrl,
    publicUrl: run.publicUrl,
    suggestedPreviewUrl: run.suggestedPreviewUrl,
    resultUrl: run.resultUrl,
    runStatus: run.status,
    pagesDeployWorkflowRunUrl: run.pagesDeployWorkflowRunUrl,
    deploySecurityGatePhase: run.deploySecurityGatePhase,
    deploySecurityFindings: run.deploySecurityFindings,
    deployGateUiLabel: gateLabel,
    deployGateUiLabelKo: gateKo,
  };
}
