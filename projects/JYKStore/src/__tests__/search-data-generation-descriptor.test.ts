import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmbeddingProviderError } from "../lib/embedding/embedding-provider-errors.ts";
import { mapSearchDataFailureCode } from "../lib/search-data/search-data-error.ts";
import { provisionalEnqueueLocalE5Descriptor } from "../lib/search-data/search-data-generation-service.ts";
import {
  assertGenerationDescriptorMatchesRuntime,
  type SearchGenerationEmbeddingDescriptor,
} from "../lib/search-generation/search-generation-types.ts";

const SHA = "fcfc26bf355882620c48df58be112275bd756f50";
const runtime: SearchGenerationEmbeddingDescriptor = {
  embeddingProvider: "local-e5",
  embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
  embeddingModelRevision: SHA,
  embeddingDimension: 384,
  distanceMetric: "cosine",
};

const generation = {
  embeddingProvider: "local-e5" as const,
  embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
  embeddingModelRevision: SHA,
  embeddingDimension: 384,
  distanceMetric: "cosine",
};

describe("assertGenerationDescriptorMatchesRuntime", () => {
  it("passes when descriptors match", () => {
    assert.doesNotThrow(() =>
      assertGenerationDescriptorMatchesRuntime({ generation, runtime }),
    );
  });

  it("throws EMBEDDING_MODEL_MISMATCH on model drift", () => {
    try {
      assertGenerationDescriptorMatchesRuntime({
        generation: { ...generation, embeddingModel: "other-model" },
        runtime,
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_MODEL_MISMATCH");
    }
  });

  it("throws EMBEDDING_MODEL_REVISION_MISMATCH on revision drift", () => {
    try {
      assertGenerationDescriptorMatchesRuntime({
        generation: {
          ...generation,
          embeddingModelRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        runtime,
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_MODEL_REVISION_MISMATCH");
    }
  });

  it("throws EMBEDDING_DIMENSION_MISMATCH on dimension drift", () => {
    try {
      assertGenerationDescriptorMatchesRuntime({
        generation: { ...generation, embeddingDimension: 768 },
        runtime,
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_DIMENSION_MISMATCH");
    }
  });

  it("throws EMBEDDING_CONFIG_INVALID on distance metric drift", () => {
    try {
      assertGenerationDescriptorMatchesRuntime({
        generation: { ...generation, distanceMetric: "l2" },
        runtime,
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_CONFIG_INVALID");
    }
  });

  it("throws EMBEDDING_CONFIG_INVALID for local-hash provider", () => {
    try {
      assertGenerationDescriptorMatchesRuntime({
        generation: { ...generation, embeddingProvider: "local-hash" },
        runtime,
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_CONFIG_INVALID");
    }
  });
});

describe("provisionalEnqueueLocalE5Descriptor validation", () => {
  it("accepts explicit local-e5 with pinned revision", () => {
    const d = provisionalEnqueueLocalE5Descriptor({
      JYKSTORE_EMBEDDING_PROVIDER: "local-e5",
      JYKSTORE_EMBEDDING_MODEL: "dragonkue/multilingual-e5-small-ko-v2",
      JYKSTORE_EMBEDDING_MODEL_REVISION: SHA,
      JYKSTORE_EMBEDDING_DIMENSION: "384",
    });
    assert.equal(d.embeddingProvider, "local-e5");
    assert.equal(d.embeddingDimension, 384);
    assert.equal(d.embeddingModelRevision, SHA);
  });

  it("rejects invalid revision SHA without overwriting", () => {
    try {
      provisionalEnqueueLocalE5Descriptor({
        JYKSTORE_EMBEDDING_PROVIDER: "local-e5",
        JYKSTORE_EMBEDDING_MODEL_REVISION: "main",
        JYKSTORE_EMBEDDING_DIMENSION: "384",
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_MODEL_REVISION_INVALID");
    }
  });

  it("rejects non-local-e5 provider", () => {
    try {
      provisionalEnqueueLocalE5Descriptor({
        JYKSTORE_EMBEDDING_PROVIDER: "local-hash",
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.ok(isEmbeddingProviderError(error));
      assert.equal(error.code, "EMBEDDING_CONFIG_INVALID");
    }
  });
});

describe("descriptor mismatch user messages", () => {
  it("maps model/revision/dimension mismatch to admin config copy", () => {
    for (const code of [
      "EMBEDDING_MODEL_MISMATCH",
      "EMBEDDING_MODEL_REVISION_MISMATCH",
      "EMBEDDING_DIMENSION_MISMATCH",
      "EMBEDDING_WORKER_STUB_ACTIVE",
    ]) {
      const g = mapSearchDataFailureCode(code);
      assert.match(g.message, /검색 모델 설정이 일치하지 않습니다/);
      assert.equal(g.retryable, false);
      assert.equal(g.supportRequired, true);
    }
  });

  it("maps worker transient codes to retry copy", () => {
    for (const code of [
      "EMBEDDING_WORKER_NOT_READY",
      "EMBEDDING_PROVIDER_TIMEOUT",
      "EMBEDDING_PROVIDER_RATE_LIMITED",
    ]) {
      const g = mapSearchDataFailureCode(code);
      assert.match(g.message, /일시적으로 응답하지 않습니다/);
      assert.equal(g.retryable, true);
    }
  });
});
