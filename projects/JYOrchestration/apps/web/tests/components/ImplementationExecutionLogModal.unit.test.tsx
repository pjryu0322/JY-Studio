import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImplementationExecutionLogModal } from "@/components/preview/ImplementationExecutionLogModal";

describe("ImplementationExecutionLogModal", () => {
  it("renders centered modal when open", () => {
    const html = renderToStaticMarkup(
      <ImplementationExecutionLogModal
        open
        onClose={() => {}}
        promptTimeline={[]}
        exportBaseName="demo"
      />,
    );
    expect(html).toContain('data-testid="implementation-execution-log-modal"');
    expect(html).toContain("실행 로그");
  });

  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      <ImplementationExecutionLogModal open={false} onClose={() => {}} promptTimeline={[]} />,
    );
    expect(html).toBe("");
  });
});
