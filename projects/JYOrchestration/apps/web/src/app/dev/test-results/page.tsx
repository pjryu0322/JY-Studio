"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CaseRow = {
  id: string;
  name: string;
  status: string;
  durationMs: number;
  message: string | null;
  source?: string;
};

type SuiteRow = { suite: string; cases: CaseRow[] };

type LatestPayload = {
  startedAt: string;
  finishedAt: string;
  summary: { total: number; passed: number; failed: number; skipped: number };
  suites: SuiteRow[];
};

type LoadResult = { data: LatestPayload | null; message: string | null };

async function fetchTestResults(): Promise<LoadResult> {
  try {
    const res = await fetch("/api/dev/test-results", { credentials: "include" });
    const json = (await res.json()) as {
      success?: boolean;
      data?: LatestPayload | null;
      message?: string;
    };
    if (res.status === 401) {
      return { data: null, message: "로그인이 필요합니다." };
    }
    if (res.status === 404) {
      return { data: null, message: "이 환경에서는 테스트 결과 API를 사용할 수 없습니다." };
    }
    if (!json.success) {
      return { data: null, message: json.message || "불러오기 실패" };
    }
    if (json.data === null || json.data === undefined) {
      return { data: null, message: json.message || "아직 결과가 없습니다." };
    }
    return { data: json.data, message: null };
  } catch {
    return { data: null, message: "네트워크 오류" };
  }
}

export default function TestResultsDashboardPage() {
  const [data, setData] = useState<LatestPayload | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [failOnly, setFailOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void fetchTestResults().then((r) => {
      if (cancelled) return;
      setData(r.data);
      setMessage(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    void fetchTestResults().then((r) => {
      setData(r.data);
      setMessage(r.message);
    });
  };

  const flatCases = useMemo(() => {
    if (!data) return [];
    const rows: (CaseRow & { suite: string })[] = [];
    for (const s of data.suites) {
      for (const c of s.cases) {
        rows.push({ ...c, suite: s.suite });
      }
    }
    return rows;
  }, [data]);

  const visibleCases = useMemo(() => {
    if (!failOnly) return flatCases;
    return flatCases.filter((c) => c.status !== "passed");
  }, [flatCases, failOnly]);

  if (data === undefined) {
    return (
      <main data-ui-label="[D-1] Test Results Dashboard" style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <p>불러오는 중…</p>
      </main>
    );
  }

  return (
    <main
      data-ui-label="[D-1] Test Results Dashboard"
      style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}
      data-testid="test-results-page"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>테스트 결과</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" data-testid="test-results-refresh" onClick={refresh}>
            새로고침
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              data-testid="test-results-fail-only"
              checked={failOnly}
              onChange={(e) => setFailOnly(e.target.checked)}
            />
            실패만
          </label>
          <Link href="/" style={{ fontSize: 14, alignSelf: "center" }}>
            홈
          </Link>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
        `npm run test:all` 또는 `test:api` / `test:e2e` 실행 후 생성되는{" "}
        <code>.artifacts/test-results/latest.json</code> 을 표시합니다. 로그인 필요.
      </p>

      {message ? (
        <p style={{ color: "#b45309", marginTop: 16 }} data-testid="test-results-message">
          {message}
        </p>
      ) : null}

      {data ? (
        <>
          <section
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
            data-testid="test-results-summary"
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>요약</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, fontSize: 14 }}>
              <div>총 {data.summary.total}</div>
              <div style={{ color: "#15803d" }}>성공 {data.summary.passed}</div>
              <div style={{ color: "#b91c1c" }}>실패 {data.summary.failed}</div>
              <div style={{ color: "#a16207" }}>스킵 {data.summary.skipped}</div>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
              시작 {data.startedAt} — 종료 {data.finishedAt}
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>케이스 목록</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {visibleCases.map((c) => {
                const key = `${c.suite}::${c.name}`;
                const open = expanded[key] ?? false;
                return (
                  <li
                    key={key}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 12,
                      background: c.status === "failed" ? "#fef2f2" : "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [key]: !open }))}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <span style={{ fontWeight: 700, marginRight: 8 }}>{c.status.toUpperCase()}</span>
                      <code style={{ fontSize: 12, marginRight: 8 }}>{c.id}</code>
                      <span style={{ fontSize: 14 }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
                        {c.durationMs}ms · {c.suite}
                      </span>
                    </button>
                    {open && c.message ? (
                      <pre
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          whiteSpace: "pre-wrap",
                          color: "#991b1b",
                        }}
                      >
                        {c.message}
                      </pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
