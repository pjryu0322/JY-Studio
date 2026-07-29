/**
 * Pure tooltip open-state machine for hover / focus / tap.
 * Used by UiTooltip and unit-tested without a DOM harness.
 */

export type TooltipReason = "hover" | "focus" | "tap";

export type TooltipState = {
  open: boolean;
  reason: TooltipReason | null;
};

export type TooltipEvent =
  | { type: "hover-enter" }
  | { type: "hover-leave" }
  | { type: "focus" }
  | { type: "blur" }
  | { type: "tap" }
  | { type: "dismiss" };

export function createTooltipState(): TooltipState {
  return { open: false, reason: null };
}

export function applyTooltipEvent(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (event.type) {
    case "hover-enter":
      if (state.reason === "tap") return state;
      return { open: true, reason: "hover" };
    case "hover-leave":
      if (state.reason === "tap" || state.reason === "focus") return state;
      return { open: false, reason: null };
    case "focus":
      if (state.reason === "tap") return state;
      return { open: true, reason: "focus" };
    case "blur":
      if (state.reason === "tap") return state;
      return { open: false, reason: null };
    case "tap":
      if (state.open && state.reason === "tap") {
        return { open: false, reason: null };
      }
      return { open: true, reason: "tap" };
    case "dismiss":
      return { open: false, reason: null };
    default:
      return state;
  }
}
