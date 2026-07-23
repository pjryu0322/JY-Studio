"use client";

/** Inline SVG pictograms for role-workspace rail steps (accessible via parent title/aria). */
export function RoleRailIcon({
  id,
  className = "h-5 w-5",
}: {
  readonly id: string;
  readonly className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (id) {
    case "list":
    case "myPacks":
    case "explore":
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
          <rect x="15" y="15" width="5" height="5" rx="1" />
        </svg>
      );
    case "basic":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M8 5h10a2 2 0 0 1 2 2v12H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <path d="m10 12 2 2 4-4" />
          <path d="M10 17h5" />
        </svg>
      );
    case "payload":
    case "generation":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m8 11 4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      );
    case "knowledge":
      return (
        <svg {...common}>
          <path d="M4 7h16v10H4z" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M8 12h8M8 15h5" />
        </svg>
      );
    case "quality":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.2 2.8 7.4 7 8.5 4.2-1.1 7-4.3 7-8.5V6z" />
          <path d="m9.5 12 1.8 1.8 3.4-3.6" />
        </svg>
      );
    case "serviceValidation":
    case "searchValidation":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m15 15 4.5 4.5" />
        </svg>
      );
    case "distributionReview":
    case "distribution":
    case "publish":
      return (
        <svg {...common}>
          <path d="M4 12h12l4-4v10l-4-4H4z" />
          <path d="M7 12V8h6v4" />
        </svg>
      );
    case "reviewRequest":
    case "result":
    case "decision":
      return (
        <svg {...common}>
          <path d="M8 5h10a2 2 0 0 1 2 2v12H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <path d="m10 12 2 2 4-4" />
        </svg>
      );
    case "queue":
    case "reviews":
      return (
        <svg {...common}>
          <path d="M5 6h14M5 12h14M5 18h9" />
          <circle cx="18" cy="18" r="2.5" />
        </svg>
      );
    case "ops":
    case "account":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2.2M12 18.8V21M4.2 6.5l1.9 1.1M17.9 16.4l1.9 1.1M3 12h2.2M18.8 12H21M4.2 17.5l1.9-1.1M17.9 7.6l1.9-1.1" />
        </svg>
      );
    case "apiKeys":
      return (
        <svg {...common}>
          <circle cx="8" cy="14" r="3.5" />
          <path d="M11 14h9v3M16 14v3" />
        </svg>
      );
    case "docs":
      return (
        <svg {...common}>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5M10 13h6M10 17h4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 9v3.5M12 15.5h.01" />
        </svg>
      );
  }
}
