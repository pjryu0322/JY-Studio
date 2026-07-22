"use client";

import Link from "next/link";
import type { RoleRailItem } from "@/lib/role-workspace/types";
import { StepStatusBadge } from "@/components/role-workspace/StepStatusBadge";

export function RoleRailItemView({
  item,
  onNavigate,
}: {
  readonly item: RoleRailItem;
  readonly onNavigate?: () => void;
}) {
  const disabled = item.status === "blocked" || !item.href;
  const active = item.status === "current" || item.status === "next";

  const className = `flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm transition ${
    item.status === "current"
      ? "bg-indigo-600 text-white"
      : item.status === "next"
        ? "bg-sky-50 text-sky-950 ring-1 ring-sky-200"
        : item.status === "blocked"
          ? "cursor-not-allowed text-slate-400"
          : "text-slate-700 hover:bg-slate-50"
  }`;

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className={`font-semibold ${item.status === "current" ? "text-white" : ""}`}>
          {item.label}
        </span>
        {item.status !== "current" ? <StepStatusBadge status={item.status} /> : null}
        {item.badge ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
            {item.badge}
          </span>
        ) : null}
      </span>
      {item.blockedReason ? (
        <span className="text-[11px] text-slate-500">{item.blockedReason}</span>
      ) : null}
    </>
  );

  if (disabled || !item.href) {
    return (
      <div className={className} title={item.blockedReason}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      onClick={onNavigate}
      aria-current={active ? "step" : undefined}
    >
      {body}
    </Link>
  );
}
