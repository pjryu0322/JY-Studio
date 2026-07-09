import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductProfileHint,
  detectGitHubProductProfile,
} from "@/lib/github-auto-collect/github-product-profile-detector";
import type { GitHubTreeFileItem } from "@/lib/github-auto-collect/github-auto-collect-types";

function blob(path: string): GitHubTreeFileItem {
  return { path, type: "blob", size: 100 };
}

const meta = {
  language: "TypeScript",
  description: "",
  repo: "repo",
  fullName: "org/repo",
};

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

  it("counts GETTING_STARTED as docs evidence", () => {
    const hint = buildProductProfileHint([blob("README.md"), blob("docs/getting-started.md")]);
    assert.ok(hint.evidence.includes("docs/**"));
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

describe("detectGitHubProductProfile", () => {
  it("detects FRONTEND_COMPONENT", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("package.json"),
        blob("src/index.ts"),
        blob("examples/basic.ts"),
        blob("docs/getting-started.md"),
        blob("README.md"),
      ],
      metadata: {
        language: "TypeScript",
        description: "UI grid component",
        repo: "tui.grid",
        fullName: "nhn/tui.grid",
      },
    });
    assert.equal(result.primaryType, "FRONTEND_COMPONENT");
    assert.ok(result.confidence > 0.5);
    assert.ok(result.evidence.length > 0);
    assert.ok(Array.isArray(result.candidateTypes));
  });

  it("detects CHART_COMPONENT", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("package.json"),
        blob("src/chart.ts"),
        blob("examples/basic.ts"),
        blob("docs/guide.md"),
      ],
      metadata: {
        language: "TypeScript",
        description: "Chart visualization component",
        repo: "tui.chart",
        fullName: "nhn/tui.chart",
      },
    });
    assert.equal(result.primaryType, "CHART_COMPONENT");
  });

  it("detects BACKEND_FRAMEWORK", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("pom.xml"),
        blob("src/main/java/App.java"),
        blob("application.yml"),
        blob("docs/openapi.yaml"),
      ],
      metadata: {
        language: "Java",
        description: "Spring backend framework",
        repo: "backend",
        fullName: "org/backend",
      },
    });
    assert.equal(result.primaryType, "BACKEND_FRAMEWORK");
  });

  it("detects TEMPLATE_APP", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("package.json"),
        blob("app/page.tsx"),
        blob(".env.example"),
        blob("docker-compose.yml"),
        blob("README.md"),
      ],
      metadata: {
        language: "TypeScript",
        description: "starter template app",
        repo: "template",
        fullName: "org/template",
      },
    });
    assert.equal(result.primaryType, "TEMPLATE_APP");
  });

  it("detects SDK_LIBRARY", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("package.json"),
        blob("lib/index.ts"),
        blob("examples/basic.ts"),
        blob("docs/api.md"),
      ],
      metadata: {
        language: "JavaScript",
        description: "browser sdk client",
        repo: "sdk",
        fullName: "org/sdk",
      },
    });
    assert.equal(result.primaryType, "SDK_LIBRARY");
  });

  it("detects CLI_TOOL", () => {
    const result = detectGitHubProductProfile({
      files: [blob("package.json"), blob("bin/cli.js"), blob("README.md")],
      metadata: {
        language: "JavaScript",
        description: "command line cli tool",
        repo: "cli",
        fullName: "org/cli",
      },
    });
    assert.equal(result.primaryType, "CLI_TOOL");
  });

  it("detects INFRA_TOOL", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("Dockerfile"),
        blob("helm/chart.yaml"),
        blob("k8s/deployment.yaml"),
        blob("terraform/main.tf"),
      ],
      metadata: meta,
    });
    assert.equal(result.primaryType, "INFRA_TOOL");
  });

  it("detects DOCUMENTATION_ONLY", () => {
    const result = detectGitHubProductProfile({
      files: [
        blob("README.md"),
        blob("docs/intro.md"),
        blob("docs/getting-started.md"),
      ],
      metadata: meta,
    });
    assert.equal(result.primaryType, "DOCUMENTATION_ONLY");
  });

  it("returns UNKNOWN for weak evidence", () => {
    const result = detectGitHubProductProfile({
      files: [blob("random.txt")],
      metadata: meta,
    });
    assert.equal(result.primaryType, "UNKNOWN");
    assert.ok(result.confidence < 0.5 || result.warnings.length > 0);
  });
});
