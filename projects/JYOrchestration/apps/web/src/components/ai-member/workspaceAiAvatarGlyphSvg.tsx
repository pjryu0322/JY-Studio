import type { ReactNode } from "react";
import type { WorkspaceAiAvatarGlyphKey } from "@/lib/ai-member/platformAiMembers";

/** 역할별 기본 아바타 — 인라인 SVG만 사용(외부 에셋 없음). */
export function workspaceAiAvatarGlyphSvg(key: WorkspaceAiAvatarGlyphKey, color: string, s: number): ReactNode {
  const stroke = color;
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (key) {
    case "document-strategy":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h6" />
          <path d="M16 13l2 2-2 2" />
        </svg>
      );
    case "data-flow":
      return (
        <svg {...common}>
          <circle cx="5" cy="6" r="2.2" />
          <circle cx="19" cy="6" r="2.2" />
          <circle cx="12" cy="18" r="2.2" />
          <path d="M6.5 7.5L10 12l-3.5 4.5M17.5 7.5L14 12l3.5 4.5" />
        </svg>
      );
    case "checklist-blocks":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="7" height="7" rx="1" />
          <rect x="14" y="4" width="7" height="7" rx="1" />
          <rect x="3" y="13" width="18" height="7" rx="1" />
          <path d="M6 7l1.5 1.5L10 6M17 7l-2 2" />
        </svg>
      );
    case "code-terminal":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 10l3 3-3 3M13 14h5" />
        </svg>
      );
    case "palette-layout":
      return (
        <svg {...common}>
          <circle cx="7.5" cy="8.5" r="2" />
          <circle cx="16" cy="9" r="2" />
          <circle cx="12" cy="16" r="2" />
          <path d="M4 20h16M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
        </svg>
      );
    case "magnifier-check":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
          <path d="M8 11l2 2 4-4" />
        </svg>
      );
    case "shield-lock":
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V7z" />
          <rect x="9" y="11" width="6" height="5" rx="1" />
          <path d="M12 11V9" />
        </svg>
      );
    case "clipboard-ops":
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
  }
}
