/**
 * Deterministic mock: turns official features into structured, ordered task drafts.
 * No AI — varies copy lightly from feature id/name/description for realism.
 */

import type {
  CollaborationOfficialTaskDraft,
  CollaborationTaskDraftStatus,
  CollaborationTaskDraftType,
} from "@/lib/workflow/collaborationActionContract";
import type { FeatureMock } from "@/lib/mock/workflowMock";

type PipelineStep = {
  taskType: CollaborationTaskDraftType;
  /** Build action-oriented title; keep short for sequence cards. */
  title: (ctx: { short: string; hint: string }) => string;
  /** One or two concrete sentences. */
  description: (ctx: { short: string; hint: string; longDesc: string }) => string;
  status: CollaborationTaskDraftStatus;
};

const PIPELINE: PipelineStep[] = [
  {
    taskType: "design",
    title: ({ short }) => `Define contracts and scope for «${short}»`,
    description: ({ short, hint }) =>
      `Document API/data boundaries and acceptance signals for ${short}. Anchor with: ${hint}.`,
    status: "DRAFT",
  },
  {
    taskType: "design",
    title: ({ short }) => `Map UX entry points for «${short}»`,
    description: ({ short, longDesc }) =>
      longDesc.length > 20
        ? `Turn the feature narrative into concrete screens, states, and empty/error paths for ${short}.`
        : `List user-visible steps and required states (loading, success, failure) before implementation for ${short}.`,
    status: "DRAFT",
  },
  {
    taskType: "backend",
    title: ({ short }) => `Implement core services for «${short}»`,
    description: ({ short }) =>
      `Add persistence, domain rules, and APIs that satisfy the contracts for ${short}. Keep response shapes stable for the UI.`,
    status: "DRAFT",
  },
  {
    taskType: "frontend",
    title: ({ short }) => `Build UI for «${short}»`,
    description: ({ short }) =>
      `Ship components and client flows for ${short}: loading, validation, and the primary happy path per contract.`,
    status: "READY",
  },
  {
    taskType: "integration",
    title: ({ short }) => `Wire UI and APIs for «${short}»`,
    description: ({ short }) =>
      `Connect the UI to live endpoints for ${short}; verify shapes, auth, and optimistic vs. confirmed states.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Harden «${short}» (validation + errors)`,
    description: ({ short }) =>
      `Cover edge inputs, auth failures, and user-visible errors for ${short} before broader testing.`,
    status: "READY",
  },
  {
    taskType: "validation",
    title: ({ short }) => `Verify «${short}» end-to-end`,
    description: ({ short, hint }) =>
      `Run realistic scenarios for ${short} (see: ${hint}). Log gaps as follow-ups.`,
    status: "READY",
  },
];

function hashFeatureId(featureId: string): number {
  let h = 0;
  for (let i = 0; i < featureId.length; i++) {
    h = (h * 31 + featureId.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Per feature: 3–7 tasks, deterministic from feature id. */
function taskCountForFeature(featureId: string): number {
  return 3 + (hashFeatureId(featureId) % 5);
}

function pickSteps(count: number): PipelineStep[] {
  const n = Math.min(7, Math.max(3, count));
  if (n === 7) return [...PIPELINE];
  if (n === 6) return [PIPELINE[0]!, PIPELINE[1]!, PIPELINE[2]!, PIPELINE[3]!, PIPELINE[4]!, PIPELINE[5]!];
  if (n === 5) return [PIPELINE[0]!, PIPELINE[2]!, PIPELINE[3]!, PIPELINE[4]!, PIPELINE[5]!];
  if (n === 4) return [PIPELINE[0]!, PIPELINE[2]!, PIPELINE[3]!, PIPELINE[4]!];
  return [PIPELINE[0]!, PIPELINE[2]!, PIPELINE[3]!];
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

const PLACEHOLDER_FEATURE: FeatureMock = {
  id: "unassigned",
  name: "(no official feature yet)",
  description: "Run Feature 생성 in this session so tasks can align to real feature scope.",
  status: "DRAFT",
  userFlow: [],
  nonFunctional: [],
};

/**
 * Builds execution-ready-shaped drafts: ordered, typed, concrete descriptions, simple deps.
 */
export function buildMockOfficialTaskDrafts(sessionId: string, features: FeatureMock[]): CollaborationOfficialTaskDraft[] {
  const list = features.length > 0 ? features : [PLACEHOLDER_FEATURE];

  const tasks: CollaborationOfficialTaskDraft[] = [];
  let order = 1;
  let previousTitle: string | null = null;

  for (const f of list) {
    const isPlaceholder = f.id === PLACEHOLDER_FEATURE.id;
    const short = truncate(f.name, 36);
    const longDesc = f.description?.trim() ?? "";
    const hint = isPlaceholder ? "Run Feature 생성, then regenerate tasks." : hintFromFeature(f);

    const steps = pickSteps(isPlaceholder ? 3 : taskCountForFeature(f.id));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const ctx = { short, hint };
      const name = step.title(ctx);
      const description = step.description({ ...ctx, longDesc: truncate(longDesc, 160) });

      tasks.push({
        id: `task-${sessionId}-${f.id}-${order}`,
        name,
        description,
        status: step.status,
        relatedFeatureId: f.id,
        relatedFeatureName: f.name,
        order,
        taskType: step.taskType,
        dependencyNote: previousTitle ? `Depends on: ${truncate(previousTitle, 56)}` : undefined,
      });

      previousTitle = name;
      order += 1;
    }
  }

  return tasks;
}
