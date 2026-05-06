"use client";

import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import { RequirementsDraftDocumentDrawer } from "@/components/requirements/RequirementsDraftDocumentDrawer";
import { RequirementsPromptDocumentDrawer } from "@/components/requirements/RequirementsPromptDocumentDrawer";
import { RequirementsSummaryModal } from "@/components/requirements/RequirementsSummaryModal";
import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type RequirementsIdeationDocumentDrawersProps = Readonly<{
  promptDrawerOpen: boolean;
  onClosePromptDrawer: () => void;
  lastPromptView: RequirementsPromptPresenterView | null;
  lastPromptText?: string | null;
  lastPromptGeneratedAt?: string | null;
  promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  ideationConversationForPromptExport: readonly RequirementsMessage[] | null;
  exportBaseName: string;
  summaryModalOpen: boolean;
  onCloseSummaryModal: () => void;
  goals: string;
  targetUsers: string;
  scopeIn: string;
  scopeOut: string;
  openIssues: string;
  success: string;
  onGoalsChange: (v: string) => void;
  onTargetUsersChange: (v: string) => void;
  onScopeInChange: (v: string) => void;
  onScopeOutChange: (v: string) => void;
  onOpenIssuesChange: (v: string) => void;
  onSuccessChange: (v: string) => void;
  onSummaryBlurSave: () => void | Promise<void>;
  draftDrawerOpen: boolean;
  onCloseDraftDrawer: () => void;
  draftDoc: RequirementsDraftDoc | null;
  deliverableViewerOpen: boolean;
  onCloseDeliverableViewer: () => void;
  deliverableViewerAssets: readonly IdeationDeliverableAsset[];
  deliverableViewerFocusId: string | null;
}>;

export function RequirementsIdeationDocumentDrawers({
  promptDrawerOpen,
  onClosePromptDrawer,
  lastPromptView,
  lastPromptText,
  lastPromptGeneratedAt,
  promptTimeline,
  ideationConversationForPromptExport,
  exportBaseName,
  summaryModalOpen,
  onCloseSummaryModal,
  goals,
  targetUsers,
  scopeIn,
  scopeOut,
  openIssues,
  success,
  onGoalsChange,
  onTargetUsersChange,
  onScopeInChange,
  onScopeOutChange,
  onOpenIssuesChange,
  onSuccessChange,
  onSummaryBlurSave,
  draftDrawerOpen,
  onCloseDraftDrawer,
  draftDoc,
  deliverableViewerOpen,
  onCloseDeliverableViewer,
  deliverableViewerAssets,
  deliverableViewerFocusId,
}: RequirementsIdeationDocumentDrawersProps) {
  return (
    <>
      <RequirementsPromptDocumentDrawer
        open={promptDrawerOpen}
        onClose={onClosePromptDrawer}
        view={lastPromptView}
        lastPromptText={lastPromptText}
        lastPromptGeneratedAt={lastPromptGeneratedAt}
        promptTimeline={promptTimeline}
        conversationMessages={ideationConversationForPromptExport}
        exportBaseName={exportBaseName}
      />

      <RequirementsSummaryModal
        open={summaryModalOpen}
        onClose={onCloseSummaryModal}
        goals={goals}
        targetUsers={targetUsers}
        scopeIn={scopeIn}
        scopeOut={scopeOut}
        openIssues={openIssues}
        success={success}
        onGoalsChange={onGoalsChange}
        onTargetUsersChange={onTargetUsersChange}
        onScopeInChange={onScopeInChange}
        onScopeOutChange={onScopeOutChange}
        onOpenIssuesChange={onOpenIssuesChange}
        onSuccessChange={onSuccessChange}
        onBlurSave={() => void onSummaryBlurSave()}
      />

      {draftDoc ? (
        <RequirementsDraftDocumentDrawer
          open={draftDrawerOpen}
          onClose={onCloseDraftDrawer}
          draft={draftDoc}
          exportBaseName={exportBaseName}
        />
      ) : null}

      <RequirementsDeliverableViewerModal
        open={deliverableViewerOpen}
        onClose={onCloseDeliverableViewer}
        assets={deliverableViewerAssets}
        initialAssetId={deliverableViewerFocusId}
      />
    </>
  );
}
