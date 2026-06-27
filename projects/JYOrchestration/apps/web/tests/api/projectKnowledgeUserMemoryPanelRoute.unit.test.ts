import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const loadPanelMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryPanelService", () => ({
  loadUserProjectKnowledgeMemoryPanel: (...args: unknown[]) => loadPanelMock(...args),
}));

import { GET } from "@/app/api/project-knowledge/user-memory-panel/route";

describe("projectKnowledgeUserMemoryPanelRoute", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    loadPanelMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    loadPanelMock.mockResolvedValue({
      control: {
        version: "user_project_knowledge_memory_control_v1",
        enabled: true,
        excludedSourceProjectIds: [],
        ignoredMemoryItemIds: [],
        pinnedMemoryItemIds: [],
      },
      preview: {
        enabled: true,
        sourceProjectCount: 1,
        totalItemCount: 1,
        byAgent: {
          planner: { enabled: true, itemCount: 1, items: [{ actionId: "opaque-1", title: "T" }] },
        },
      },
      usageSummary: {
        totalEvents: 1,
        injectedEvents: 1,
        skippedEvents: 0,
        byAgent: {
          planner: { injectedCount: 1, lastItemCount: 1 },
          analyst: { injectedCount: 0, lastItemCount: 0 },
          developer: { injectedCount: 0, lastItemCount: 0 },
          reviewer: { injectedCount: 0, lastItemCount: 0 },
          security: { injectedCount: 0, lastItemCount: 0 },
        },
        recentEvents: [
          {
            at: "2026-06-03T00:00:00.000Z",
            surface: "codetask_prompt",
            agent: "developer",
            outcome: "injected",
            itemCount: 1,
            sourceProjectCount: 1,
            controlEnabled: true,
            agentEnabled: true,
          },
        ],
      },
    });
  });

  it("returns 400 without projectId", async () => {
    const res = await GET(new NextRequest("http://localhost/api/project-knowledge/user-memory-panel"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-panel?projectId=p1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without permission", async () => {
    permissionMock.mockRejectedValue(new ProjectAccessDeniedError("denied"));
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-panel?projectId=p1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns control preview and usageSummary", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-panel?projectId=p1"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      control: unknown;
      preview: unknown;
      usageSummary: { injectedEvents: number };
    };
    expect(json.success).toBe(true);
    expect(json.control).toBeTruthy();
    expect(json.preview).toBeTruthy();
    expect(json.usageSummary.injectedEvents).toBe(1);
  });

  it("does not expose raw preview or usage internal execution ids", async () => {
    loadPanelMock.mockResolvedValueOnce({
      control: {
        version: "user_project_knowledge_memory_control_v1",
        enabled: true,
        excludedSourceProjectIds: [],
        ignoredMemoryItemIds: [],
        pinnedMemoryItemIds: [],
      },
      preview: {
        enabled: true,
        sourceProjectCount: 0,
        totalItemCount: 0,
        byAgent: {
          planner: {
            enabled: true,
            itemCount: 1,
            items: [
              {
                actionId: "opaque-action-only",
                title: "Title",
                promptSummary: "Summary",
                useAs: "context",
                relevance: 0.5,
                lifecycle: "AUTO_CAPTURED",
                pinned: false,
                ignored: false,
                agent: "planner",
                nodeType: "Feature",
                sourceProjectTitle: "Prev",
              },
            ],
          },
        },
      },
      usageSummary: {
        totalEvents: 1,
        injectedEvents: 1,
        skippedEvents: 0,
        byAgent: {
          planner: { injectedCount: 1, lastItemCount: 1 },
          analyst: { injectedCount: 0, lastItemCount: 0 },
          developer: { injectedCount: 0, lastItemCount: 0 },
          reviewer: { injectedCount: 0, lastItemCount: 0 },
          security: { injectedCount: 0, lastItemCount: 0 },
        },
        recentEvents: [
          {
            at: "2026-06-03T00:00:00.000Z",
            surface: "single_chat",
            agent: "planner",
            outcome: "injected",
            itemCount: 1,
            sourceProjectCount: 1,
            controlEnabled: true,
            agentEnabled: true,
          },
        ],
      },
    });
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-panel?projectId=p1"),
    );
    const text = await res.text();
    expect(text).not.toContain("sourceProjectId");
    expect(text).not.toContain("sourceNodeId");
    expect(text).not.toContain("promptTimelineEntryId");
    expect(text).not.toContain("codeTaskId");
    expect(text).not.toContain("promptSectionHash");
    expect(text).toContain("opaque-action-only");
  });
});
