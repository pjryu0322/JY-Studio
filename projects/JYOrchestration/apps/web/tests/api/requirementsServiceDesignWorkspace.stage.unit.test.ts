import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RequirementsWorkspaceStageRenderer } from "@/components/requirements/RequirementsWorkspaceStageRenderer";

describe("RequirementsWorkspaceStageRenderer", () => {
  it("always renders the SingleChat surface only (internal stage is separate)", () => {
    const html = renderToStaticMarkup(
      createElement(RequirementsWorkspaceStageRenderer, {
        singleChatSurface: createElement("span", { "data-testid": "single" }, "chat"),
      })
    );
    expect(html).toContain('data-testid="single"');
  });
});
