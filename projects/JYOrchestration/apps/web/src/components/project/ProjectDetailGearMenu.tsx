"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { readUiLabelsEnabled, subscribe, writeUiLabelsEnabled } from "@/lib/ui-label/useUiLabel";

const sectionTitle: CSSProperties = {
  margin: "12px 0 8px 0",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const labelRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  fontSize: 13,
  color: "#0f172a",
  userSelect: "none",
  marginBottom: 8,
};

function GearMenuRow({
  label,
  href,
  disabled,
  description,
  onClose,
}: {
  readonly label: string;
  readonly href: string;
  readonly disabled?: boolean;
  readonly description?: string;
  readonly onClose?: () => void;
}) {
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: disabled ? "#f8fafc" : "#fff",
    textDecoration: "none",
    color: disabled ? "#94a3b8" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
  };
  return disabled ? (
    <div style={baseStyle} aria-disabled>
      <div style={{ display: "grid", gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
        {description ? <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.35 }}>{description}</div> : null}
      </div>
      <span style={{ fontSize: 12, fontWeight: 800 }}>준비중</span>
    </div>
  ) : (
    <Link href={href} style={baseStyle} onClick={onClose}>
      <div style={{ display: "grid", gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
        {description ? <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.35 }}>{description}</div> : null}
      </div>
      <span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>→</span>
    </Link>
  );
}

/**
 * 프로젝트 상세 상단 우측 톱니바퀴 — 표시 옵션(로컬 저장).
 * 실행 환경 본문은「실행 환경」탭에서 구성합니다.
 */
export function ProjectDetailGearMenu({ projectId }: { readonly projectId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [labelsOn, setLabelsOn] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setLabelsOn(readUiLabelsEnabled());
    });
    const off = subscribe(() => setLabelsOn(readUiLabelsEnabled()));
    return () => off();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const encodedProjectId = useMemo(() => encodeURIComponent(String(projectId ?? "").trim()), [projectId]);
  const hasPid = Boolean(String(projectId ?? "").trim());
  const href = (path: string) => (hasPid ? `${path}?projectId=${encodedProjectId}` : path);

  if (!mounted) return null;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        data-testid="project-detail-gear-menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="프로젝트 표시 설정"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: open ? "1px solid #2563eb" : "1px solid #ccc",
          background: open ? "#eff6ff" : "#fafafa",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: open ? "#1e40af" : "#334155",
        }}
      >
        ⚙️
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="프로젝트 설정"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            padding: "14px 16px",
            minWidth: 280,
            maxWidth: "min(360px, calc(100vw - 48px))",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(15,23,42,0.12)",
            zIndex: 50,
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>설정</p>
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
            이 브라우저에만 저장됩니다. 실행 환경(Cursor·Git 검증)은「실행 환경」탭에서 구성합니다.
          </p>

          <div style={sectionTitle}>프로젝트</div>
          <div style={{ display: "grid", gap: 8 }}>
            <GearMenuRow onClose={() => setOpen(false)} label="프로젝트 정보" href={hasPid ? `/projects/${encodedProjectId}?view=workspace` : "/"} disabled={!hasPid} description="워크스페이스에서 기본 정보를 확인합니다." />
            <GearMenuRow onClose={() => setOpen(false)} label="프로젝트 멤버" href={href("/project-admin/members")} disabled={!hasPid} />
            <GearMenuRow onClose={() => setOpen(false)} label="권한 관리" href={href("/project-admin/members")} disabled={!hasPid} description="멤버 화면에서 권한을 관리합니다." />
          </div>

          <div style={sectionTitle}>AI</div>
          <div style={{ display: "grid", gap: 8 }}>
            <GearMenuRow onClose={() => setOpen(false)} label="AI기획자 설정" href={href("/project-admin/settings")} disabled={!hasPid} description="연결/정책은 설정에서 확인합니다." />
            <GearMenuRow onClose={() => setOpen(false)} label="모델 선택" href={href("/project-admin/settings")} disabled={!hasPid} description="현재는 설정에서만 변경 가능합니다." />
            <GearMenuRow onClose={() => setOpen(false)} label="자동화 정책" href={href("/project-admin/settings")} disabled={!hasPid} description="후속 단계에서 확장됩니다." />
          </div>

          <div style={sectionTitle}>개발 연동</div>
          <div style={{ display: "grid", gap: 8 }}>
            <GearMenuRow onClose={() => setOpen(false)} label="GitHub" href={href("/project-admin/settings")} disabled={!hasPid} description="연동 설정(준비 단계)" />
            <GearMenuRow onClose={() => setOpen(false)} label="Cursor" href={href("/project-admin/settings")} disabled={!hasPid} description="연동 설정(준비 단계)" />
            <GearMenuRow onClose={() => setOpen(false)} label="Preview" href={hasPid ? `/projects/${encodedProjectId}?view=workspace` : "/"} disabled={!hasPid} description="Mock Preview는 워크스페이스에서 확인합니다." />
            <GearMenuRow onClose={() => setOpen(false)} label="템플릿 설정" href={hasPid ? `/projects/${encodedProjectId}?view=workspace` : "/"} disabled={!hasPid} description="Mock 템플릿 선택/추천" />
          </div>

          <div style={sectionTitle}>고급 표시 옵션</div>
          <label style={labelRow}>
            <input
              type="checkbox"
              checked={labelsOn}
              onChange={(e) => {
                const next = e.target.checked;
                setLabelsOn(next);
                writeUiLabelsEnabled(next);
              }}
              style={{ width: 16, height: 16, accentColor: "#2563eb" }}
            />
            <span>화면 라벨 표시</span>
          </label>

          <div style={sectionTitle}>개발자 옵션</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.45 }}>
            내부 디버그/표시 옵션은 향후 이 영역에 추가됩니다.
          </div>
        </div>
      ) : null}
    </div>
  );
}
