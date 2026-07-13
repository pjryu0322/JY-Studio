import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  normalizePublicPackDisplayName,
  resolvePublicPackDisplayName,
} from "../lib/public-pack-display-name.ts";
import { resolvePublicPackContentType } from "../lib/public-pack-content-type.ts";
import {
  formatPublicLicenseDisplayName,
  isAmbiguousPublicLicenseName,
} from "../lib/public-pack-detail-info.ts";

function readSource(rel: string) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
}

describe("normalizePublicPackDisplayName", () => {
  it("converts filename-like titles to natural language", () => {
    assert.equal(
      normalizePublicPackDisplayName("(2025년_개정판)_SW사업_대가산정_가이드"),
      "2025년 개정판 SW사업 대가산정 가이드",
    );
  });

  it("strips extensions and short copy suffixes", () => {
    assert.equal(
      normalizePublicPackDisplayName("2025년_개정판_SW사업_대가산정_가이드01.docx"),
      "2025년 개정판 SW사업 대가산정 가이드",
    );
  });

  it("prefers provider-supplied display name", () => {
    assert.equal(
      resolvePublicPackDisplayName({
        preferredDisplayName: "SW사업 대가산정 가이드",
        name: "(2025년_개정판)_SW사업_대가산정_가이드",
      }),
      "SW사업 대가산정 가이드",
    );
  });
});

describe("resolvePublicPackContentType", () => {
  it("infers DOCUMENT for download-only document packs", () => {
    assert.equal(
      resolvePublicPackContentType({
        categoryName: "가이드",
        downloadReady: true,
        hasDocumentSource: true,
        features: [],
        supportedEnvironments: [],
      }),
      "DOCUMENT",
    );
  });

  it("infers PRODUCT when product-shaped fields exist", () => {
    assert.equal(
      resolvePublicPackContentType({
        categoryName: "UI",
        features: ["표 렌더링"],
        supportedEnvironments: ["React"],
        useCases: ["대시보드"],
      }),
      "PRODUCT",
    );
  });
});

describe("public license display", () => {
  it("treats ambiguous public/open as 이용조건 확인 필요", () => {
    assert.equal(isAmbiguousPublicLicenseName("public"), true);
    assert.equal(formatPublicLicenseDisplayName("PUBLIC"), "이용조건 확인 필요");
    assert.equal(formatPublicLicenseDisplayName("Apache-2.0"), "Apache-2.0");
  });
});

describe("pack detail UX source contracts", () => {
  it("hides empty feature sections and empty placeholder copy", () => {
    const page = readSource("app/(store)/packs/[packId]/page.tsx");
    const featureList = readSource("components/PackFeatureList.tsx");
    assert.match(page, /pack\.features\.length > 0/);
    assert.match(page, /PackEmptyDetailNotice/);
    assert.equal(featureList.includes("준비 중입니다."), false);
    assert.match(featureList, /return null/);
  });

  it("uses status text instead of disabled 추가됨 button on detail actions", () => {
    const actions = readSource("components/PackPrimaryActions.tsx");
    const addButton = readSource("components/AddToMyPacksButton.tsx");
    assert.match(actions, /내 지식팩에 추가됨/);
    assert.match(actions, /내 지식팩에서 보기/);
    assert.equal(actions.includes("disabled"), false);
    assert.equal(addButton.includes(">추가됨<"), false);
    assert.match(addButton, /내 지식팩에 추가됨/);
  });

  it("renders source/license and download info sections", () => {
    const page = readSource("app/(store)/packs/[packId]/page.tsx");
    assert.match(page, /PackSourceLicenseSection/);
    assert.match(page, /PackDownloadInfoSection/);
    const source = readSource("components/PackSourceLicenseSection.tsx");
    assert.match(source, /noopener noreferrer/);
    assert.match(source, /출처 및 이용조건/);
  });

  it("meta grid avoids empty rating and zero usage", () => {
    const meta = readSource("components/PackMetaGrid.tsx");
    assert.match(meta, /pack\.rating > 0/);
    assert.match(meta, /pack\.usageCount > 0/);
    assert.equal(meta.includes('사용 0회'), false);
    assert.equal(meta.includes("★ —"), false);
  });
});
