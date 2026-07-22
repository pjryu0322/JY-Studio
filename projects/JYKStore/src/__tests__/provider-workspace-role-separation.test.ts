import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildProviderPackProgress,
} from "../lib/provider-pack-progress.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider workspace role separation", () => {
  it("hides consumer saved-packs section on provider my-packs path", () => {
    const myPacks = readSource("src/components/MyPacksPageClient.tsx");
    assert.ok(!myPacks.includes('보관한 지식팩'));
    assert.ok(!myPacks.includes("연동하기"));
    assert.ok(!myPacks.includes("Pack ID 복사"));
    assert.ok(!myPacks.includes("내가 등록한 지식팩"));
    assert.ok(!myPacks.includes("등록·검수·공개 상태와 다음 작업을 확인합니다."));
    assert.ok(myPacks.includes("지식팩명 검색"));
    assert.ok(myPacks.includes("상태 필터"));
    assert.ok(myPacks.includes("isProvider"));
  });

  it("keeps consumer CTAs on MyPackCard for user screens", () => {
    const card = readSource("src/components/MyPackCard.tsx");
    assert.ok(card.includes("ConnectActionButton") || card.includes("연동"));
    assert.ok(card.includes("다운로드") || card.includes("download"));
    assert.ok(card.includes("Pack ID") || card.includes("CopyButton"));
  });

  it("provider center avoids consumer catalog CTAs", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("보관한 지식팩"));
    assert.ok(!center.includes("연동하기"));
    assert.ok(!center.includes("Pack ID 복사"));
    assert.ok(center.includes("내가 등록한 지식팩"));
    assert.ok(center.includes("검수/보완 알림"));
    assert.ok(!center.includes("공개 중인 지식팩 성과"));
  });

  it("maps provider CTAs to workflow language by state", () => {
    const changes = buildProviderPackProgress({
      packId: "p1",
      packStatus: "DRAFT",
      name: "P",
      categoryId: "c",
      shortDescription: "s",
      description: "d",
      language: "ko",
      latestRejectionReason: "보완 필요",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.ok(changes.actions.some((a) => a.label === "보완사항 보기"));

    const published = buildProviderPackProgress({
      packId: "p2",
      packStatus: "PUBLISHED",
      name: "P",
      categoryId: "c",
      shortDescription: "s",
      description: "d",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: { id: "v1", version: "0.1.0" },
    });
    assert.ok(published.actions.some((a) => a.label === "공개 정보 관리"));
    assert.ok(!published.actions.some((a) => a.label === "연동하기"));
  });
});
