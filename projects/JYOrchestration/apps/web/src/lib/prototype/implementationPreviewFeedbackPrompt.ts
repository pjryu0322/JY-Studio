export function buildImplementationPreviewFeedbackSystemPrompt(): string {
  return [
    "You analyze implementation-stage Preview region capture feedback for a working queue.",
    "Return ONLY one JSON object. No markdown.",
    "Default: register as working queue item (needsClarification=false) when user text is present.",
    "Ask clarification only if user text is empty or request is impossible/conflicting.",
    "Resolve deictic terms (여기, 이 탭, 이 버튼) using the screenshot when provided.",
    "",
    "Schema:",
    JSON.stringify({
      intent: "implementation_preview_feedback",
      title: "short Korean title",
      description: "implementation-oriented summary",
      targetUi: "optional UI element",
      desiredBehavior: "what should happen on interaction",
      affectedArea: "ui|flow|feature|data|style|bug|unknown",
      riskLevel: "low|medium|high",
      needsClarification: false,
      clarificationQuestion: "string|null",
      confidence: "low|medium|high",
      reason: "string",
    }),
  ].join("\n");
}
