"use client";

import type { JobStatus } from "@/types/job";

type StepState = "DONE" | "CURRENT" | "PENDING" | "FAILED";

interface Step {
  key: string;
  label: string;
  state: StepState;
}

interface Props {
  status: JobStatus;
  errorDetail?: string | null;
}

export default function JobTimeline({ status, errorDetail }: Props) {
  const steps = computeSteps(status);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Pipeline</h3>
      <div style={{ display: "flex" }}>
        <div style={{ marginRight: 12, marginTop: 4 }}>
          {steps.map((step, index) => (
            <TimelineMarker
              key={step.key}
              isLast={index === steps.length - 1}
              state={step.state}
            />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {steps.map((step) => (
            <TimelineRow key={step.key} step={step} />
          ))}
        </div>
      </div>
      {status === "FAILED" && errorDetail && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 4,
            border: "1px solid #c62828",
            background: "#ffebee",
            fontSize: 12,
            color: "#c62828",
          }}
        >
          {errorDetail}
        </div>
      )}
    </div>
  );
}

function computeSteps(status: JobStatus): Step[] {
  const base: Step[] = [
    { key: "UPLOADED", label: "Uploaded", state: "PENDING" },
    { key: "PDF", label: "PDF ready / Converting", state: "PENDING" },
    { key: "TEXT", label: "Extracting text", state: "PENDING" },
    { key: "CHUNKING", label: "Chunking", state: "PENDING" },
    { key: "DONE", label: "Done", state: "PENDING" },
  ];

  const set = (key: string, state: StepState) => {
    const idx = base.findIndex((s) => s.key === key);
    if (idx >= 0) base[idx].state = state;
  };

  // default: pending
  if (status === "UPLOADED") {
    set("UPLOADED", "CURRENT");
    return base;
  }

  if (status === "ACTION_REQUIRED") {
    set("UPLOADED", "DONE");
    set("PDF", "CURRENT");
    return base;
  }

  if (status === "QUEUED" || status === "CONVERTING") {
    set("UPLOADED", "DONE");
    set("PDF", "CURRENT");
    return base;
  }

  if (status === "PDF_READY") {
    set("UPLOADED", "DONE");
    set("PDF", "DONE");
    set("TEXT", "CURRENT");
    return base;
  }

  if (status === "EXTRACTING_TEXT") {
    set("UPLOADED", "DONE");
    set("PDF", "DONE");
    set("TEXT", "CURRENT");
    return base;
  }

  if (status === "CHUNKING") {
    set("UPLOADED", "DONE");
    set("PDF", "DONE");
    set("TEXT", "DONE");
    set("CHUNKING", "CURRENT");
    return base;
  }

  if (status === "DONE") {
    base.forEach((s) => (s.state = "DONE"));
    return base;
  }

  if (status === "FAILED") {
    // everything up to current pipeline is marked as FAILED
    base.forEach((s) => (s.state = "FAILED"));
    return base;
  }

  return base;
}

function TimelineMarker({ state, isLast }: { state: StepState; isLast: boolean }) {
  const color =
    state === "DONE"
      ? "#2e7d32"
      : state === "CURRENT"
      ? "#1565c0"
      : state === "FAILED"
      ? "#c62828"
      : "#bdbdbd";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          background: state === "DONE" ? color : "#fff",
        }}
      />
      {!isLast && (
        <div
          style={{
            width: 2,
            flex: 1,
            background: "#e0e0e0",
            margin: "2px 0 2px",
          }}
        />
      )}
    </div>
  );
}

function TimelineRow({ step }: { step: Step }) {
  const { label, state } = step;
  const color =
    state === "DONE"
      ? "#2e7d32"
      : state === "CURRENT"
      ? "#1565c0"
      : state === "FAILED"
      ? "#c62828"
      : "#757575";
  const pillBg =
    state === "DONE"
      ? "#e8f5e9"
      : state === "CURRENT"
      ? "#e3f2fd"
      : state === "FAILED"
      ? "#ffebee"
      : "#eeeeee";

  return (
    <div style={{ padding: "2px 0 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color }}>{label}</span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 999,
            background: pillBg,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color,
          }}
        >
          {state.toLowerCase()}
        </span>
      </div>
    </div>
  );
}

