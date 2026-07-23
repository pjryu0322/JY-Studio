"use client";

import Link from "next/link";
import type { RoleRailItem } from "@/lib/role-workspace/types";
import { RoleRailIcon } from "@/components/role-workspace/RoleRailIcon";

function statusDotClass(status: RoleRailItem["status"]): string | null {
  switch (status) {
    case "completed":
      return "bg-emerald-500";
    case "current":
      return "bg-white ring-2 ring-indigo-300";
    case "next":
      return "bg-sky-500";
    case "warning":
      return "bg-amber-400";
    case "blocked":
      return "bg-slate-400";
    default:
      return null;
  }
}

export function RoleRailItemView({
  item,
  onNavigate,
}: {
  readonly item: RoleRailItem;
  readonly onNavigate?: () => void;
}) {
  const disabled = item.status === "blocked" || !item.href;
  const active = item.status === "current" || item.status === "next";
  const tip = [item.label, item.blockedReason, item.badge].filter(Boolean).join(" — ");
  const dot = statusDotClass(item.status);

  const className = `relative flex h-[3.025rem] w-[3.025rem] items-center justify-center rounded-xl transition ${
    item.status === "current"
      ? "bg-indigo-600 text-white shadow-sm"
      : item.status === "next"
        ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
        : item.status === "blocked"
          ? "cursor-not-allowed bg-slate-50 text-slate-300"
          : item.status === "completed"
            ? "bg-emerald-50 text-emerald-700"
            : item.status === "warning"
              ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
              : "bg-white text-slate-600 hover:bg-slate-50"
  }`;

  const body = (
    <>
      <RoleRailIcon id={item.id} className="h-[22px] w-[22px]" />
      {item.badge ? (
        <span
          className="absolute -left-0.5 -top-0.5 flex min-h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold leading-none text-white"
          aria-hidden
        >
          {item.badge}
        </span>
      ) : null}
      {dot ? (
        <span
          className={`absolute right-1 top-1 h-2 w-2 rounded-full ${dot}`}
          aria-hidden
        />
      ) : null}
      {item.status === "completed" ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold leading-none text-white"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
      <span className="sr-only">
        {item.label}
        {item.status === "completed" ? " (완료)" : ""}
        {item.status === "current" ? " (진행 중)" : ""}
        {item.status === "next" ? " (다음)" : ""}
        {item.status === "blocked" ? ` (대기${item.blockedReason ? `: ${item.blockedReason}` : ""})` : ""}
        {item.status === "warning" ? " (주의)" : ""}
      </span>
    </>
  );

  if (disabled || !item.href) {
    return (
      <div className={className} title={tip} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      onClick={onNavigate}
      title={tip}
      aria-label={item.label}
      aria-current={active ? "step" : undefined}
    >
      {body}
    </Link>
  );
}
