"use client";

/** H12 — planning 포화·stability 경고 배너(read-only). */
export function OverlaySaturationBanner({
  message,
}: {
  readonly message: string;
}) {
  return (
    <div
      role="status"
      style={{
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.45,
        color: "#92400e",
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      {message}
    </div>
  );
}
