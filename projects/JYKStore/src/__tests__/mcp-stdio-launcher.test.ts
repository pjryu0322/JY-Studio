import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { EXPECTED_MCP_TOOL_NAMES } from "./helpers/mcp-runtime-test-utils.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const launcherPath = path.join(projectRoot, "scripts", "mcp-stdio-launcher.mjs");

function launcherEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  env.JYKSTORE_BASE_URL = "http://127.0.0.1:3004";
  env.JYKSTORE_API_KEY = "test-key-launcher-smoke";
  env.JYKSTORE_MCP_TRANSPORT = "stdio";
  return env;
}

function parseJsonRpcLines(stdout: string): unknown[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`stdout JSON-RPC pollution: ${line.slice(0, 160)}`);
      }
    });
}

async function waitForLauncherReady(
  child: ReturnType<typeof spawn>,
  getStderr: () => string,
  label: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), 15_000);
    const onData = () => {
      const stderr = getStderr();
      if (stderr.includes("starting transport=stdio") || stderr.includes("jykstore-mcp")) {
        cleanup();
        resolve();
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`${label} exited early code=${code}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stderr?.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    child.stderr?.on("data", onData);
    child.on("error", onError);
    child.on("exit", onExit);
    onData();
  });
}

async function listToolsViaLauncher(cwd: string): Promise<string[]> {
  const child = spawn(process.execPath, [launcherPath], {
    cwd,
    env: launcherEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (buf: Buffer) => {
    stdout += buf.toString("utf8");
  });
  child.stderr.on("data", (buf: Buffer) => {
    stderr += buf.toString("utf8");
  });

  try {
    await waitForLauncherReady(child, () => stderr, `launcher cwd=${cwd}`);
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "launcher-cwd-test", version: "0.0.0" },
        },
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`,
    );
    await new Promise((r) => setTimeout(r, 2_500));

    const messages = parseJsonRpcLines(stdout);
    const initResult = messages.find(
      (m): m is { id: number; result: unknown } =>
        typeof m === "object" && m !== null && (m as { id?: number }).id === 1,
    );
    const toolsResult = messages.find(
      (m): m is { id: number; result: { tools: Array<{ name: string }> } } =>
        typeof m === "object" &&
        m !== null &&
        (m as { id?: number }).id === 2 &&
        Boolean((m as { result?: { tools?: unknown } }).result?.tools),
    );
    assert.ok(initResult?.result, "initialize must succeed");
    assert.ok(toolsResult?.result?.tools?.length, "tools/list must succeed");
    assert.ok(!stdout.includes("test-key-launcher-smoke"));
    return toolsResult!.result.tools.map((t) => t.name).sort();
  } finally {
    if (!child.killed) child.kill();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once("exit", () => resolve());
      setTimeout(resolve, 2_000);
    });
  }
}

describe("mcp stdio launcher (cwd-safe)", () => {
  it("resolves under project root without hard-coded machine paths", () => {
    assert.ok(path.isAbsolute(launcherPath));
    assert.equal(path.basename(launcherPath), "mcp-stdio-launcher.mjs");
    assert.ok(launcherPath.startsWith(projectRoot));
    const source = readFileSync(launcherPath, "utf8");
    assert.doesNotMatch(source, /C:\\\\project|C:\/project\/JY-Studio/);
  });

  it(
    "starts from tmpdir cwd and lists jykstore_retrieval_query",
    { timeout: 25_000 },
    async () => {
      const names = await listToolsViaLauncher(os.tmpdir());
      assert.deepEqual(names, [...EXPECTED_MCP_TOOL_NAMES].sort());
      assert.ok(names.includes("jykstore_retrieval_query"));
    },
  );

  it(
    "starts from homedir cwd (Cursor Windows spawn case)",
    { timeout: 25_000 },
    async () => {
      const names = await listToolsViaLauncher(os.homedir());
      assert.ok(names.includes("jykstore_retrieval_query"));
    },
  );
});
