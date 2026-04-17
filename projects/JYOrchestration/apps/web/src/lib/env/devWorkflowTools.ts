/** 클라이언트: 워크플로 진단용 UI(요구사항 건너뛰기 등). 프로덕션 빌드에서는 설정하지 않는 것을 전제로 합니다. */
export function isNextPublicDevWorkflowToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_JY_DEV_WORKFLOW_TOOLS === "1";
}

/** 서버: 요구사항 단계 강제 해제 API 등 — 프로덕션에서는 비활성화 */
export function isServerDevWorkflowToolsEnabled(): boolean {
  return process.env.JY_DEV_WORKFLOW_TOOLS === "1";
}
