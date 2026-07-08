import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPackAllowed,
  loadMcpServerConfigFromRecord,
  maskApiKey,
  parseAllowedOrigins,
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
    assert.equal(config.maxResponseBytes, 2_000_000);
    assert.equal(config.maxExportSourceBytes, 20_000_000);
    assert.deepEqual(config.allowedOrigins, []);
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

  it("parses allowed origins", () => {
    assert.deepEqual(parseAllowedOrigins("https://a.test, https://b.test"), [
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("parses max response and export source byte limits", () => {
    const config = loadMcpServerConfigFromRecord({
      JYKSTORE_BASE_URL: "http://localhost:3004",
      JYKSTORE_API_KEY: "test-key-12345678",
      JYKSTORE_MCP_MAX_RESPONSE_BYTES: "500000",
      JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES: "5000000",
      JYKSTORE_MCP_ALLOWED_ORIGINS: "https://app.example",
    });
    assert.equal(config.maxResponseBytes, 500_000);
    assert.equal(config.maxExportSourceBytes, 5_000_000);
    assert.deepEqual(config.allowedOrigins, ["https://app.example"]);
  });

  it("rejects maxExportSourceBytes below maxResponseBytes", () => {
    assert.throws(
      () =>
        loadMcpServerConfigFromRecord({
          JYKSTORE_BASE_URL: "http://localhost:3004",
          JYKSTORE_API_KEY: "test-key-12345678",
          JYKSTORE_MCP_MAX_RESPONSE_BYTES: "2000000",
          JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES: "1000000",
        }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
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
