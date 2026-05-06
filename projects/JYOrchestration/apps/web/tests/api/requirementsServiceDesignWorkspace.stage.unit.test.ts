import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveRequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { RequirementsWorkspaceStageRenderer } from "@/components/requirements/RequirementsWorkspaceStageRenderer";
describe("resolveRequirementsWorkspaceStage", () => {
  it("maps feature-planning and features alias", () => {
    expect(resolveRequirementsWorkspaceStage("feature-planning")).toBe("feature-planning");
    expect(resolveRequirementsWorkspaceStage("features")).toBe("feature-planning");
  });

  it("keeps ideation and service-flow behavior", () => {
    expect(resolveRequirementsWorkspaceStage("")).toBe("ideation");
    expect(resolveRequirementsWorkspaceStage("service-flow")).toBe("service-flow");
    expect(resolveRequirementsWorkspaceStage("service_flow")).toBe("service-flow");
  });
});

describe("RequirementsWorkspaceStageRenderer", () => {
  it("renders feature-planning branch", () => {
    const html = renderToStaticMarkup(
      createElement(RequirementsWorkspaceStageRenderer, {
        activeStage: "feature-planning",
        ideationStage: createElement("span", { "data-testid": "ideation" }, "i"),
        serviceFlowStage: createElement("span", { "data-testid": "sf" }, "s"),
        featurePlanningStage: createElement("span", { "data-testid": "fp" }, "fp"),
      })
    );
    expect(html).toContain('data-testid="fp"');
    expect(html).not.toContain('data-testid="ideation"');
  });

  it("still routes ideation and service-flow", () => {
    expect(
      renderToStaticMarkup(
        createElement(RequirementsWorkspaceStageRenderer, {
          activeStage: "ideation",
          ideationStage: createElement("span", { "data-testid": "ideation" }, "i"),
          serviceFlowStage: createElement("span", { "data-testid": "sf" }, "s"),
          featurePlanningStage: createElement("span", { "data-testid": "fp" }, "fp"),
        })
      )
    ).toContain('data-testid="ideation"');
    expect(
      renderToStaticMarkup(
        createElement(RequirementsWorkspaceStageRenderer, {
          activeStage: "service-flow",
          ideationStage: createElement("span", { "data-testid": "ideation" }, "i"),
          serviceFlowStage: createElement("span", { "data-testid": "sf" }, "s"),
          featurePlanningStage: createElement("span", { "data-testid": "fp" }, "fp"),
        })
      )
    ).toContain('data-testid="sf"');
  });
});
