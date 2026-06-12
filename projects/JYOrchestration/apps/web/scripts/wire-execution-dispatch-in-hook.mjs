import fs from "fs";

const hookPath =
  "c:/project/JY-Studio/projects/JYOrchestration/apps/web/src/components/preview/usePrototypeImplementationStagePanel.tsx";
const lines = fs.readFileSync(hookPath, "utf8").split(/\r?\n/);

const switchStart = lines.findIndex((l) => l.trim() === 'switch (actionId) {');
const defaultIdx = lines.findIndex((l, i) => i > switchStart && l.trim().startsWith("default:"));
const switchEnd = lines.findIndex((l, i) => i > defaultIdx && l.trim() === "};");
// find closing of useCallback - switch ends with `      }` before `    },`

let switchClose = -1;
for (let i = defaultIdx; i < lines.length; i++) {
  if (lines[i].trim() === "}" && lines[i + 1]?.trim() === "},") {
    switchClose = i;
    break;
  }
  if (lines[i].trim() === "}" && lines[i + 1]?.trim() === "];") {
    // wrong
  }
  if (lines[i].match(/^\s+\}\s*$/) && lines[i + 1]?.match(/^\s+\],\s*$/)) {
    switchClose = i;
    break;
  }
}

// simpler: find line after default return that is `      }`
for (let i = defaultIdx; i < defaultIdx + 10; i++) {
  if (lines[i].trim() === "}") {
    switchClose = i;
    break;
  }
}

const replacement = `      const execution = dispatchExecutionStageAction(actionId, {
        projectId,
        parsedRequirementsState,
        pendingImplementationPatch,
        effectiveImplementationState,
        executionSetupRow,
        executionArtifacts,
        orchestrationAwareRequirementsState,
        requirementsStateJson,
        persistChatToDb,
        appendAiNoticeForImplementation,
        appendUserNotice,
        appendImplementationTaskListAiMessage,
        applyImplementationOrchestrationResult,
        applyPendingFromOrchestrationPatch,
        implementationCursorGate,
        prototypeRunSyncSnapshot,
        previewUrl,
        implementationStageBoardGateContext,
        boardManualPickTaskIdRef,
        codeTaskDispatchPreferredTaskIdRef,
        pendingQuickRunQueueDispatchRef,
        quickRunCodeTaskContinuationRef,
        requirementsStateJsonRef,
        dispatchNextQuickRunFromGithubVerify,
        appendImplementationExecutionNotice,
        enrichCodeTaskRunOrchestrationPatch,
        applyImplementationRuntimeFetch,
        persistedQueueDispatch,
        wipChipHandlers,
        setExecutionEnvironmentModalOpen,
      });
      if (execution) return execution;
      return { outcome: "blocked", message: "지원하지 않는 구현단계 action입니다." };`;

const newLines = [...lines.slice(0, switchStart), replacement, ...lines.slice(switchClose + 1)];
fs.writeFileSync(hookPath, newLines.join("\n"));
console.log("Replaced switch lines", switchStart + 1, "to", switchClose + 1);
