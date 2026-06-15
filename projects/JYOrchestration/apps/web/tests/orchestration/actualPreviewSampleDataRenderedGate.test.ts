import { describe, expect, it } from "vitest";
import {
  evaluatePreviewSampleDataRenderedFromDocumentText,
  checkPreviewSampleDataRendered,
} from "@/lib/prototype/actualPreviewSampleDataRenderedGate";

const RENDERED_HTML = `<html><body>
<div data-sample-data-ready="true"></div>
<div class="jy-preview-file-list" data-jy-preview-sample="v3">회의파일</div>
<div class="jy-preview-participant-list" data-jy-preview-sample="v3">참여자</div>
</body></html>`;

describe("actualPreviewSampleDataRenderedGate", () => {
  it("sample marker 존재 → rendered ok", () => {
    const r = evaluatePreviewSampleDataRenderedFromDocumentText({ documentText: RENDERED_HTML });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("rendered");
  });

  it("marker 없음 → not_rendered", () => {
    const r = evaluatePreviewSampleDataRenderedFromDocumentText({
      documentText: "<html><body><main>empty app</main></body></html>",
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("missing_dom_marker");
  });

  it("placeholder만 존재 → placeholder_only", () => {
    const r = evaluatePreviewSampleDataRenderedFromDocumentText({
      documentText: "<div>업로드된 회의 녹취 파일이 여기에 표시됩니다.</div>",
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("placeholder_only");
  });

  it("preview unreachable when fetch fails", async () => {
    const r = await checkPreviewSampleDataRendered({
      previewUrl: "https://example.com/preview",
      fetchHtml: async () => null,
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("preview_unreachable");
  });
});
