import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/jyo/runtime-executions/route";
import { GET as GET_BY_ID } from "@/app/api/jyo/runtime-executions/[executionId]/route";
import { POST as POST_APPROVE } from "@/app/api/jyo/runtime-executions/[executionId]/approve/route";
import { POST as POST_MOCK_RUN } from "@/app/api/jyo/runtime-executions/[executionId]/mock-run/route";
import { runtimeExecutionApiMvpStore } from "@/lib/agents/runtimeExecutionApiMvpStore";

describe("runtime execution API MVP routes", () => {
  beforeEach(() => {
    runtimeExecutionApiMvpStore.resetForTest();
  });

  it("invalid JSON uses boundary builder via error helper", async () => {
    const request = new NextRequest("http://localhost/api/jyo/runtime-executions", {
      method: "POST",
      body: "not-json",
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.boundary.inMemoryOnly).toBe(true);
    expect(body.boundary.actualDbWriteAllowed).toBe(false);
    expect(body.error?.code).toBe("invalid_json");
  });

  it("POST /runtime-executions returns create response shape", async () => {
    const request = new NextRequest("http://localhost/api/jyo/runtime-executions", {
      method: "POST",
      body: JSON.stringify({
        projectId: "jy-orchestration",
        commandPreview: "route-cmd",
        payloadPreview: "route-payload",
        requestedBy: "operator",
      }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.action).toBe("create");
    expect(body.boundary.actualDbWriteAllowed).toBe(false);
    expect(body.data?.executionId).toBeDefined();
  });

  it("GET /runtime-executions returns list response shape", async () => {
    const createRequest = new NextRequest("http://localhost/api/jyo/runtime-executions", {
      method: "POST",
      body: JSON.stringify({
        projectId: "p1",
        commandPreview: "cmd",
        payloadPreview: "pl",
        requestedBy: "operator",
      }),
    });
    await POST(createRequest);

    const listResponse = await GET();
    const body = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.action).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
  });

  it("GET /runtime-executions/:id returns not found response shape", async () => {
    const response = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ executionId: "exec-missing" }),
    });
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.action).toBe("get");
    expect(body.error?.code).toBe("execution_not_found");
  });

  it("POST /approve returns boundary no-run flags", async () => {
    const createRequest = new NextRequest("http://localhost/api/jyo/runtime-executions", {
      method: "POST",
      body: JSON.stringify({
        projectId: "p1",
        commandPreview: "cmd",
        payloadPreview: "pl",
        requestedBy: "operator",
      }),
    });
    const created = await (await POST(createRequest)).json();
    const executionId = created.data.executionId as string;

    const approveResponse = await POST_APPROVE(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ executionId }),
    });
    const body = await approveResponse.json();
    expect(approveResponse.status).toBe(200);
    expect(body.boundary.actualExternalExecutionAllowed).toBe(false);
    expect(body.boundary.actualCursorGithubCallAllowed).toBe(false);
    expect(body.boundary.actualDbWriteAllowed).toBe(false);
  });

  it("POST /mock-run returns boundary no-run flags", async () => {
    const createRequest = new NextRequest("http://localhost/api/jyo/runtime-executions", {
      method: "POST",
      body: JSON.stringify({
        projectId: "p1",
        commandPreview: "cmd",
        payloadPreview: "pl",
        requestedBy: "operator",
      }),
    });
    const created = await (await POST(createRequest)).json();
    const executionId = created.data.executionId as string;

    await POST_APPROVE(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ executionId }),
    });

    const mockResponse = await POST_MOCK_RUN(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ executionId }),
    });
    const body = await mockResponse.json();
    expect(mockResponse.status).toBe(200);
    expect(body.boundary.inMemoryOnly).toBe(true);
    expect(body.boundary.actualExternalExecutionAllowed).toBe(false);
    expect(body.data?.statusAfter).toBe("mock_completed");
  });
});
