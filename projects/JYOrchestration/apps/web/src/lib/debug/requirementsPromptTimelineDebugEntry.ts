/**
 * requirementsStateJson.promptTimeline → 디버그 PromptTimelineEntry.id
 * action 접두가 길고 createdAt이 같으면 slice(0,48)만으로는 충돌한다.
 */
export function buildRequirementsPromptTimelineDebugEntryId(input: {
  readonly createdAt: string;
  readonly action: string;
  readonly ordinal: number;
}): string {
  const atPart = String(input.createdAt || Date.now()).replace(/[^a-zA-Z0-9]/g, "");
  const actionSlug = String(input.action || "trace").replace(/[^a-zA-Z0-9_]/g, "");
  const actionTail = actionSlug.length > 36 ? actionSlug.slice(-36) : actionSlug;
  const ord = Math.max(0, Math.floor(input.ordinal));
  return `req_${atPart}_${actionTail}_${ord}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 96);
}
