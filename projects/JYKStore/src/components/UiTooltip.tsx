"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyTooltipEvent,
  createTooltipState,
  type TooltipEvent,
  type TooltipState,
} from "@/lib/ui/tooltip-state";

/**
 * Accessible compact tooltip: hover, keyboard focus, and mobile tap.
 * Does not rely on native HTML `title`.
 */
export function UiTooltip({
  content,
  children,
  side = "top",
  className = "",
  enableTap = true,
}: {
  readonly content: string;
  readonly children: ReactNode;
  readonly side?: "top" | "bottom";
  readonly className?: string;
  /** Mobile tap toggle. Disable when wrapping primary action buttons. */
  readonly enableTap?: boolean;
}) {
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [state, setState] = useState<TooltipState>(() => createTooltipState());

  const dispatch = useCallback((event: TooltipEvent) => {
    setState((prev) => applyTooltipEvent(prev, event));
  }, []);

  useEffect(() => {
    if (!state.open || state.reason !== "tap") return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      dispatch({ type: "dismiss" });
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [state.open, state.reason, dispatch]);

  useEffect(() => {
    if (!state.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch({ type: "dismiss" });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state.open, dispatch]);

  if (!content.trim()) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex max-w-full ${className}`}
      onMouseEnter={() => dispatch({ type: "hover-enter" })}
      onMouseLeave={() => dispatch({ type: "hover-leave" })}
      onFocusCapture={() => dispatch({ type: "focus" })}
      onBlurCapture={(event) => {
        const root = rootRef.current;
        const next = event.relatedTarget;
        if (root && next instanceof Node && root.contains(next)) return;
        dispatch({ type: "blur" });
      }}
      onClick={(event) => {
        if (!enableTap) return;
        if (event.target instanceof Element) {
          const tip = rootRef.current?.querySelector('[role="tooltip"]');
          if (tip && tip.contains(event.target)) return;
        }
        dispatch({ type: "tap" });
      }}
    >
      <span aria-describedby={state.open ? tipId : undefined} className="inline-flex max-w-full">
        {children}
      </span>
      {state.open ? (
        <span
          id={tipId}
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-30 w-max max-w-[16rem] -translate-x-1/2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium leading-snug text-white shadow-sm ${
            side === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
