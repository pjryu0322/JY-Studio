"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ClassifierOverview {
  totalClassifiedPages: number;
  lowConfidencePages: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  pageTypeBreakdown: Array<{ key: string; count: number }>;
  subTypeBreakdown: Array<{ key: string; count: number }>;
  overrideFrequency: {
    total: number;
    orientation: number;
    pageType: number;
    subType: number;
  };
}

interface ChunkQualityOverview {
  totalChunks: number;
  averageQualityScore: number;
  averageBoundaryScore: number;
  averageNoiseScore: number;
  averageStructureScore: number;
  qualityBuckets: {
    poor: number;
    acceptable: number;
    good: number;
  };
}

interface AuditLogEntry {
  id: string;
  category: string;
  action: string;
}

export default function AdminOverviewPage() {
  const [classifier, setClassifier] =
    useState<ClassifierOverview | null>(null);
  const [quality, setQuality] =
    useState<ChunkQualityOverview | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [classifierRes, qualityRes, logsRes] =
          await Promise.all([
            fetch("/api/admin/classifier-overview"),
            fetch("/api/admin/chunk-quality-overview"),
            fetch("/api/admin/logs?limit=600"),
          ]);
        if (!classifierRes.ok || !qualityRes.ok || !logsRes.ok) {
          throw new Error("Failed to load admin overview");
        }
        const classifierPayload = (await classifierRes.json()) as {
          overview?: ClassifierOverview;
        };
        const qualityPayload = (await qualityRes.json()) as {
          overview?: ChunkQualityOverview;
        };
        const logsPayload = (await logsRes.json()) as {
          logs?: AuditLogEntry[];
        };
        if (cancelled) return;
        setClassifier(classifierPayload.overview ?? null);
        setQuality(qualityPayload.overview ?? null);
        setLogs(Array.isArray(logsPayload.logs) ? logsPayload.logs : []);
      } catch {
        if (!cancelled) {
          setError("운영 지표를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const reviewActionSummary = useMemo(() => {
    const reviewActions = logs.filter((log) => {
      if (log.category !== "workspace_edit") return false;
      return (
        log.action.startsWith("override_") ||
        log.action === "exclude_chunk" ||
        log.action === "merge_chunk" ||
        log.action === "split_chunk" ||
        log.action === "boundary_drag" ||
        log.action === "update_chunk_label" ||
        log.action === "update_review_note"
      );
    });
    const counters = new Map<string, number>();
    for (const item of reviewActions) {
      counters.set(
        item.action,
        (counters.get(item.action) ?? 0) + 1,
      );
    }
    return Array.from(counters.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "20px",
      }}
    >
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>
            Admin Operations Overview
          </h1>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/logs" style={linkBtn}>
              Override / Review Logs
            </Link>
            <Link href="/admin" style={linkBtn}>
              관리자 홈
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={placeholderText}>운영 지표를 불러오는 중입니다.</div>
        ) : error ? (
          <div style={{ ...placeholderText, color: "#b91c1c" }}>
            {error}
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              <article style={card}>
                <h2 style={title}>Classifier Overview</h2>
                <SummaryRow
                  label="classified pages"
                  value={String(
                    classifier?.totalClassifiedPages ?? 0,
                  )}
                />
                <SummaryRow
                  label="low confidence pages"
                  value={String(
                    classifier?.lowConfidencePages ?? 0,
                  )}
                  warn
                />
                <div style={{ display: "grid", gap: 4 }}>
                  <MetricBar
                    label="high"
                    value={
                      classifier?.confidenceDistribution.high ?? 0
                    }
                    color="#16a34a"
                  />
                  <MetricBar
                    label="medium"
                    value={
                      classifier?.confidenceDistribution.medium ?? 0
                    }
                    color="#d97706"
                  />
                  <MetricBar
                    label="low"
                    value={
                      classifier?.confidenceDistribution.low ?? 0
                    }
                    color="#dc2626"
                  />
                </div>
              </article>

              <article style={card}>
                <h2 style={title}>Chunk Quality Overview</h2>
                <SummaryRow
                  label="total chunks"
                  value={String(quality?.totalChunks ?? 0)}
                />
                <SummaryRow
                  label="avg quality"
                  value={toPct(quality?.averageQualityScore)}
                />
                <SummaryRow
                  label="avg boundary"
                  value={toPct(quality?.averageBoundaryScore)}
                />
                <SummaryRow
                  label="avg noise"
                  value={toPct(quality?.averageNoiseScore)}
                />
                <SummaryRow
                  label="avg structure"
                  value={toPct(quality?.averageStructureScore)}
                />
              </article>

              <article style={card}>
                <h2 style={title}>Override / Review Activity</h2>
                <SummaryRow
                  label="total override events"
                  value={String(
                    classifier?.overrideFrequency.total ?? 0,
                  )}
                />
                <SummaryRow
                  label="orientation overrides"
                  value={String(
                    classifier?.overrideFrequency.orientation ?? 0,
                  )}
                />
                <SummaryRow
                  label="page type overrides"
                  value={String(
                    classifier?.overrideFrequency.pageType ?? 0,
                  )}
                />
                <SummaryRow
                  label="subtype overrides"
                  value={String(
                    classifier?.overrideFrequency.subType ?? 0,
                  )}
                />
              </article>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
              }}
            >
              <article style={card}>
                <h3 style={subTitle}>Page Type Breakdown</h3>
                <SimpleList
                  items={classifier?.pageTypeBreakdown ?? []}
                />
              </article>
              <article style={card}>
                <h3 style={subTitle}>Subtype Breakdown</h3>
                <SimpleList
                  items={classifier?.subTypeBreakdown ?? []}
                />
              </article>
              <article style={card}>
                <h3 style={subTitle}>Chunk Quality Buckets</h3>
                <SimpleList
                  items={[
                    {
                      key: "good",
                      count: quality?.qualityBuckets.good ?? 0,
                    },
                    {
                      key: "acceptable",
                      count:
                        quality?.qualityBuckets.acceptable ?? 0,
                    },
                    {
                      key: "poor",
                      count: quality?.qualityBuckets.poor ?? 0,
                    },
                  ]}
                />
              </article>
              <article style={card}>
                <h3 style={subTitle}>Recent Review Actions</h3>
                <SimpleList
                  items={reviewActionSummary.map((item) => ({
                    key: item.action,
                    count: item.count,
                  }))}
                />
              </article>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function SummaryRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: warn ? "#b91c1c" : "#334155",
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#475569",
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div
        style={{
          borderRadius: 999,
          height: 6,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function SimpleList({
  items,
}: {
  items: Array<{ key: string; count: number }>;
}) {
  if (items.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#64748b" }}>
        데이터가 없습니다.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {items.slice(0, 10).map((item) => (
        <div
          key={item.key}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            borderBottom: "1px solid #f1f5f9",
            paddingBottom: 4,
          }}
        >
          <span style={{ color: "#334155" }}>{item.key}</span>
          <strong style={{ color: "#0f172a" }}>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function toPct(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return `${Math.round(value * 100)}%`;
}

const card = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 8,
} as const;

const title = {
  margin: 0,
  fontSize: 15,
  color: "#0f172a",
} as const;

const subTitle = {
  margin: 0,
  fontSize: 14,
  color: "#0f172a",
} as const;

const placeholderText = {
  fontSize: 13,
  color: "#64748b",
} as const;

const linkBtn = {
  fontSize: 12,
  color: "#1d4ed8",
  textDecoration: "none",
} as const;
