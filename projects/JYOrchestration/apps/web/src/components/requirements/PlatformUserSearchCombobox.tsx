"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PlatformUserRow = {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

function parseIsoMs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** 활동 시각이 없으면 가입일을 보조로 사용합니다. */
function activityMs(row: PlatformUserRow): number {
  const u = parseIsoMs(row.updatedAt);
  if (u) return u;
  return parseIsoMs(row.createdAt);
}

function presenceBadge(row: PlatformUserRow, now: number): { label: string; bg: string; color: string } {
  const ms = activityMs(row);
  if (!ms) {
    return { label: "일반", bg: "#f4f4f5", color: "#52525b" };
  }
  const age = now - ms;
  if (age < 2 * 60 * 60 * 1000) {
    return { label: "온라인", bg: "#dcfce7", color: "#166534" };
  }
  if (age < 7 * 24 * 60 * 60 * 1000) {
    return { label: "최근 접속", bg: "#e0f2fe", color: "#0369a1" };
  }
  return { label: "일반", bg: "#f4f4f5", color: "#52525b" };
}

export function PlatformUserSearchCombobox({
  onPick,
  disabled,
  bootstrapRecent = false,
  existingMemberUserIds,
}: {
  readonly onPick: (u: PlatformUserRow) => void;
  readonly disabled?: boolean;
  /** true면 모달 오픈 시 최근 사용자 목록을 불러옵니다. */
  readonly bootstrapRecent?: boolean;
  /** 이미 프로젝트 HUMAN 멤버인 userId — 행 비활성화 */
  readonly existingMemberUserIds?: ReadonlySet<string>;
}) {
  const [q, setQ] = useState("");
  const [recentRows, setRecentRows] = useState<PlatformUserRow[]>([]);
  const [searchRows, setSearchRows] = useState<PlatformUserRow[]>([]);
  const [busyRecent, setBusyRecent] = useState(false);
  const [busySearch, setBusySearch] = useState(false);
  const [recentError, setRecentError] = useState(false);

  const loadRecent = useCallback(async () => {
    setBusyRecent(true);
    setRecentError(false);
    try {
      const res = await fetch("/api/platform/users/recent?limit=10", { credentials: "include" });
      const json = (await res.json()) as { success?: boolean; data?: PlatformUserRow[] };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setRecentRows([]);
        setRecentError(true);
        return;
      }
      setRecentRows(json.data as PlatformUserRow[]);
    } catch {
      setRecentRows([]);
      setRecentError(true);
    } finally {
      setBusyRecent(false);
    }
  }, []);

  useEffect(() => {
    if (!bootstrapRecent) return;
    void loadRecent();
  }, [bootstrapRecent, loadRecent]);

  const search = useCallback(async (query: string) => {
    const t = query.trim();
    if (t.length < 2) {
      setSearchRows([]);
      return;
    }
    setBusySearch(true);
    try {
      const res = await fetch(`/api/platform/users/search?q=${encodeURIComponent(t)}&limit=15`, { credentials: "include" });
      const json = (await res.json()) as { success?: boolean; data?: PlatformUserRow[] };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setSearchRows([]);
        return;
      }
      setSearchRows(
        json.data.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
          updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
        }))
      );
    } finally {
      setBusySearch(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void search(q);
    }, 280);
    return () => clearTimeout(t);
  }, [q, search]);

  const queryActive = q.trim().length >= 2;

  const quickPick = useMemo(() => recentRows.slice(0, 5), [recentRows]);

  /** 검색 결과와 중복되지 않는 추천 행만 위에 표시합니다. */
  const quickVisible = useMemo(
    () => quickPick.filter((q) => !searchRows.some((s) => s.id === q.id)),
    [quickPick, searchRows]
  );

  const renderRow = (u: PlatformUserRow, keyPrefix: string) => {
    const joined = existingMemberUserIds?.has(u.id) ?? false;
    const badge = presenceBadge(u, Date.now());
    const rowDisabled = Boolean(disabled || joined);
    return (
      <li key={`${keyPrefix}-${u.id}`} style={{ listStyle: "none" }}>
        <button
          type="button"
          disabled={rowDisabled}
          onClick={() => {
            if (rowDisabled) return;
            onPick(u);
          }}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            border: 0,
            borderBottom: "1px solid #f1f5f9",
            background: joined ? "#fafafa" : "#fff",
            cursor: rowDisabled ? "not-allowed" : "pointer",
            opacity: rowDisabled ? 0.72 : 1,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{u.name || "(이름 없음)"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {joined ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "#e0e7ff",
                    color: "#3730a3",
                  }}
                >
                  참여 중
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: badge.bg,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              )}
            </div>
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{u.email}</div>
        </button>
      </li>
    );
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        type="search"
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름 또는 이메일 검색"
        aria-label="플랫폼 사용자 검색"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "11px 14px",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          fontSize: 14,
          background: "#fafafa",
        }}
      />

      <div
        style={{
          maxHeight: 340,
          overflowY: "auto",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
        }}
      >
        {!queryActive ? (
          <div>
            <div
              style={{
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: "0.02em",
                borderBottom: "1px solid #f1f5f9",
                background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
              }}
            >
              추천 · 최근 가입 사용자
            </div>
            {busyRecent ? <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>불러오는 중…</div> : null}
            {!busyRecent && recentError ? (
              <div style={{ padding: 14, fontSize: 13, color: "#b45309" }}>목록을 불러오지 못했습니다. 검색으로 찾아 보세요.</div>
            ) : null}
            {!busyRecent && !recentError && recentRows.length === 0 ? (
              <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>등록된 사용자가 없습니다.</div>
            ) : null}
            {!busyRecent && recentRows.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{recentRows.map((u) => renderRow(u, "recent"))}</ul>
            ) : null}
          </div>
        ) : (
          <div>
            {quickVisible.length > 0 ? (
              <div style={{ borderBottom: "1px solid #f1f5f9" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#64748b",
                    letterSpacing: "0.02em",
                    background: "#fafafa",
                  }}
                >
                  추천 · 최근 사용자
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{quickVisible.map((u) => renderRow(u, "quick"))}</ul>
              </div>
            ) : null}
            <div>
              <div
                style={{
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#64748b",
                  letterSpacing: "0.02em",
                  borderBottom: "1px solid #f1f5f9",
                  background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
                }}
              >
                검색 결과
              </div>
              {busySearch ? <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>검색 중…</div> : null}
              {!busySearch && searchRows.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>검색 결과가 없습니다.</div>
              ) : null}
              {!busySearch && searchRows.length > 0 ? (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{searchRows.map((u) => renderRow(u, "search"))}</ul>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
