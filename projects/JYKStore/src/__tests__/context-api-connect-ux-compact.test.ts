import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readSource(relativePath: string): string {
  return readFileSync(join(root, "src", relativePath), "utf8");
}

describe("Context API connect UX compact layout", () => {
  it("integrates connection info rows for key, pack, endpoint, authorization", () => {
    const panel = readSource("components/ApiConnectionInfo.tsx");
    assert.match(panel, /API 연결 정보/);
    assert.match(panel, /외부 애플리케이션에서 이 지식팩을 호출할 때 필요한 정보입니다/);
    assert.match(panel, /API Key 전체 관리/);
    assert.match(panel, /label="API Key"/);
    assert.match(panel, /label="Pack ID"/);
    assert.match(panel, /label="Endpoint"/);
    assert.match(panel, /label="Authorization"/);
    assert.match(panel, /API Key 복사/);
    assert.match(panel, /Pack ID 복사/);
    assert.match(panel, /Endpoint 복사/);
    assert.match(panel, /Authorization 헤더 형식 복사/);
    assert.match(panel, /IssuedApiKeyNotice/);
    assert.match(panel, /숨기기/);
    assert.match(panel, /MASKED_API_KEY/);
  });

  it("keeps one-time key reveal policy in issued notice", () => {
    const notice = readSource("components/IssuedApiKeyNotice.tsx");
    assert.match(notice, /API Key가 발급되었습니다/);
    assert.match(notice, /지금만 전체 값이 표시됩니다/);
    assert.match(notice, /Key 복사/);
    assert.match(notice, /확인했습니다 \/ Key 숨기기/);
  });

  it("makes Context API test the primary work area under connection info", () => {
    const page = readSource("components/ConnectPageClient.tsx");
    const test = readSource("components/ContextApiTestPanel.tsx");
    const apiIdx = page.indexOf("<ApiConnectionInfo");
    const testIdx = page.indexOf("<ContextApiTestPanel");
    assert.ok(apiIdx >= 0 && testIdx > apiIdx);
    assert.match(test, /Context API 테스트/);
    assert.match(test, /Context API 문서/);
    assert.match(test, /TypeScript SDK 샘플/);
    assert.equal(test.includes("border-blue-100 bg-blue-50"), false);
    assert.match(test, /\{result \?/);
  });
});
