#!/usr/bin/env node
/**
 * Absolute-path MCP stdio launcher for Cursor on Windows.
 *
 * Cursor may spawn MCP servers without honoring `cwd` in mcp.json
 * (observed: process starts under %USERPROFILE%). This launcher
 * resolves the JYKStore project root from its own path, chdirs there,
 * and starts mcp-server/server.ts via the local tsx CLI.
 *
 * Usage (mcp.json):
 *   "command": "node"
 *   "args": ["C:/project/JY-Studio/projects/JYKStore/scripts/mcp-stdio-launcher.mjs"]
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const serverEntry = path.join(root, "mcp-server", "server.ts");

const extraArgs = process.argv.slice(2).filter((a) => a !== "--");
const hasTransport = extraArgs.some((a) => a === "--transport" || a.startsWith("--transport="));
const args = [tsxCli, serverEntry, ...(hasTransport ? [] : ["--transport", "stdio"]), ...extraArgs];

const child = spawn(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`[jykstore-mcp-launcher] failed to spawn: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
