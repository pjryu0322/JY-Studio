import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  deriveShortDescription,
  PROVIDER_PACK_INITIAL_VERSION_CHANGELOG,
  resolveProviderEditableShortDescription,
  resolveProviderEditableVersionChangelog,
} from "../lib/pack-summary-generator.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider pack basic info UX sources", () => {
  it("renders a single public-facing summary field without auto-summary accordion", () => {
    const basic = readSource("src/components/ProviderPackBasicInfoTab.tsx");
    assert.ok(!basic.includes("PROVIDER_PACK_AUTO_SUMMARY_LABEL"));
    assert.ok(!basic.includes("자동 생성 요약"));
    assert.ok(!basic.includes("PROVIDER_PACK_ADVANCED_SUMMARY_EDIT"));
    assert.ok(!basic.includes("고급 요약 수정"));
    assert.ok(!basic.includes("요약 문구"));
    assert.ok(!basic.includes("<details"));
    assert.ok(basic.includes("PROVIDER_PACK_SHORT_SUMMARY_LABEL"));
    assert.ok(basic.includes('htmlFor="edit-short"'));
    assert.equal((basic.match(/id="edit-short"/g) ?? []).length, 1);
  });

  it("does not repeat pack name or id in the basic-info card body", () => {
    const basic = readSource("src/components/ProviderPackBasicInfoTab.tsx");
    assert.ok(!basic.includes("packName"));
    assert.ok(!basic.includes("packId"));
    assert.ok(!basic.includes("PROVIDER_PACK_ID_LABEL"));
    assert.ok(!basic.includes("PROVIDER_PACK_ID_READONLY_HINT"));
  });

  it("uses version changelog labeling and dual save actions", () => {
    const basic = readSource("src/components/ProviderPackBasicInfoTab.tsx");
    assert.ok(basic.includes("PROVIDER_PACK_VERSION_CHANGELOG_LABEL_PREFIX"));
    assert.ok(!basic.includes("버전 개요"));
    assert.ok(basic.includes("PROVIDER_PACK_SAVE_DRAFT"));
    assert.ok(basic.includes("PROVIDER_PACK_SAVE_AND_GO_PAYLOAD"));
    assert.ok(!basic.includes("변경 저장"));
  });

  it("saves draft on basic tab and continues to payload after primary save", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(editor.includes('onSaveBasicInfo({ nextTab: "payload" })'));
    assert.ok(editor.includes("onSaveDraft={() => void onSaveBasicInfo()}"));
    assert.ok(editor.includes("PROVIDER_PACK_SAVE_DRAFT_SUCCESS"));
    assert.ok(editor.includes("if (!editable || saving) return"));
    assert.ok(editor.includes("resolveProviderEditableShortDescription"));
    assert.ok(editor.includes("resolveProviderEditableVersionChangelog"));
  });
});

describe("provider pack basic info summary resolution", () => {
  it("prefers canonical shortDescription over overview fallback", () => {
    const value = resolveProviderEditableShortDescription({
      shortDescription: "Canonical summary text here",
      overview: "Legacy overview summary text",
    });
    assert.equal(value, "Canonical summary text here");
  });

  it("falls back to overview when canonical summary is empty", () => {
    const value = resolveProviderEditableShortDescription({
      shortDescription: "   ",
      overview: "Legacy overview summary text",
    });
    assert.equal(value, "Legacy overview summary text");
  });

  it("does not treat initial changelog as summary fallback", () => {
    const value = resolveProviderEditableShortDescription({
      shortDescription: "",
      overview: PROVIDER_PACK_INITIAL_VERSION_CHANGELOG,
    });
    assert.equal(value, "");
  });

  it("defaults empty or legacy-duplicated overview to initial changelog", () => {
    assert.equal(
      resolveProviderEditableVersionChangelog({
        overview: "",
        shortDescription: "한 줄 요약입니다.",
      }),
      PROVIDER_PACK_INITIAL_VERSION_CHANGELOG,
    );
    assert.equal(
      resolveProviderEditableVersionChangelog({
        overview: "한 줄 요약입니다.",
        shortDescription: "한 줄 요약입니다.",
      }),
      PROVIDER_PACK_INITIAL_VERSION_CHANGELOG,
    );
    assert.equal(
      resolveProviderEditableVersionChangelog({
        overview: "문서 구조와 표 추출 방식을 개선했습니다.",
        shortDescription: "한 줄 요약입니다.",
      }),
      "문서 구조와 표 추출 방식을 개선했습니다.",
    );
  });

  it("avoids statute-like snippets when deriving short descriptions", () => {
    const summary = deriveShortDescription({
      name: "건축법 지식팩",
      description:
        "국토교통부 고시 제2024-123호에 따른 법령 시행령 및 시행규칙 개정 내용을 수록한 문서입니다. 자세한 조문은 원문을 참고하세요.",
    });
    assert.equal(summary, "건축법 지식팩 관련 제품·솔루션 지식팩입니다.");
  });

  it("keeps auto-derived summaries within preferred length", () => {
    const longSentence = `${"가".repeat(180)}. 두 번째 문장.`;
    const summary = deriveShortDescription({
      name: "Long Pack",
      description: longSentence,
    });
    assert.ok(summary.length <= 120);
    assert.ok(summary.length >= 10);
  });
});

describe("provider pack create uses initial version changelog", () => {
  it("does not copy shortDescription into version overview on create", () => {
    const service = readSource("src/lib/provider-pack-service.ts");
    assert.ok(service.includes("PROVIDER_PACK_INITIAL_VERSION_CHANGELOG"));
    assert.ok(service.includes("overview: PROVIDER_PACK_INITIAL_VERSION_CHANGELOG"));
    assert.ok(!service.includes("overview: shortDescription"));
  });
});
