"use client";

export function WorkflowActionButton({
  label,
  onClick,
  variant = "secondary",
  disabled,
}: {
  label: string;
  onClick: () => void;
  variant?: "secondary" | "primary";
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDisabled = Boolean(disabled);
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: isPrimary ? "1px solid #2563eb" : "1px solid #d1d5db",
        background: isPrimary ? "#2563eb" : "#fafafa",
        cursor: isDisabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 900,
        color: isPrimary ? "#fff" : "#111827",
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

