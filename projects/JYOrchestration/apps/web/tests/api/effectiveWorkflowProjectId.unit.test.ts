import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isPlatformGlobalMessengerRailPath,
  resolveEffectiveWorkflowProjectId,
} from "@/lib/layout/effectiveWorkflowProjectId";
import { APP_FLOW_LAST_PROJECT_KEY } from "@/lib/workflow/flow-state";

describe("effectiveWorkflowProjectId", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    } as Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(mem)) delete mem[k];
  });

  it("isPlatformGlobalMessengerRailPath covers platform messenger rail routes", () => {
    expect(isPlatformGlobalMessengerRailPath("/")).toBe(true);
    expect(isPlatformGlobalMessengerRailPath("/knowledge-packs")).toBe(true);
    expect(isPlatformGlobalMessengerRailPath("/notifications")).toBe(true);
    expect(isPlatformGlobalMessengerRailPath("/account")).toBe(true);
    expect(isPlatformGlobalMessengerRailPath("/settings/ai-members")).toBe(true);
    expect(isPlatformGlobalMessengerRailPath("/requirements")).toBe(false);
  });

  it("resolveEffectiveWorkflowProjectId does not use last-project fallback on knowledge-packs", () => {
    globalThis.sessionStorage.setItem(APP_FLOW_LAST_PROJECT_KEY, "proj-from-session");
    expect(resolveEffectiveWorkflowProjectId("/knowledge-packs", new URLSearchParams())).toBeNull();
    expect(resolveEffectiveWorkflowProjectId("/notifications", new URLSearchParams())).toBeNull();
  });

  it("resolveEffectiveWorkflowProjectId still uses last-project fallback on requirements without query", () => {
    globalThis.sessionStorage.setItem(APP_FLOW_LAST_PROJECT_KEY, "proj-from-session");
    expect(resolveEffectiveWorkflowProjectId("/requirements", new URLSearchParams())).toBe("proj-from-session");
  });
});
