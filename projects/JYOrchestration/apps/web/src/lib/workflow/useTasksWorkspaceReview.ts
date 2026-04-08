"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";

export type TaskReviewUiStatus = "draft" | "confirmed";

type State = {
  active: CollaborationOfficialTaskDraft[];
  removed: CollaborationOfficialTaskDraft[];
  reviewById: Record<string, TaskReviewUiStatus>;
};

function renumberOrders(list: CollaborationOfficialTaskDraft[]): CollaborationOfficialTaskDraft[] {
  return list.map((t, i) => ({ ...t, order: i + 1 }));
}

function sortByOrder(list: CollaborationOfficialTaskDraft[]): CollaborationOfficialTaskDraft[] {
  return [...list].sort((a, b) => a.order - b.order);
}

function bootstrapFromSource(source: CollaborationOfficialTaskDraft[]): State {
  return {
    active: renumberOrders(sortByOrder(source)),
    removed: [],
    reviewById: {},
  };
}

type Action =
  | { type: "reset"; source: CollaborationOfficialTaskDraft[] }
  | { type: "moveUp"; index: number }
  | { type: "moveDown"; index: number }
  | { type: "remove"; id: string }
  | { type: "restore"; id: string }
  | { type: "confirm"; id: string }
  | { type: "updateDep"; id: string; note: string }
  | { type: "addManual"; task: CollaborationOfficialTaskDraft };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return {
        active: renumberOrders(sortByOrder(action.source)),
        removed: [],
        reviewById: {},
      };
    case "moveUp": {
      const { index } = action;
      if (index <= 0) return state;
      const next = [...state.active];
      [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
      return { ...state, active: renumberOrders(next) };
    }
    case "moveDown": {
      const { index } = action;
      if (index >= state.active.length - 1) return state;
      const next = [...state.active];
      [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
      return { ...state, active: renumberOrders(next) };
    }
    case "remove": {
      const t = state.active.find((x) => x.id === action.id);
      if (!t) return state;
      const { [action.id]: _, ...restReview } = state.reviewById;
      return {
        reviewById: restReview,
        removed: [...state.removed, t],
        active: renumberOrders(state.active.filter((x) => x.id !== action.id)),
      };
    }
    case "restore": {
      const t = state.removed.find((x) => x.id === action.id);
      if (!t) return state;
      return {
        ...state,
        removed: state.removed.filter((x) => x.id !== action.id),
        active: renumberOrders([...state.active, t]),
      };
    }
    case "confirm":
      return {
        ...state,
        reviewById: { ...state.reviewById, [action.id]: "confirmed" },
      };
    case "updateDep": {
      const trimmed = action.note.trim();
      const patch = (x: CollaborationOfficialTaskDraft) =>
        x.id === action.id ? { ...x, dependencyNote: trimmed || undefined } : x;
      return {
        ...state,
        active: state.active.map(patch),
        removed: state.removed.map(patch),
      };
    }
    case "addManual":
      return {
        ...state,
        active: renumberOrders([...state.active, action.task]),
      };
    default:
      return state;
  }
}

/**
 * Local-only working set on /tasks: reorder, confirm/remove/restore, manual rows, dependency note tweaks.
 * Resets when the source task id list from generation changes.
 */
export function useTasksWorkspaceReview(sourceTasks: CollaborationOfficialTaskDraft[]) {
  const sourceSignature = useMemo(() => sourceTasks.map((t) => t.id).join("|"), [sourceTasks]);
  const [state, dispatch] = useReducer(reducer, sourceTasks, bootstrapFromSource);

  useEffect(() => {
    dispatch({ type: "reset", source: sourceTasks });
    // Intentionally depend only on sourceSignature so local review survives reference-only parent updates.
  }, [sourceSignature]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when generated task ids change

  const moveUp = useCallback((index: number) => {
    dispatch({ type: "moveUp", index });
  }, []);

  const moveDown = useCallback((index: number) => {
    dispatch({ type: "moveDown", index });
  }, []);

  const removeTask = useCallback((id: string) => {
    dispatch({ type: "remove", id });
  }, []);

  const restoreTask = useCallback((id: string) => {
    dispatch({ type: "restore", id });
  }, []);

  const confirmTask = useCallback((id: string) => {
    dispatch({ type: "confirm", id });
  }, []);

  const updateDependencyNote = useCallback((id: string, note: string) => {
    dispatch({ type: "updateDep", id, note });
  }, []);

  const addManualTask = useCallback((input: { name: string; description: string; relatedFeatureName: string }) => {
    const name = input.name.trim();
    const description = input.description.trim();
    if (!name || !description) return;
    const feature = input.relatedFeatureName.trim() || "(unspecified)";
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const task: CollaborationOfficialTaskDraft = {
      id,
      name,
      description,
      status: "DRAFT",
      relatedFeatureId: "manual",
      relatedFeatureName: feature,
      order: 0,
      taskType: "design",
    };
    dispatch({ type: "addManual", task });
  }, []);

  return {
    activeTasks: state.active,
    removedTasks: state.removed,
    reviewById: state.reviewById,
    moveUp,
    moveDown,
    removeTask,
    restoreTask,
    confirmTask,
    updateDependencyNote,
    addManualTask,
  };
}
