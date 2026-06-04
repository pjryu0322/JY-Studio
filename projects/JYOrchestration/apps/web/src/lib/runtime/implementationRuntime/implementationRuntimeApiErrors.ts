export function formatImplementationRuntimeApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (
    code === "P2022" ||
    /column.*does not exist/i.test(message) ||
    /selectedCodeTaskIdsJson/i.test(message) ||
    /implementation_code_task_runs/i.test(message) ||
    /implementation_runtime_events/i.test(message)
  ) {
    return [
      "Implementation Runtime DB 스키마/Prisma 클라이언트가 최신이 아닙니다.",
      "dev 서버를 중지한 뒤 JYOrchestration에서 `pnpm db:generate` 및 `pnpm db:migrate` 실행 후 dev 서버를 재시작해 주세요.",
    ].join(" ");
  }
  return message;
}

export function isImplementationRuntimeSchemaError(error: unknown): boolean {
  const formatted = formatImplementationRuntimeApiError(error);
  return (
    formatted.includes("DB 스키마/Prisma 클라이언트가 최신이 아닙니다") ||
    formatted.includes("DB 스키마가 최신이 아닙니다")
  );
}
