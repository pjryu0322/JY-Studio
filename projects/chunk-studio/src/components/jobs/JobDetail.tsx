"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useJobStore } from "@/store/jobStore";
import type { JobDetailDTO } from "@/types/job";
import type { TemplateApplyPreview, TemplateRecommendResponse } from "@/types/template";
import JobTimeline from "./JobTimeline";
import ReplacePdfPanel from "./ReplacePdfPanel";

type Preset = "RFP_DEFAULT" | "SHORT" | "LONG" | "REQUIREMENT_FIRST";

const PRESET_LABELS: Record<Preset, string> = {
  RFP_DEFAULT: "RFP 기본",
  SHORT: "짧게",
  LONG: "길게",
  REQUIREMENT_FIRST: "요구사항 우선",
};

export default function JobDetail() {
  const router = useRouter();
  const { jobs, selectedJobId, refresh } = useJobStore();
  const job = jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null;
  const [detail, setDetail] = useState<JobDetailDTO | null>(null);
  const [preset, setPreset] = useState<Preset>("RFP_DEFAULT");
  const [targetTokens, setTargetTokens] = useState(550);
  const [maxTokens, setMaxTokens] = useState(900);
  const [minTokens, setMinTokens] = useState(150);
  const [overlapSentences, setOverlapSentences] = useState(2);
  const [headerFooterThreshold, setHeaderFooterThreshold] = useState(0.6);
  const [enableConstraintRules, setEnableConstraintRules] = useState(true);
  const [forcePositionalCleaning, setForcePositionalCleaning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [warningFilter, setWarningFilter] = useState<Record<string, boolean>>({});
  const [tagFilter, setTagFilter] = useState<Record<string, boolean>>({});
  const [openJson, setOpenJson] = useState<Record<string, boolean>>({});
  const [family, setFamily] = useState("default/general");
  const [templateRecommend, setTemplateRecommend] =
    useState<TemplateRecommendResponse | null>(null);
  const [templatePreview, setTemplatePreview] = useState<TemplateApplyPreview | null>(
    null
  );

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    fetch(`/api/jobs/${job.id}`)
      .then(async (res) => (res.ok ? ((await res.json()) as JobDetailDTO) : null))
      .then((data) => {
        if (!cancelled && data) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  const allWarnings = useMemo(
    () => Array.from(new Set((detail?.chunks ?? []).flatMap((c) => c.meta.quality.warnings))),
    [detail]
  );
  const allTags = useMemo(
    () => Array.from(new Set((detail?.chunks ?? []).flatMap((c) => c.meta.tags))),
    [detail]
  );
  const filteredChunks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeWarnings = allWarnings.filter((w) => warningFilter[w]);
    const activeTags = allTags.filter((t) => tagFilter[t]);
    return (detail?.chunks ?? []).filter((chunk) => {
      const matchSearch =
        !q ||
        chunk.text.toLowerCase().includes(q) ||
        chunk.meta.sectionPath.join(" > ").toLowerCase().includes(q) ||
        chunk.meta.tags.some((t) => t.toLowerCase().includes(q));
      const matchWarnings =
        activeWarnings.length === 0 ||
        activeWarnings.every((w) => chunk.meta.quality.warnings.includes(w));
      const matchTags =
        activeTags.length === 0 || activeTags.every((t) => chunk.meta.tags.includes(t));
      return matchSearch && matchWarnings && matchTags;
    });
  }, [detail, search, warningFilter, tagFilter, allWarnings, allTags]);

  if (!job) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>Job details</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
          Select a job from the list on the left to see details.
        </p>
      </div>
    );
  }

  const created = new Date(job.createdAt);
  const updated = new Date(job.updatedAt);
  const topWarnings =
    detail?.report?.warningDistribution &&
    Object.entries(detail.report.warningDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");

  const handleRechunk = async () => {
    setActionError(null);
    setWorking(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/rechunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset,
          config: {
            targetTokens,
            maxTokens,
            minTokens,
            overlapSentences,
            headerFooterThreshold,
            enableConstraintRules,
            forcePositionalCleaning,
          },
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Rechunk failed");
      }
      await refresh();
      const refreshed = await fetch(`/api/jobs/${job.id}`);
      if (refreshed.ok) setDetail((await refreshed.json()) as JobDetailDTO);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Rechunk failed");
    } finally {
      setWorking(false);
    }
  };

  const handleExportJsonl = async () => {
    setActionError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/export?format=jsonl`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Export failed");
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "application/jsonl;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-${job.id}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Export failed");
    }
  };

  const handleRecommendTemplate = async () => {
    setActionError(null);
    const res = await fetch("/api/templates/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, family }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setActionError(payload.error ?? "Template recommendation failed");
      return;
    }
    setTemplateRecommend((await res.json()) as TemplateRecommendResponse);
  };

  const handleApplyTemplate = async (templateId: string, version: string) => {
    setActionError(null);
    const res = await fetch("/api/templates/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        family,
        templateId,
        version,
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setActionError(payload.error ?? "Template apply failed");
      return;
    }
    setTemplatePreview((await res.json()) as TemplateApplyPreview);
  };

  return (
    <div style={{ padding: 16, height: "100%", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
        {job.originalFilename ?? `Job ${job.id}`}
      </h2>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        <div>ID: {job.id}</div>
        {!isNaN(created.getTime()) && <div>Created: {created.toLocaleString()}</div>}
        {!isNaN(updated.getTime()) && <div>Updated: {updated.toLocaleString()}</div>}
        <div>Status: {job.status}</div>
        <div>Progress: {job.progress}%</div>
      </div>
      {job.message && (
        <div style={{ marginBottom: 8, padding: 8, borderRadius: 4, border: "1px solid #e0e0e0", background: "#fafafa", fontSize: 12, color: "#444" }}>
          {job.message}
        </div>
      )}
      <JobTimeline status={job.status} errorDetail={job.errorDetail ?? null} />
      {job.status === "ACTION_REQUIRED" && <ReplacePdfPanel jobId={job.id} />}

      <section style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Template 추천</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            style={{ fontSize: 12, padding: 4, minWidth: 220 }}
            placeholder="family (e.g. companyA/projectX)"
          />
          <button type="button" onClick={handleRecommendTemplate}>
            템플릿 추천
          </button>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/templates/builder?jobId=${encodeURIComponent(job.id)}&family=${encodeURIComponent(family)}`
              )
            }
          >
            새 템플릿 만들기
          </button>
        </div>
        {templateRecommend && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#555" }}>
              docType: {templateRecommend.profile.docType}, sections:{" "}
              {templateRecommend.profile.sectionCandidates.length}, tables:{" "}
              {templateRecommend.profile.tableCandidates.length}
            </div>
            {templateRecommend.recommendations
              .filter((rec) => rec.confidence >= 0.75)
              .map((rec) => (
              <div key={rec.templateId} style={{ border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 12 }}>
                  {rec.templateId} ({rec.version}) - confidence{" "}
                  {Math.round(rec.confidence * 100)}%
                </div>
                <div style={{ fontSize: 11, color: "#555", margin: "4px 0" }}>
                  {rec.reasons.map((reason) => `• ${reason}`).join(" ")}
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(rec.templateId, rec.version)}
                >
                  템플릿 적용
                </button>
              </div>
            ))}
            {templateRecommend.recommendations.filter((rec) => rec.confidence >= 0.75).length === 0 && (
              <div style={{ fontSize: 12, color: "#555" }}>
                신뢰도 75% 이상 추천 템플릿이 없습니다. Template Builder로 생성하세요.
              </div>
            )}
          </div>
        )}
      </section>

      {templatePreview && (
        <section style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Template-aware Chunk Preview</h3>
          <div style={{ fontSize: 12, color: "#444", marginBottom: 6 }}>
            total {templatePreview.chunkMeta.total} / section{" "}
            {templatePreview.chunkMeta.sectionChunks} / table{" "}
            {templatePreview.chunkMeta.tableChunks} / repeat{" "}
            {templatePreview.chunkMeta.repeatChunks}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {templatePreview.chunks.slice(0, 6).map((chunk) => (
              <div key={chunk.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 12 }}>
                  [{chunk.type}] {chunk.meta.sectionTitle ?? chunk.meta.sectionId ?? "-"}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#555", whiteSpace: "pre-wrap" }}>
                  {chunk.text.slice(0, 220)}
                  {chunk.text.length > 220 ? "..." : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          {`Extraction ${detail?.extractionMethod ?? "-"} | Pipeline ${detail?.pipelineVersion ?? "-"} | Chunks ${
            detail?.report?.totalChunks ?? detail?.chunks.length ?? 0
          } | AvgTokens ${detail?.report?.avgTokens ?? 0} | 주요경고 ${topWarnings || "-"} | OCR ${
            detail?.ocrQuality ? "감지" : "없음"
          }`}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button type="button" onClick={handleRechunk} disabled={working} style={{ padding: "8px 12px", fontSize: 13 }}>
            {working ? "Rechunking..." : "Rechunk(설정 적용)"}
          </button>
          <button type="button" onClick={handleExportJsonl} style={{ padding: "8px 12px", fontSize: 13 }}>
            Export JSONL
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            프리셋
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} style={{ width: "100%", marginTop: 4 }}>
              {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                <option key={p} value={p}>
                  {PRESET_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            targetTokens
            <input type="number" value={targetTokens} onChange={(e) => setTargetTokens(Number(e.target.value || 0))} style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            maxTokens
            <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value || 0))} style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            overlapSentences
            <input type="number" value={overlapSentences} onChange={(e) => setOverlapSentences(Number(e.target.value || 0))} style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            헤더/푸터 임계치 (0.5~0.8)
            <input type="number" min={0.5} max={0.8} step={0.05} value={headerFooterThreshold} onChange={(e) => setHeaderFooterThreshold(Number(e.target.value || 0.6))} style={{ width: "100%", marginTop: 4 }} />
          </label>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: 12 }}>
          <input type="checkbox" checked={enableConstraintRules} onChange={(e) => setEnableConstraintRules(e.target.checked)} />
          constraints 규칙 사용
        </label>
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{ marginTop: 8, fontSize: 12, padding: "4px 8px" }}>
          {showAdvanced ? "고급 설정 닫기" : "고급 설정 열기"}
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <label style={{ fontSize: 12 }}>
              minTokens
              <input type="number" value={minTokens} onChange={(e) => setMinTokens(Number(e.target.value || 0))} style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 20, fontSize: 12 }}>
              <input type="checkbox" checked={forcePositionalCleaning} onChange={(e) => setForcePositionalCleaning(e.target.checked)} />
              bbox 기반 제거 강제
            </label>
          </div>
        )}
        {actionError && <div style={{ marginTop: 6, color: "#c62828", fontSize: 12 }}>{actionError}</div>}
      </section>

      {detail?.diff && (
        <section style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Diff (최근 Rechunk)</h3>
          <div style={{ fontSize: 12, color: "#444" }}>
            chunk 수: {detail.diff.before.chunkCount} -&gt; {detail.diff.after.chunkCount} ({detail.diff.delta.chunkCount >= 0 ? "+" : ""}
            {detail.diff.delta.chunkCount})
          </div>
          <div style={{ fontSize: 12, color: "#444" }}>
            평균 길이: {detail.diff.before.avgTokens} -&gt; {detail.diff.after.avgTokens} ({detail.diff.delta.avgTokens >= 0 ? "+" : ""}
            {detail.diff.delta.avgTokens})
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
            경고 상위 변화:{" "}
            {Object.entries(detail.diff.warningsDelta)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 5)
              .map(([k, v]) => `${k}:${v >= 0 ? "+" : ""}${v}`)
              .join(", ") || "-"}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
            태그 상위 변화:{" "}
            {Object.entries(detail.diff.tagsDelta)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 5)
              .map(([k, v]) => `${k}:${v >= 0 ? "+" : ""}${v}`)
              .join(", ") || "-"}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
            헤더/푸터 제거: {detail.diff.removedTextSample?.length ?? 0}개 라인
          </div>
        </section>
      )}

      <section style={{ marginTop: 12 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Chunk 탐색</h3>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="문자열/태그 검색" style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4, fontSize: 12 }} />
        <div style={{ marginTop: 8, fontSize: 12 }}>
          경고 필터:{" "}
          {allWarnings.map((w) => (
            <label key={w} style={{ marginRight: 8 }}>
              <input type="checkbox" checked={Boolean(warningFilter[w])} onChange={(e) => setWarningFilter((prev) => ({ ...prev, [w]: e.target.checked }))} /> {w}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 12 }}>
          태그 필터:{" "}
          {allTags.map((t) => (
            <label key={t} style={{ marginRight: 8 }}>
              <input type="checkbox" checked={Boolean(tagFilter[t])} onChange={(e) => setTagFilter((prev) => ({ ...prev, [t]: e.target.checked }))} /> {t}
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Chunks ({filteredChunks.length}/{detail?.chunks?.length ?? 0})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredChunks.slice(0, 30).map((chunk, index) => {
            const rowKey = chunk.meta.chunkId || `${job.id}-${index}`;
            return (
              <div key={rowKey} style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: 8, background: "#fafafa" }}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
                  {(chunk.meta.sectionPath.length > 0 ? chunk.meta.sectionPath.join(" > ") : "No section") + ` / ${chunk.meta.quality.tokens} tokens`}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
                  source: {chunk.meta.startBlockIdx}~{chunk.meta.endBlockIdx} / chunkId: {chunk.meta.chunkId}
                </div>
                {chunk.meta.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {chunk.meta.tags.map((tag) => (
                      <span key={`${rowKey}-${tag}`} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, border: "1px solid #90caf9", color: "#1565c0", background: "#e3f2fd" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {chunk.meta.quality.warnings.length > 0 && (
                  <div style={{ fontSize: 11, color: "#c62828", marginBottom: 4 }}>
                    Warnings: {chunk.meta.quality.warnings.join(", ")}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#333", whiteSpace: "pre-wrap" }}>{chunk.text.slice(0, 240)}{chunk.text.length > 240 ? "..." : ""}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                  <button type="button" style={{ fontSize: 11, padding: "3px 6px" }} onClick={() => navigator.clipboard.writeText(chunk.text)}>
                    복사
                  </button>
                  <button type="button" style={{ fontSize: 11, padding: "3px 6px" }} onClick={() => setOpenJson((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}>
                    JSON 보기
                  </button>
                </div>
                {openJson[rowKey] && (
                  <pre style={{ marginTop: 6, fontSize: 10, whiteSpace: "pre-wrap", background: "#fff", padding: 6, border: "1px solid #eee" }}>
                    {JSON.stringify(chunk.meta, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Report</h3>
        <div style={{ fontSize: 12, color: "#444" }}>
          avg/min/max tokens: {detail?.report?.avgTokens ?? 0} / {detail?.report?.minTokens ?? 0} / {detail?.report?.maxTokens ?? 0}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
          warning distribution: {detail?.report?.warningDistribution ? Object.entries(detail.report.warningDistribution).map(([k, v]) => `${k}:${v}`).join(", ") || "-" : "-"}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
          tag distribution: {detail?.report?.tagDistribution ? Object.entries(detail.report.tagDistribution).map(([k, v]) => `${k}:${v}`).join(", ") || "-" : "-"}
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Cleaning Log</h3>
        <div style={{ fontSize: 12, color: "#444" }}>
          method: {detail?.cleaningLog?.method ?? "-"}, threshold: {detail?.cleaningLog?.params?.threshold ?? "-"}, topBand: {detail?.cleaningLog?.params?.topBand ?? "-"}, bottomBand: {detail?.cleaningLog?.params?.bottomBand ?? "-"}, removed: {detail?.cleaningLog?.removedCount ?? 0}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
          {(detail?.cleaningLog?.removedSummary ?? []).map((r) => `${r.kind}(${r.count}):${r.text}`).join(" | ") || "-"}
        </div>
      </section>
    </div>
  );
}

