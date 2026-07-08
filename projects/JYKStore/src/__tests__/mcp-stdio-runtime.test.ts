import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXPECTED_MCP_TOOL_NAMES } from "./helpers/mcp-runtime-test-utils.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function stdioSmokeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  env.JYKSTORE_BASE_URL = "http://localhost:3004";
  env.JYKSTORE_API_KEY = "test-key-stdio-smoke";
  env.JYKSTORE_MCP_TRANSPORT = "stdio";
  return env;
}

describe("mcp stdio runtime smoke", () => {
  it(
    "starts stdio transport and lists tools",
    { timeout: 20_000 },
    async () => {
      const client = new Client({ name: "jykstore-stdio-smoke", version: "0.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [
          "--import",
          "tsx",
          path.join(projectRoot, "mcp-server", "server.ts"),
          "--transport",
          "stdio",
        ],
        cwd: projectRoot,
        env: stdioSmokeEnv(),
        stderr: "pipe",
      });

      try {
        await client.connect(transport);
        const listed = await client.listTools();
        const names = listed.tools.map((tool) => tool.name).sort();
        assert.deepEqual(names, [...EXPECTED_MCP_TOOL_NAMES].sort());
        assert.ok(!JSON.stringify(listed).includes("test-key-stdio-smoke"));
      } finally {
        await client.close().catch(() => undefined);
        await transport.close().catch(() => undefined);
      }
    },
  );

  it(
    "spawns stdio process and cleans up without hanging",
    { timeout: 15_000 },
    async () => {
      const child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          path.join(projectRoot, "mcp-server", "server.ts"),
          "--transport",
          "stdio",
        ],
        {
          cwd: projectRoot,
          env: stdioSmokeEnv(),
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("stdio process start timeout")), 8_000);
          child.stderr?.on("data", (chunk: Buffer) => {
            const text = chunk.toString("utf8");
            if (text.includes("starting transport=stdio") || text.includes("jykstore-mcp")) {
              clearTimeout(timer);
              resolve();
            }
          });
          child.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`stdio process exited early with code ${code}`));
          });
        });
      } finally {
        if (!child.killed) {
          child.kill("SIGTERM");
        }
        await new Promise<void>((resolve) => {
          const force = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 3_000);
          child.once("exit", () => {
            clearTimeout(force);
            resolve();
          });
        });
      }
    },
  );
});
