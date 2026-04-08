/**
 * Deterministic mock: feature-type-aware task drafts (rule-based classification, no ML).
 * Maps each feature to a strategy pipeline; taskType stays design | backend | frontend | integration | validation.
 */

import type {
  CollaborationOfficialTaskDraft,
  CollaborationTaskDraftStatus,
  CollaborationTaskDraftType,
} from "@/lib/workflow/collaborationActionContract";
import type { FeatureMock } from "@/lib/mock/workflowMock";

/** Lightweight feature buckets for generation strategies only (not persisted on FeatureMock). */
export type FeatureClassification =
  | "UI_FEATURE"
  | "API_FEATURE"
  | "DATA_FEATURE"
  | "INTEGRATION_FEATURE"
  | "SYSTEM_FEATURE";

type StepCtx = { short: string; fullName: string; hint: string; longDesc: string };

type PipelineStep = {
  taskType: CollaborationTaskDraftType;
  title: (ctx: StepCtx) => string;
  description: (ctx: StepCtx) => string;
  status: CollaborationTaskDraftStatus;
};

const PLACEHOLDER_FEATURE: FeatureMock = {
  id: "unassigned",
  name: "(no official feature yet)",
  description: "Run Feature 생성 in this session so tasks can align to real feature scope.",
  status: "DRAFT",
  userFlow: [],
  nonFunctional: [],
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAnyWord(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(lower));
}

function featureTextBlob(f: FeatureMock): string {
  return [f.name, f.description, ...f.userFlow, ...f.nonFunctional].join(" ");
}

/**
 * Rule-based classification from name, description, flows, and NFR hints.
 */
export function classifyFeatureForTasks(f: FeatureMock): FeatureClassification {
  if (f.id === PLACEHOLDER_FEATURE.id) return "SYSTEM_FEATURE";
  const t = featureTextBlob(f);

  if (
    matchesAnyWord(t, [
      "integration",
      "webhook",
      "third-party",
      "third party",
      "external",
      "oauth",
      "vendor",
      "sync",
      "bridge",
      "handoff",
      "continuity",
      "partner",
    ])
  ) {
    return "INTEGRATION_FEATURE";
  }
  if (
    matchesAnyWord(t, [
      "schema",
      "database",
      "sql",
      "persistence",
      "etl",
      "migration",
      "warehouse",
      "data lake",
      "ingest",
      "pipeline",
    ])
  ) {
    return "DATA_FEATURE";
  }
  if (
    matchesAnyWord(t, [
      "rest",
      "graphql",
      "openapi",
      "endpoint",
      "api",
      "microservice",
      "http",
      "rpc",
    ])
  ) {
    return "API_FEATURE";
  }
  if (
    matchesAnyWord(t, [
      "config",
      "logging",
      "monitor",
      "observability",
      "environment",
      "deployment",
      "slo",
      "alert",
      "metric",
      "trace",
      "dashboard",
    ])
  ) {
    return "SYSTEM_FEATURE";
  }
  if (
    matchesAnyWord(t, [
      "ui",
      "ux",
      "screen",
      "page",
      "layout",
      "component",
      "form",
      "modal",
      "dashboard",
      "panel",
      "checklist",
      "navigable",
      "tab",
      "workflow",
      "skeleton",
    ])
  ) {
    return "UI_FEATURE";
  }
  return "UI_FEATURE";
}

function hashFeatureId(featureId: string): number {
  let h = 0;
  for (let i = 0; i < featureId.length; i++) {
    h = (h * 31 + featureId.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Per feature: 3–7 tasks, deterministic from id. */
function taskCountForFeature(featureId: string): number {
  return 3 + (hashFeatureId(featureId) % 5);
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function hintFromFeature(f: FeatureMock): string {
  const flow = f.userFlow[0];
  if (flow) return truncate(flow, 72);
  return truncate(f.description, 72);
}

function pickFirstSteps(full: PipelineStep[], count: number): PipelineStep[] {
  const n = Math.min(full.length, Math.max(3, Math.min(7, count)));
  return full.slice(0, n);
}

function formatDependency(
  prev: { title: string; taskType: CollaborationTaskDraftType },
  currentType: CollaborationTaskDraftType,
  short: string
): string {
  const prevShort = truncate(prev.title, 44);
  if (currentType === "backend" && prev.taskType === "design") {
    return `After design for «${short}»: ${prevShort}`;
  }
  if (currentType === "frontend" && prev.taskType === "design") {
    return `After design for «${short}»: ${prevShort}`;
  }
  if (currentType === "integration" && (prev.taskType === "backend" || prev.taskType === "frontend")) {
    return `Integrate after ${prev.taskType} work on «${short}» (${prevShort})`;
  }
  if (currentType === "validation" && prev.taskType === "integration") {
    return `After integration for «${short}»: ${prevShort}`;
  }
  if (currentType === "validation" && (prev.taskType === "backend" || prev.taskType === "frontend")) {
    return `Validate «${short}» after ${prev.taskType} (${prevShort})`;
  }
  return `Depends on: ${truncate(prev.title, 56)}`;
}

/* ─── Strategy pipelines (ordered: design → build → integrate → validate) ─── */

const UI_STRATEGY: PipelineStep[] = [
  {
    taskType: "design",
    title: ({ short }) => `Define UX states for «${short}»`,
    description: ({ fullName, hint }) =>
      `List screens, empty/loading/error states, and success criteria for ${fullName}. Ground in: ${hint}.`,
    status: "DRAFT",
  },
  {
    taskType: "design",
    title: ({ short }) => `Specify components for «${short}»`,
    description: ({ fullName }) =>
      `Break ${fullName} into reusable UI pieces, props, and accessibility expectations before coding.`,
    status: "DRAFT",
  },
  {
    taskType: "frontend",
    title: ({ short }) => `Implement UI components for «${short}»`,
    description: ({ fullName }) =>
      `Build presentational pieces for ${fullName} from the spec; keep props stable for state wiring next.`,
    status: "DRAFT",
  },
  {
    taskType: "frontend",
    title: ({ short }) => `Add state and interactions for «${short}»`,
    description: ({ fullName }) =>
      `Wire client state, events, and transitions for ${fullName} (forms, toggles, optimistic UI where needed).`,
    status: "READY",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Connect UI to services for «${short}»`,
    description: ({ fullName }) =>
      `Hook ${fullName} to real APIs or stores; align loading and error surfaces with backend contracts.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Harden UX edge cases for «${short}»`,
    description: ({ fullName }) =>
      `Exercise validation, permissions, and slow-network paths for ${fullName} before wider QA.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `End-to-end check for «${short}»`,
    description: ({ fullName, hint }) =>
      `Walk primary flows for ${fullName} using realistic data (${hint}). File gaps as follow-ups.`,
    status: "READY",
  },
];

const API_STRATEGY: PipelineStep[] = [
  {
    taskType: "design",
    title: ({ short }) => `Draft API contract for «${short}»`,
    description: ({ fullName, hint }) =>
      `Define resources, methods, payloads, and versioning notes for ${fullName}. Anchor with: ${hint}.`,
    status: "DRAFT",
  },
  {
    taskType: "design",
    title: ({ short }) => `Define errors and auth for «${short}»`,
    description: ({ fullName }) =>
      `Specify status codes, error envelopes, and authz rules so clients of ${fullName} fail predictably.`,
    status: "DRAFT",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Implement endpoints for «${short}»`,
    description: ({ fullName }) =>
      `Code handlers and persistence touches for ${fullName}; keep handlers thin and testable.`,
    status: "DRAFT",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Add middleware and guards for «${short}»`,
    description: ({ fullName }) =>
      `Layer authn/z, rate limits, and input parsing around ${fullName} routes.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Contract-test requests for «${short}»`,
    description: ({ fullName }) =>
      `Automate happy-path and rejection cases for ${fullName} request/response shapes.`,
    status: "READY",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Integrate downstream calls for «${short}»`,
    description: ({ fullName }) =>
      `Call other services or queues from ${fullName} with timeouts, mapping, and structured errors.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Stress failures for «${short}»`,
    description: ({ fullName }) =>
      `Inject latency and dependency faults for ${fullName}; verify retries/circuit behavior where designed.`,
    status: "READY",
  },
];

const DATA_STRATEGY: PipelineStep[] = [
  {
    taskType: "design",
    title: ({ short }) => `Model schema for «${short}»`,
    description: ({ fullName, hint }) =>
      `Capture entities, keys, and invariants for ${fullName}. Use: ${hint} as intake context.`,
    status: "DRAFT",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Implement transforms for «${short}»`,
    description: ({ fullName }) =>
      `Build pure processing steps for ${fullName} (validation, normalization, enrichment).`,
    status: "DRAFT",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Persist and retrieve for «${short}»`,
    description: ({ fullName }) =>
      `Wire storage adapters and migrations needed so ${fullName} data lands and reads back correctly.`,
    status: "READY",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Orchestrate jobs for «${short}»`,
    description: ({ fullName }) =>
      `Schedule batch/stream steps for ${fullName} with idempotency and checkpointing.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Data quality checks for «${short}»`,
    description: ({ fullName }) =>
      `Add assertions and monitors on ${fullName} outputs (null rates, duplicates, drift).`,
    status: "READY",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Backfill path for «${short}»`,
    description: ({ fullName }) =>
      `Plan and execute safe backfill or cutover for ${fullName} with rollback notes.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Reconcile «${short}» outputs`,
    description: ({ fullName }) =>
      `Compare ${fullName} against source-of-truth samples; document mismatches and owners.`,
    status: "READY",
  },
];

const INTEGRATION_STRATEGY: PipelineStep[] = [
  {
    taskType: "design",
    title: ({ short }) => `Map external interface for «${short}»`,
    description: ({ fullName, hint }) =>
      `Document payloads, auth modes, and SLAs for ${fullName}. Context: ${hint}.`,
    status: "DRAFT",
  },
  {
    taskType: "design",
    title: ({ short }) => `Retry and idempotency plan for «${short}»`,
    description: ({ fullName }) =>
      `Define backoff, dedupe keys, and poison handling before coding ${fullName} connectors.`,
    status: "DRAFT",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Build connector for «${short}»`,
    description: ({ fullName }) =>
      `Implement send/receive paths for ${fullName} with structured logging on every hop.`,
    status: "DRAFT",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Harden retries for «${short}»`,
    description: ({ fullName }) =>
      `Add idempotent writes and safe replays for ${fullName} under vendor instability.`,
    status: "READY",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Secrets and tokens for «${short}»`,
    description: ({ fullName }) =>
      `Store and rotate credentials used by ${fullName}; avoid leaking secrets into logs.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Sandbox-test «${short}»`,
    description: ({ fullName }) =>
      `Run vendor stub or lower env tests for ${fullName}; capture fixtures for regression.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Cutover checklist for «${short}»`,
    description: ({ fullName }) =>
      `Verify monitoring, on-call steps, and rollback for ${fullName} before production traffic.`,
    status: "READY",
  },
];

const SYSTEM_STRATEGY: PipelineStep[] = [
  {
    taskType: "design",
    title: ({ short }) => `Define config matrix for «${short}»`,
    description: ({ fullName, hint }) =>
      `List tunables, defaults, and SLO targets for ${fullName}. Tie to: ${hint}.`,
    status: "DRAFT",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Implement config loading for «${short}»`,
    description: ({ fullName }) =>
      `Parse, validate, and hot-reload safe settings for ${fullName} across environments.`,
    status: "DRAFT",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Wire environments for «${short}»`,
    description: ({ fullName }) =>
      `Map env vars, feature flags, and deployment slots needed to run ${fullName} reliably.`,
    status: "READY",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Export telemetry for «${short}»`,
    description: ({ fullName }) =>
      `Emit metrics, logs, and traces for ${fullName} with correlation IDs end to end.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Alerts for «${short}»`,
    description: ({ fullName }) =>
      `Create dashboards and paging rules that prove ${fullName} health in prod-like data.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Drill failures for «${short}»`,
    description: ({ fullName }) =>
      `Run tabletop or injected faults for ${fullName}; document rollback and owner actions.`,
    status: "READY",
  },
  {
    taskType: "design",
    title: ({ short }) => `Handoff docs for «${short}»`,
    description: ({ fullName }) =>
      `Publish runbooks and config references so operators can support ${fullName} without code spelunking.`,
    status: "READY",
  },
];

const STRATEGIES: Record<FeatureClassification, PipelineStep[]> = {
  UI_FEATURE: UI_STRATEGY,
  API_FEATURE: API_STRATEGY,
  DATA_FEATURE: DATA_STRATEGY,
  INTEGRATION_FEATURE: INTEGRATION_STRATEGY,
  SYSTEM_FEATURE: SYSTEM_STRATEGY,
};

const PLACEHOLDER_STEPS: PipelineStep[] = [
  {
    taskType: "design",
    title: (_ctx) => "Clarify scope before tasks",
    description: ({ fullName }) =>
      `List the official features you need; ${fullName} is a placeholder until Feature 생성 runs.`,
    status: "DRAFT",
  },
  {
    taskType: "backend",
    title: (_ctx) => "Stub data contracts",
    description: (_ctx) =>
      "Sketch entities and fields you will need so later tasks can attach to real feature names.",
    status: "DRAFT",
  },
  {
    taskType: "validation",
    title: (_ctx) => "Re-run task generation",
    description: (_ctx) =>
      "After features exist, run Task 초안 생성 again to replace this placeholder chain.",
    status: "READY",
  },
];

/**
 * Builds execution-ready-shaped drafts: type-specific pipelines, typed steps, readable deps.
 */
export function buildMockOfficialTaskDrafts(sessionId: string, features: FeatureMock[]): CollaborationOfficialTaskDraft[] {
  const list = features.length > 0 ? features : [PLACEHOLDER_FEATURE];

  const tasks: CollaborationOfficialTaskDraft[] = [];
  let order = 1;
  let previous: { title: string; taskType: CollaborationTaskDraftType } | null = null;

  for (const f of list) {
    const isPlaceholder = f.id === PLACEHOLDER_FEATURE.id;
    const short = truncate(f.name, 36);
    const fullName = truncate(f.name, 120);
    const longDesc = f.description?.trim() ?? "";
    const hint = isPlaceholder ? "Run Feature 생성, then regenerate tasks." : hintFromFeature(f);

    const ctxBase: StepCtx = {
      short,
      fullName,
      hint,
      longDesc: truncate(longDesc, 160),
    };

    const classification = classifyFeatureForTasks(f);
    const count = isPlaceholder ? 3 : taskCountForFeature(f.id);
    const steps = isPlaceholder ? PLACEHOLDER_STEPS : pickFirstSteps(STRATEGIES[classification], count);

    for (const step of steps) {
      const name = step.title(ctxBase);
      const description = step.description(ctxBase);

      tasks.push({
        id: `task-${sessionId}-${f.id}-${order}`,
        name,
        description,
        status: step.status,
        relatedFeatureId: f.id,
        relatedFeatureName: f.name,
        order,
        taskType: step.taskType,
        dependencyNote: previous ? formatDependency(previous, step.taskType, short) : undefined,
      });

      previous = { title: name, taskType: step.taskType };
      order += 1;
    }
  }

  return tasks;
}
