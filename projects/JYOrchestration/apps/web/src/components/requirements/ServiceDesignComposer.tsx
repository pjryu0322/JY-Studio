"use client";

import type { MutableRefObject, ReactNode } from "react";
import type { RequirementsComposerTargetPickerItem, RequirementsComposerToolsMenu } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsComposerGpt } from "@/components/requirements/RequirementsComposerGpt";
import { ServiceFlowComposer } from "@/components/service-flow/ServiceFlowComposer";
import type { ServiceFlowActionMenuRenderContext } from "@/components/service-flow/ServiceFlowComposer";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import {
  buildServiceDesignHarnessPayload,
  type ServiceDesignHarnessPayload,
} from "@/lib/service-design/serviceDesignTurnPayload";

export type ServiceDesignComposerProps = {
  stage: RequirementsWorkspaceStage;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  disabled?: boolean;
  placeholder?: string;
  targetPickerItems: readonly RequirementsComposerTargetPickerItem[];
  onSendIdeation: (payload: ServiceDesignHarnessPayload) => void | Promise<void>;
  onSendServiceFlow: (payload: ServiceDesignHarnessPayload) => void | Promise<void>;
  onSendFeaturePlanning: (payload: ServiceDesignHarnessPayload) => void | Promise<void>;
  /** ideation(및 단계 폴백)에서 `RequirementsComposerGpt` + 메뉴 */
  ideationToolsMenu?: RequirementsComposerToolsMenu;
  /** ideation: 부모 포커스 제어(기존 `RequirementsIdeationChatPanel`) */
  textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  /** `stage === "service-flow"` 일 때 기존 `ServiceFlowComposer` 액션 메뉴·포커스 */
  serviceFlowChrome?: {
    readonly renderActionMenu: (ctx: ServiceFlowActionMenuRenderContext) => ReactNode;
    readonly actionsOpen: boolean;
    readonly onOpenActions: () => void;
    readonly onToolsOpenChange: (open: boolean) => void;
    readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  };
};

export function ServiceDesignComposer({
  stage,
  value,
  onChange,
  busy,
  disabled = false,
  placeholder,
  targetPickerItems,
  onSendIdeation,
  onSendServiceFlow,
  onSendFeaturePlanning,
  ideationToolsMenu,
  textAreaRef,
  serviceFlowChrome,
}: ServiceDesignComposerProps) {
  const submit = async () => {
    const harnessPayload = buildServiceDesignHarnessPayload(stage, value);
    if (stage === "ideation") await onSendIdeation(harnessPayload);
    else if (stage === "service-flow") await onSendServiceFlow(harnessPayload);
    else await onSendFeaturePlanning(harnessPayload);
  };

  const fireSend = () => {
    void submit();
  };

  if (stage === "service-flow") {
    const chrome = serviceFlowChrome;
    if (!chrome) {
      throw new Error("ServiceDesignComposer: serviceFlowChrome is required when stage is service-flow");
    }
    return (
      <ServiceFlowComposer
        value={value}
        onChange={onChange}
        onSubmit={fireSend}
        disabled={disabled}
        placeholder={placeholder}
        onOpenActions={chrome.onOpenActions}
        onToolsOpenChange={chrome.onToolsOpenChange}
        textAreaRef={chrome.textAreaRef}
        renderActionMenu={chrome.renderActionMenu}
        actionsOpen={chrome.actionsOpen}
        targetPickerItems={targetPickerItems}
      />
    );
  }

  return (
    <RequirementsComposerGpt
      textAreaRef={textAreaRef}
      value={value}
      onChange={onChange}
      onSend={fireSend}
      busy={busy}
      disabled={disabled}
      placeholder={placeholder}
      targetPickerItems={targetPickerItems}
      toolsMenu={ideationToolsMenu}
    />
  );
}
