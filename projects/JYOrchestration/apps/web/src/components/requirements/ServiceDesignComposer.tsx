"use client";

import type { MutableRefObject, ReactNode } from "react";
import type { RequirementsComposerTargetPickerItem, RequirementsComposerToolsMenu } from "@/components/requirements/RequirementsComposerGpt";
import { RequirementsComposerGpt } from "@/components/requirements/RequirementsComposerGpt";
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
  /** + 메뉴 커스텀(ideation에서 `RequirementsComposerGpt.plusMenuRender`로 전달) */
  plusMenuRender?: (ctx: { readonly close: () => void }) => ReactNode;
  /** ideation: 부모 포커스 제어(기존 `RequirementsIdeationChatPanel`) */
  textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
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
  plusMenuRender,
  textAreaRef,
}: ServiceDesignComposerProps) {
  const submit = async () => {
    const harnessPayload = buildServiceDesignHarnessPayload(stage, value);
    if (stage === "ideation" || stage === "product-definition") await onSendIdeation(harnessPayload);
    else if (stage === "service-flow") await onSendServiceFlow(harnessPayload);
    else await onSendFeaturePlanning(harnessPayload);
  };

  const fireSend = () => {
    void submit();
  };

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
      plusMenuRender={plusMenuRender}
      toolsMenu={stage === "ideation" && !plusMenuRender ? ideationToolsMenu : undefined}
    />
  );
}
