export type PrototypeWorkspaceFlowStep = Readonly<{
  id: string;
  title: string;
  purpose: string;
  primaryActorId: string;
  secondaryActorIds: readonly string[];
}>;

export type PrototypeWorkspaceActor = Readonly<{
  id: string;
  name: string;
  kind: "human" | "system";
  description?: string | null;
}>;

export type PrototypeWorkspaceIdeationAsset = Readonly<{ type?: string; title?: string; content?: string }>;
