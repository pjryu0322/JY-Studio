export type PromptTimelineChannel = "openai" | "cursor";

export type PromptTimelineEntry = {
  readonly id: string;
  readonly at: string;
  readonly channel: PromptTimelineChannel;
  readonly label: string;
  readonly model?: string | null;
  readonly outbound: string;
  readonly inbound: string;
};
