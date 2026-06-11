import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ImplementationStageGlobalToolbar } from "@/components/preview/ImplementationStageGlobalToolbar";
import { WorkspaceConversationHubIconRow } from "@/components/workspace/WorkspaceConversationHubIconRow";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { IMPLEMENTATION_ENV_SETTINGS_LABEL } from "@/lib/requirements/implementationUxLabels";

describe("Implementation stage global toolbar layout", () => {
  it("renders global toolbar wrapper with role=toolbar", () => {
    const html = renderToStaticMarkup(
      <ImplementationStageGlobalToolbar>
        <span data-testid="toolbar-child">tools</span>
      </ImplementationStageGlobalToolbar>,
    );
    expect(html).toContain('data-testid="implementation-stage-global-toolbar"');
    expect(html).toContain('role="toolbar"');
    expect(html).toContain("tools");
  });

  it("renders mobile compact icon row without overflow when extras are toolbar icons", () => {
    const html = renderToStaticMarkup(
      <ImplementationStageGlobalToolbar>
        <WorkspaceHubChromeIconButton
          title={IMPLEMENTATION_ENV_SETTINGS_LABEL}
          ariaLabel={IMPLEMENTATION_ENV_SETTINGS_LABEL}
          disabled={false}
          onClick={() => {}}
        >
          <span>env</span>
        </WorkspaceHubChromeIconButton>
        <WorkspaceConversationHubIconRow
          iconLayout="mobileCompact"
          showSlotsChrome={false}
          interviewUi={{
            readinessPercent: 40,
            covered: 2,
            total: 5,
            remainingQuestionsEstimate: 3,
            onForceGeneratePlanNow: () => {},
          }}
        />
      </ImplementationStageGlobalToolbar>,
    );
    expect(html).toContain('data-icon-layout="mobileCompact"');
    expect(html).not.toContain("더보기");
    expect(html).not.toContain("참여 멤버");
  });

  it("emphasizes quick execution icon when quickExecutionEmphasized is true", () => {
    const html = renderToStaticMarkup(
      <WorkspaceConversationHubIconRow
        showSlotsChrome={false}
        quickExecutionEmphasized
        interviewUi={{
          readinessPercent: 0,
          covered: 0,
          total: 0,
          remainingQuestionsEstimate: 0,
          onForceGeneratePlanNow: () => {},
        }}
      />,
    );
    expect(html).toContain("#facc15");
    expect(html).toContain("#ca8a04");
  });

  it("renders environment settings icon in implementation toolbar", () => {
    const html = renderToStaticMarkup(
      <ImplementationStageGlobalToolbar>
        <WorkspaceHubChromeIconButton
          title={IMPLEMENTATION_ENV_SETTINGS_LABEL}
          ariaLabel={IMPLEMENTATION_ENV_SETTINGS_LABEL}
          disabled={false}
          onClick={() => {}}
        >
          <span>env</span>
        </WorkspaceHubChromeIconButton>
      </ImplementationStageGlobalToolbar>,
    );
    expect(html).toContain(`aria-label="${IMPLEMENTATION_ENV_SETTINGS_LABEL}"`);
    expect(html).toContain(`title="${IMPLEMENTATION_ENV_SETTINGS_LABEL}"`);
  });

  it("renders execution log icon in implementation toolbar", () => {
    const html = renderToStaticMarkup(
      <ImplementationStageGlobalToolbar>
        <WorkspaceHubChromeIconButton
          title="상세 로그 보기"
          ariaLabel="상세 로그 보기"
          disabled={false}
          onClick={() => {}}
        >
          <span>log</span>
        </WorkspaceHubChromeIconButton>
      </ImplementationStageGlobalToolbar>,
    );
    expect(html).toContain('aria-label="상세 로그 보기"');
    expect(html).toContain('title="상세 로그 보기"');
  });

  it("preserves toolbar-before-board DOM order in stage shell markup", () => {
    const html = renderToStaticMarkup(
      <div data-testid="stage-shell">
        <ImplementationStageGlobalToolbar>
          <span>toolbar</span>
        </ImplementationStageGlobalToolbar>
        <section data-testid="implementation-execution-board-panel">board</section>
        <div data-testid="prototype-generation-chat-panel">chat</div>
      </div>,
    );
    const toolbarIndex = html.indexOf("implementation-stage-global-toolbar");
    const boardIndex = html.indexOf("implementation-execution-board-panel");
    const chatIndex = html.indexOf("prototype-generation-chat-panel");
    expect(toolbarIndex).toBeGreaterThan(-1);
    expect(boardIndex).toBeGreaterThan(toolbarIndex);
    expect(chatIndex).toBeGreaterThan(boardIndex);
  });
});
