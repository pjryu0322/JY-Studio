export type ExecutionAccessLogEntry = {
  result: "allowed" | "denied";
  reason?: string;
  userId: string | null;
  projectId?: string;
  taskId?: string;
  context?: string;
};

/**
 * 실행·태스크 소유권 판단 결과(허용/거부)를 구조화 로그로 남긴다.
 */
export function logExecutionAccess(entry: ExecutionAccessLogEntry): void {
  const payload = {
    scope: "execution-access",
    ...entry,
    at: new Date().toISOString(),
  };
  if (entry.result === "denied") {
    console.warn("[execution-access]", JSON.stringify(payload));
  } else {
    console.info("[execution-access]", JSON.stringify(payload));
  }
}
