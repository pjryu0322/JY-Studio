import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGitHubSourceTitle,
  inferSourceFormat,
} from "@/lib/github-auto-collect/github-source-mapping";

describe("github source mapping", () => {
  it("infers source formats from path and class", () => {
    assert.equal(inferSourceFormat("README.md", "README"), "MARKDOWN");
    assert.equal(inferSourceFormat("docs/openapi.yaml", "API_DOC"), "OPENAPI_YAML");
    assert.equal(inferSourceFormat("openapi.json", "API_DOC"), "OPENAPI_JSON");
    assert.equal(inferSourceFormat("package.json", "PACKAGE_MANIFEST"), "JSON");
    assert.equal(inferSourceFormat("application.yml", "CONFIG"), "YAML");
    assert.equal(inferSourceFormat("examples/basic.ts", "EXAMPLE"), "CODE");
  });

  it("builds github source titles", () => {
    assert.equal(buildGitHubSourceTitle("README.md", "README"), "README");
    assert.equal(buildGitHubSourceTitle("docs/getting-started.md", "GETTING_STARTED"), "docs/getting-started");
  });
});
