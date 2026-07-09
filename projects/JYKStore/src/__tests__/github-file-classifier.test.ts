import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyGitHubFilePath } from "@/lib/github-auto-collect/github-file-classifier";

describe("github file classifier", () => {
  it("classifies root README and docs paths", () => {
    assert.equal(classifyGitHubFilePath("README.md"), "README");
    assert.equal(classifyGitHubFilePath("README.ko.md"), "README");
    assert.equal(classifyGitHubFilePath("docs/guide/intro.md"), "DOCS");
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

  it("classifies examples and config", () => {
    assert.equal(classifyGitHubFilePath("examples/demo/app.js"), "EXAMPLE");
    assert.equal(classifyGitHubFilePath("application.properties"), "CONFIG");
  });
});
