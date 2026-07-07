"use client";

type ExportButton = {
  readonly label: string;
  readonly path: (packId: string) => string;
  readonly hint: string;
};

const EXPORTS: ExportButton[] = [
  {
    label: "Package JSON 다운로드",
    path: (packId) => `/api/v1/admin/packs/${encodeURIComponent(packId)}/exports/package`,
    hint: "pack/version/chunk/graph 메타를 포함한 전체 export (raw embedding vector 제외)",
  },
  {
    label: "RAG JSONL 다운로드",
    path: (packId) => `/api/v1/admin/packs/${encodeURIComponent(packId)}/exports/rag-jsonl`,
    hint: "외부 RAG 시스템에 import 가능한 line-delimited JSON (활성 chunk 기준)",
  },
  {
    label: "Graph JSON 다운로드",
    path: (packId) => `/api/v1/admin/packs/${encodeURIComponent(packId)}/exports/graph`,
    hint: "deterministic knowledge graph node/edge export",
  },
  {
    label: "MCP-ready Manifest 다운로드",
    path: (packId) => `/api/v1/admin/packs/${encodeURIComponent(packId)}/exports/mcp-manifest`,
    hint: "실제 MCP server가 아니라 향후 MCP 연계용 manifest (API key 미포함)",
  },
];

export function ExportPanel({ packId }: { readonly packId: string }) {
  const onDownload = (path: string) => {
    window.open(path, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-slate-900">Export (P15 foundation)</h3>
      <p className="text-xs text-store-muted">
        지식팩을 다양한 AI 도구와 연계할 수 있도록 JSON/JSONL 형태로 export합니다. API Key/사용자정보/과금정보 등
        민감 정보는 포함되지 않으며, 답변 생성은 하지 않습니다.
      </p>

      <div className="grid grid-cols-1 gap-2">
        {EXPORTS.map((item) => (
          <div key={item.label} className="space-y-1">
            <button
              type="button"
              onClick={() => onDownload(item.path(packId))}
              className="min-h-[44px] w-full rounded-xl border border-store-border bg-white text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              {item.label}
            </button>
            <p className="px-1 text-[11px] text-store-muted">{item.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
