import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  LEGACY_BUILDER_DISABLED_ERROR,
  legacyBuilderDisabledBody,
} from "../lib/legacy-builder-disabled.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function assertFrozenMutationRoute(relativePath: string) {
  const source = readSource(relativePath);
  assert.ok(source.includes("legacyBuilderDisabledBody"), relativePath);
  assert.ok(source.includes("status: 410"), relativePath);
}

describe("legacy builder freeze routes", () => {
  it("returns shared LEGACY_BUILDER_DISABLED body", () => {
    assert.equal(LEGACY_BUILDER_DISABLED_ERROR, "LEGACY_BUILDER_DISABLED");
    assert.deepEqual(legacyBuilderDisabledBody(), {
      error: "LEGACY_BUILDER_DISABLED",
      message: "JYKStore 내부 지식 생성 기능은 종료되었습니다.",
    });
  });

  it("freezes github auto-collect and KU draft mutation APIs", () => {
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/auto-collect/github/register/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/auto-collect/github/knowledge-units/draft/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/github/repository-discovery/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/knowledge-unit-drafts/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/admin/knowledge-unit-drafts/[draftId]/decision/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/admin/knowledge-unit-drafts/[draftId]/activate/route.ts",
    );
  });

  it("freezes provider inspection and quality generation APIs", () => {
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/inspection/auto-prepare/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/structure-quality/evaluate/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/chunk-quality/evaluate/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/retrieval-evaluation/cases/generate/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/retrieval-evaluation/run/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/release-gate/evaluate/route.ts",
    );
    assertFrozenMutationRoute(
      "src/app/api/v1/provider/packs/[packId]/source-documents/route.ts",
    );
  });

  it("redirects admin KU drafts bookmarks to admin reviews", () => {
    const page = readSource("src/app/(store)/admin/knowledge-unit-drafts/page.tsx");
    assert.ok(page.includes("redirect"));
    assert.ok(page.includes("adminReviews"));
    assert.ok(!page.includes("AdminKnowledgeUnitDraftReviewPanel"));
  });
});
