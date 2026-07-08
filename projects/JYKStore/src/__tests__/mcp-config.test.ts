import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPackAllowed,
  loadMcpServerConfigFromRecord,
  maskApiKey,
  parseAllowedPackIds,
} from "../../mcp-server/config.ts";
import { McpBridgeError } from "../../mcp-server/errors.ts";

describe("mcp config", () => {
  it("requires baseUrl and apiKey", () => {
    assert.throws(
      () => loadMcpServerConfigFromRecord({}),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_CONFIG_MISSING",
    );
    assert.throws(
      () =>
        loadMcpServerConfigFromRecord({
          JYKSTORE_BASE_URL: "http://localhost:3004",
        }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_CONFIG_MISSING",
    );
  });

  it("defaults transport to stdio and port to 3014", () => {
    const config = loadMcpServerConfigFromRecord({
      JYKSTORE_BASE_URL: "http://localhost:3004/",
      JYKSTORE_API_KEY: "test-key-12345678",
    });
    assert.equal(config.baseUrl, "http://localhost:3004");
    assert.equal(config.transport, "stdio");
    assert.equal(config.port, 3014);
  });

  it("parses transport from argv", () => {
    const config = loadMcpServerConfigFromRecord(
      {
        JYKSTORE_BASE_URL: "http://localhost:3004",
        JYKSTORE_API_KEY: "test-key-12345678",
      },
      ["--transport", "http"],
    );
    assert.equal(config.transport, "http");
  });

  it("parses allowedPackIds", () => {
    assert.deepEqual(parseAllowedPackIds(""), []);
    assert.deepEqual(parseAllowedPackIds("a, b,a"), ["a", "b"]);
  });

  it("masks api keys", () => {
    assert.equal(maskApiKey("short"), "***");
    assert.match(maskApiKey("abcdefghijklmnop"), /^abcd…mnop$/);
  });

  it("blocks non-allowed pack ids when allowlist is set", () => {
    assert.throws(
      () => assertPackAllowed("pack-x", ["pack-a"]),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_PACK_NOT_ALLOWED",
    );
    assert.doesNotThrow(() => assertPackAllowed("pack-a", ["pack-a"]));
    assert.doesNotThrow(() => assertPackAllowed("pack-a", []));
  });
});
