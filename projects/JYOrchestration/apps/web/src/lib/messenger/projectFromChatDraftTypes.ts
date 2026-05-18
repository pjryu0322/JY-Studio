export type ProjectFromChatDraftPayloadV1 = Readonly<{
  version: 1;
  titleCandidates: readonly string[];
  chosenTitle: string;
  description: string;
  problem: string;
  targetUsers: string;
  valueProposition: string;
  mvpScope: string;
  explicitExclusions: string;
  featureCandidates: readonly string[];
  openQuestions: readonly string[];
  assumptions: readonly string[];
  confirmedFacts: readonly string[];
  recommendedAiMembers: readonly string[];
  nextSteps: readonly string[];
}>;
