"use client";

export function WorkflowActionButton({
  label,
  onClick,
  variant = "secondary",
}: {
  label: string;
  onClick: () => void;
  variant?: "secondary" | "primary";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: isPrimary ? "1px solid #2563eb" : "1px solid #d1d5db",
        background: isPrimary ? "#2563eb" : "#fafafa",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 900,
        color: isPrimary ? "#fff" : "#111827",
      }}
    >
      {label}
    </button>
  );
}

