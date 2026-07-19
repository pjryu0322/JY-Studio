import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd());
const tab = readFileSync(
  join(root, "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
  "utf8",
);

describe("provider search validation UX", () => {
  it("starts with empty draftQuery and placeholder only", () => {
    assert.match(tab, /useState\(""\)/);
    assert.match(tab, /draftQuery/);
    assert.match(tab, /executedQuery/);
    assert.match(tab, /placeholder="예: 기획단계 대가 산정 방법을 알려주세요\."/);
    assert.doesNotMatch(tab, /suggestedQuery\) setQuery/);
    assert.doesNotMatch(tab, /setQuery\(svc\.suggestedQuery\)/);
    assert.doesNotMatch(tab, /주요 기능을 알려주세요/);
  });

  it("does not render suggested query chips or history UI", () => {
    assert.doesNotMatch(tab, /suggestedQueries\.slice/);
    assert.doesNotMatch(tab, /최근 실행 질문/);
    assert.doesNotMatch(tab, /질문 History/);
    assert.doesNotMatch(tab, /추천 질문으로 다시 검증/);
  });

  it("places API/MCP search buttons next to the query input", () => {
    assert.match(tab, /API 검색/);
    assert.match(tab, /MCP 검색/);
    assert.match(tab, /검색할 질문을 입력해 주세요/);
    assert.match(tab, /다른 질문으로 다시 검색/);
  });

  it("separates auto-eval from provider confirmation badges", () => {
    assert.match(tab, /검색데이터 준비 완료/);
    assert.match(tab, /자동 검색 평가/);
    assert.match(tab, /자동 평가 통과/);
    assert.match(tab, /자동 평가 다시 필요/);
    assert.match(tab, /자동 평가 다시 실행/);
    assert.match(tab, /rankingPolicyStale/);
    assert.match(tab, /품질 확인 필요/);
    assert.match(tab, /결과 적절함/);
    assert.match(tab, /검색 결과 보완 필요/);
    assert.doesNotMatch(tab, /검색 품질 검증 완료/);
  });

  it("keeps past channel.query display and uses lock-reason specific copy", () => {
    assert.match(tab, /channel\.query \|\| executedQuery/);
    assert.match(tab, /validationLockReason === "OPEN_REVIEW"/);
    assert.match(tab, /검수요청을 회수해 주세요/);
    assert.match(tab, /BINDING_MISSING/);
    assert.doesNotMatch(
      tab,
      /!status\?\.canRunValidation \? \(\s*<p[^>]*>\s*검수요청 시점의 검증 결과입니다/,
    );
    assert.match(
      tab,
      /다른 질문으로 다시 검색하고 보완 사유를 확인해 주세요/,
    );
    assert.doesNotMatch(
      tab,
      /검색 결과 품질을 개선하려면 데이터 구조화를 다시 실행하거나/,
    );
  });

  it("keeps tech info collapsed by default and results top-3 expandable", () => {
    assert.match(tab, /useState\(false\)/);
    assert.match(tab, /기술정보 보기/);
    assert.match(tab, /results\.slice\(0, 3\)/);
    assert.match(tab, /결과 \$\{channel\.results\.length - 3\}건 더 보기/);
  });
});
