"use client";

import type { RoleRailStepStatus } from "@/lib/role-workspace/types";

const STATUS_LABEL: Record<RoleRailStepStatus, string> = {
  completed: "완료",
  current: "진행 중",
  next: "다음",
  blocked: "대기",
  warning: "주의",
  idle: "",
};

export function StepStatusBadge({
  status,
}: {
  readonly status: RoleRailStepStatus;
}) {
  const label = STATUS_LABEL[status];
  if (!label) return null;

  const tone =
    status === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "current"
        ? "bg-indigo-100 text-indigo-900"
        : status === "next"
          ? "bg-sky-100 text-sky-900"
          : status === "warning"
            ? "bg-amber-100 text-amber-900"
            : status === "blocked"
              ? "bg-slate-200 text-slate-600"
              : "bg-slate-100 text-slate-500";

  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`}>
      {status === "completed" ? "✓ " : ""}
      {label}
    </span>
  );
}
