import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd());

describe("ProviderServiceValidationTab search-data UX", () => {
  const source = readFileSync(
    join(root, "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
    "utf8",
  );

  it("uses simplified header copy without local-hash/pgvector jargon", () => {
    assert.match(source, /구조화된 데이터를 검색 가능한 형태로 생성하고 검색 품질을 확인합니다/);
    assert.doesNotMatch(source, /Embedding provider: local-hash/);
    assert.doesNotMatch(source, /운영용 Embedding·pgvector는 미적용/);
    assert.doesNotMatch(source, /개발·검증용 Draft 검색 인덱스\(local-hash\)/);
  });

  it("provides search data generate / validate CTAs and tech details toggle", () => {
    assert.match(source, /검색데이터 생성/);
    assert.match(source, /검색 품질 검증/);
    assert.match(source, /기술정보 보기/);
    assert.match(source, /generateProviderSearchDataApi/);
    assert.match(source, /validateProviderSearchDataApi/);
  });

  it("gates API·MCP lock hint to CREATED/VALIDATING/VALIDATION_FAILED and uses 44px touch targets", () => {
    assert.match(source, /검색 품질 검증을 완료하면 API·MCP 검증을 진행할 수 있습니다/);
    assert.match(source, /sd\?\.state === "CREATED"/);
    assert.match(source, /min-h-\[44px\]/);
    assert.match(source, /canRunServiceValidation/);
    assert.match(source, /resolveSearchDataNotReadyBanner/);
  });

  it("keeps CREATE_FAILED message in the card only (no duplicate global alert path)", () => {
    assert.match(source, /검색데이터 생성 실패/);
    assert.match(source, /검색데이터 요청에 실패했습니다/);
    assert.doesNotMatch(source, /setError\([^)]*검색데이터 생성에 실패했습니다/);
  });

  it("shows VALIDATION_FAILED as quality remediation not create failure", () => {
    assert.match(source, /검색 품질 보완 필요/);
  });

  it("separates original download wording from Portable RAG Export", () => {
    assert.match(source, /RAG Export 패키지 검증/);
    assert.doesNotMatch(source, /원본문서 다운로드 검증/);
    assert.doesNotMatch(source, /Portable RAG Export 생성·검증\(미구현\)/);
  });
});
