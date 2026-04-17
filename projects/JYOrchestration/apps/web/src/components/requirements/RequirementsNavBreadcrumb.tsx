"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

const crumbStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
  marginBottom: 10,
};

const sep = <span aria-hidden="true">›</span>;

export function RequirementsNavBreadcrumb({
  projectId,
  projectName,
}: {
  readonly projectId: string;
  /** 비어 있으면 "현재 프로젝트" 자리에 짧은 대체 문구 */
  readonly projectName: string;
}) {
  const pid = projectId.trim();
  const name = projectName.trim();
  const projectLabel = name || "프로젝트";

  return (
    <nav aria-label="위치" style={crumbStyle}>
      <Link href="/" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
        워크스페이스
      </Link>
      {sep}
      <Link href="/" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
        프로젝트 목록
      </Link>
      {pid ? (
        <>
          {sep}
          <Link
            href={`/projects/${encodeURIComponent(pid)}`}
            style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={projectLabel}
          >
            {projectLabel}
          </Link>
        </>
      ) : null}
      {sep}
      <span style={{ color: "#0f172a", fontWeight: 800 }}>요구사항</span>
    </nav>
  );
}
