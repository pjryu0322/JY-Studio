import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductProfileHint } from "@/lib/github-auto-collect/github-product-profile-detector";
import type { GitHubTreeFileItem } from "@/lib/github-auto-collect/github-auto-collect-types";

function blob(path: string): GitHubTreeFileItem {
  return { path, type: "blob", size: 100 };
}

describe("github product profile hint", () => {
  it("hints SDK/frontend when package.json and examples exist", () => {
    const hint = buildProductProfileHint([
      blob("package.json"),
      blob("src/index.ts"),
      blob("examples/basic.ts"),
      blob("README.md"),
    ]);
    assert.ok(hint.likelyTypes.some((t) => t === "SDK_LIBRARY" || t === "FRONTEND_COMPONENT"));
    assert.ok(hint.evidence.includes("package.json"));
  });

  it("hints backend when pom and java sources exist", () => {
    const hint = buildProductProfileHint([
      blob("pom.xml"),
      blob("src/main/java/App.java"),
    ]);
    assert.ok(hint.likelyTypes.includes("BACKEND_FRAMEWORK"));
  });

  it("hints documentation only for readme-only tree", () => {
    const hint = buildProductProfileHint([blob("README.md")]);
    assert.ok(hint.likelyTypes.includes("DOCUMENTATION_ONLY"));
  });
});
