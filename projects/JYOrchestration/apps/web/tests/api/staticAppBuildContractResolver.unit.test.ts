import { describe, expect, it } from "vitest";
import { resolveStaticAppBuildContract } from "@/lib/prototype/staticAppBuildContractResolver";

describe("staticAppBuildContractResolver", () => {
  const viteSourceFiles = [
    "index.html",
    "src/main.tsx",
    "src/App.tsx",
    "src/components/Header.tsx",
  ];

  it("1. index.html + src/main.tsx + src/App.tsx => vite_react_spa needs_scaffold without package.json", () => {
    const c = resolveStaticAppBuildContract({ repositoryFiles: viteSourceFiles });
    expect(c.projectType).toBe("vite_react_spa");
    expect(c.status).toBe("needs_scaffold");
    expect(c.canAutoScaffold).toBe(true);
  });

  it("2. package.json without build script => missing_build_script", () => {
    const c = resolveStaticAppBuildContract({
      repositoryFiles: [...viteSourceFiles, "package.json", "vite.config.ts", "tsconfig.json"],
      packageJson: { scripts: { dev: "vite" } },
    });
    expect(c.status).toBe("missing_build_script");
  });

  it("4. full vite contract => ready", () => {
    const c = resolveStaticAppBuildContract({
      repositoryFiles: [...viteSourceFiles, "package.json", "vite.config.ts", "tsconfig.json"],
      packageJson: { scripts: { build: "vite build" } },
    });
    expect(c.status).toBe("ready");
    expect(c.outputDir).toBe("dist");
  });

  it("5. next.config without static export => unsupported_runtime", () => {
    const c = resolveStaticAppBuildContract({
      repositoryFiles: ["next.config.ts", "app/page.tsx", "package.json"],
      packageJson: { scripts: { build: "next build" } },
    });
    expect(c.status).toBe("unsupported_runtime");
  });

  it("existing dist/index.html => ready with artifact outputDir", () => {
    const c = resolveStaticAppBuildContract({
      repositoryFiles: ["dist/index.html", "package.json"],
    });
    expect(c.status).toBe("ready");
    expect(c.outputDir).toBe("dist");
  });
});
