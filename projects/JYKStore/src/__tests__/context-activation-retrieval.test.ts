import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE } from "@/lib/admin-knowledge-unit-draft-activation-dto";
import { isRetrievalCandidateChunk } from "@/lib/admin-knowledge-unit-draft-activation-service";
import { scoreRetrievalChunk } from "@/lib/retrieval-ranking";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

const retrievalCandidateStorePath = join(projectRoot, "src/lib/retrieval/retrieval-candidate-store.ts");

describe("activation retrieval safeguards", () => {
  it("retrieval candidate store filters isActive=true only", () => {
    const source = readFileSync(retrievalCandidateStorePath, "utf8");
    assert.ok(source.includes("isActive: true"));
  });

  it("excludes inactive AUTO_KNOWLEDGE_UNIT_DRAFT from retrieval candidates", () => {
    const chunks = [
      {
        id: "draft-1",
        chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
        content: "draft only content should not appear",
        isActive: false as const,
        metadata: { reviewStatus: "approved" },
      },
      {
        id: "active-1",
        chunkType: AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
        content: "toast ui grid column setup active knowledge",
        isActive: true as const,
        metadata: { activatedFromDraftId: "draft-1" },
      },
    ];

    const candidates = chunks.filter((chunk) => isRetrievalCandidateChunk(chunk));
    assert.deepEqual(
      candidates.map((c) => c.id),
      ["active-1"],
    );
  });

  it("scores query tokens only against active activation chunk content", () => {
    const draft = {
      id: "draft-1",
      title: "Draft",
      content: "draft only content should not appear",
      section: null,
      chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
      tags: [] as string[],
      sortOrder: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      metadata: null,
      isActive: false as const,
    };
    const active = {
      id: "active-1",
      title: "Active knowledge",
      content: "toast ui grid column setup active knowledge",
      section: null,
      chunkType: AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
      tags: ["toast", "grid"],
      sortOrder: 1,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      metadata: { activatedFromDraftId: "draft-1" },
      isActive: true as const,
    };

    const candidates = [draft, active].filter((chunk) => isRetrievalCandidateChunk(chunk));
    const tokens = ["toast", "grid", "column"];
    const scored = candidates.map((chunk) =>
      scoreRetrievalChunk({ chunk, tokens, filters: {} }),
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.id, "active-1");
    assert.ok(scored[0]!.score > 0);
    assert.ok(scored[0]!.keywordScore > 0);
    assert.ok(!candidates.some((c) => c.content.includes("draft only content")));
  });
});
