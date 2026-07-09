import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyGitHubFilePath } from "@/lib/github-auto-collect/github-file-classifier";

describe("github file classifier", () => {
  it("classifies root README and docs paths", () => {
    assert.equal(classifyGitHubFilePath("README.md"), "README");
    assert.equal(classifyGitHubFilePath("README.ko.md"), "README");
    assert.equal(classifyGitHubFilePath("README.en.md"), "README");
    assert.equal(classifyGitHubFilePath("docs/guide/intro.md"), "DOCS");
  });

  it("prioritizes GETTING_STARTED and API_DOC over generic DOCS", () => {
    assert.equal(classifyGitHubFilePath("docs/getting-started.md"), "GETTING_STARTED");
    assert.equal(classifyGitHubFilePath("docs/quickstart.md"), "GETTING_STARTED");
    assert.equal(classifyGitHubFilePath("docs/installation.md"), "GETTING_STARTED");
    assert.equal(classifyGitHubFilePath("guide/start.md"), "GETTING_STARTED");
    assert.equal(classifyGitHubFilePath("docs/api.md"), "API_DOC");
    assert.equal(classifyGitHubFilePath("docs/reference.md"), "API_DOC");
    assert.equal(classifyGitHubFilePath("docs/openapi.yaml"), "API_DOC");
    assert.equal(classifyGitHubFilePath("swagger.json"), "API_DOC");
  });

  it("classifies manifests, src, test, and binary", () => {
    assert.equal(classifyGitHubFilePath("package.json"), "PACKAGE_MANIFEST");
    assert.equal(classifyGitHubFilePath("pom.xml"), "PACKAGE_MANIFEST");
    assert.equal(classifyGitHubFilePath("packages/foo/src/index.ts"), "SRC");
    assert.equal(classifyGitHubFilePath("src/main/java/App.java"), "SRC");
    assert.equal(classifyGitHubFilePath("tests/AppTest.java"), "TEST");
    assert.equal(classifyGitHubFilePath("assets/logo.png"), "BINARY");
    assert.equal(classifyGitHubFilePath("yarn.lock"), "LOCK_FILE");
  });

  it("classifies README.pdf and LICENSE.pdf as binary", () => {
    assert.equal(classifyGitHubFilePath("README.pdf"), "BINARY");
    assert.equal(classifyGitHubFilePath("LICENSE.pdf"), "BINARY");
    assert.equal(classifyGitHubFilePath("NOTICE.pdf"), "BINARY");
    assert.equal(classifyGitHubFilePath("README.md"), "README");
    assert.equal(classifyGitHubFilePath("LICENSE"), "LICENSE");
  });

  it("classifies examples, playground, stories, and config", () => {
    assert.equal(classifyGitHubFilePath("examples/basic/index.ts"), "EXAMPLE");
    assert.equal(classifyGitHubFilePath("playground/app.tsx"), "EXAMPLE");
    assert.equal(classifyGitHubFilePath("stories/Grid.stories.tsx"), "EXAMPLE");
    assert.equal(classifyGitHubFilePath("Dockerfile"), "CONFIG");
    assert.equal(classifyGitHubFilePath("docker-compose.yml"), "CONFIG");
    assert.equal(classifyGitHubFilePath("tsconfig.json"), "CONFIG");
  });

  it("classifies build artifacts and generated files", () => {
    assert.equal(classifyGitHubFilePath("node_modules/pkg/index.js"), "BUILD_ARTIFACT");
    assert.equal(classifyGitHubFilePath(".next/server/app.js"), "BUILD_ARTIFACT");
    assert.equal(classifyGitHubFilePath("src/generated/schema.generated.ts"), "GENERATED");
  });
});
