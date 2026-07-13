import type { KnowledgePack } from "@/types/pack";
import { publicPackContentTypeLabel } from "@/lib/public-pack-content-type";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";

export function PackCapabilityBadges({ pack }: { readonly pack: KnowledgePack }) {
  const capabilities = pack.capabilities;
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;
  const downloadReady = capabilities?.download.status === "READY";
  const mcpReady = capabilities?.mcp.status === "READY";
  const contentLabel = publicPackContentTypeLabel(pack.contentType ?? null);

  const badges: Array<{ key: string; label: string; className: string }> = [];

  if (pack.status === "PUBLISHED" || pack.status === "DEPRECATED") {
    // Public catalog packs are shown as 공개 when published/verified (mapped to PUBLISHED).
  }
  badges.push({
    key: "public",
    label: "공개",
    className: "bg-slate-100 text-slate-700",
  });

  if (contentLabel) {
    badges.push({
      key: "content",
      label: contentLabel,
      className: "bg-indigo-50 text-indigo-800",
    });
  }

  if (downloadReady) {
    badges.push({
      key: "download",
      label: "다운로드 가능",
      className: "bg-emerald-50 text-emerald-800",
    });
  }

  if (apiReady) {
    badges.push({
      key: "api",
      label: "API 연동 가능",
      className: "bg-sky-50 text-sky-800",
    });
  } else if (downloadReady) {
    badges.push({
      key: "api-pending",
      label: "API 준비 중",
      className: "bg-amber-50 text-amber-900",
    });
  }

  if (mcpReady) {
    badges.push({
      key: "mcp",
      label: "MCP 가능",
      className: "bg-violet-50 text-violet-800",
    });
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
