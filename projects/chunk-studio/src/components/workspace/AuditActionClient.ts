"use client";

export function fireWorkspaceAudit(
  jobId: string | null,
  action: string,
  detailData?: Record<string, unknown>
): void {
  void fetch("/api/admin/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "workspace_edit",
      action,
      jobId,
      level: "info",
      detail: detailData ?? {},
    }),
  });
}
