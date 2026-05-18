"use client";

import type { CSSProperties } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  ready: "실행 준비",
  running: "진행 중",
  pending_apply: "변경사항 확인 필요",
  reviewing: "검토 중",
  awaiting_human: "승인 대기",
  done: "완료",
  failed: "실패",
  draft: "미완료",
  validated: "준비됨",
  invalid: "오류",
  unknown: "알 수 없음",
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "neutral",
  ready: "info",
  running: "info",
  pending_apply: "warning",
  reviewing: "warning",
  awaiting_human: "warning",
  done: "success",
  failed: "danger",
  draft: "neutral",
  validated: "success",
  invalid: "danger",
  unknown: "neutral",
};

function normalizeStatus(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return s || "unknown";
}

export type StatusBadgeProps = Readonly<{
  status: string | null | undefined;
  labelOverride?: string;
  className?: string;
  style?: CSSProperties;
}>;

export function StatusBadge({ status, labelOverride, className, style }: StatusBadgeProps) {
  const key = normalizeStatus(status);
  const label = labelOverride?.trim() || STATUS_LABELS[key] || STATUS_LABELS.unknown;
  const variant = STATUS_VARIANT[key] ?? "neutral";
  return (
    <Badge variant={variant} className={className} style={style}>
      {label}
    </Badge>
  );
}
