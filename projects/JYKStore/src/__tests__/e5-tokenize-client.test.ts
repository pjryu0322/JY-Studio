import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { tokenizePassages } from "@/lib/embedding/e5-tokenize-client";

describe("e5 tokenize client", () => {
  it("batches tokenize requests and remaps indices", async () => {
    const calls: string[][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/ready")) {
        return new Response(
          JSON.stringify({
            ready: true,
            backend: "sentence-transformers",
            stub: false,
            model: "dragonkue/multilingual-e5-small-ko-v2",
            revision: "fcfc26bf355882620c48df58be112275bd756f50",
            dimension: 384,
            maxSequenceTokens: 512,
            normalized: true,
            device: "cpu",
            maxBatchSize: 16,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { texts: string[] };
      calls.push(body.texts);
      return new Response(
        JSON.stringify({
          model: "dragonkue/multilingual-e5-small-ko-v2",
          revision: "fcfc26bf355882620c48df58be112275bd756f50",
          maxSequenceTokens: 512,
          items: body.texts.map((_, index) => ({
            index,
            tokenCount: 10 + index,
            withinLimit: true,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const texts = Array.from({ length: 20 }, (_, i) => `passage: t${i}`);
    const result = await tokenizePassages({
      texts,
      options: {
        workerBaseUrl: "http://127.0.0.1:8011",
        model: "dragonkue/multilingual-e5-small-ko-v2",
        modelRevision: "fcfc26bf355882620c48df58be112275bd756f50",
        token: "tok",
        fetchImpl,
        batchSize: 16,
      },
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.length, 16);
    assert.equal(calls[1]!.length, 4);
    assert.equal(result.items.length, 20);
    assert.equal(result.items[16]!.index, 16);
    assert.equal(result.maxSequenceTokens, 512);
  });

  it("rejects stub worker for tokenize gate", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ready: true,
          backend: "stub",
          stub: true,
          model: "dragonkue/multilingual-e5-small-ko-v2",
          revision: "stub",
          dimension: 384,
          maxSequenceTokens: 512,
          normalized: true,
          device: "cpu",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await assert.rejects(
      () =>
        tokenizePassages({
          texts: ["passage: a"],
          options: {
            workerBaseUrl: "http://127.0.0.1:8011",
            model: "dragonkue/multilingual-e5-small-ko-v2",
            modelRevision: "fcfc26bf355882620c48df58be112275bd756f50",
            fetchImpl,
          },
        }),
      (error: unknown) =>
        error instanceof EmbeddingProviderError && error.code === "EMBEDDING_WORKER_STUB_ACTIVE",
    );
  });
});
