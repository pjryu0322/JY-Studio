export type WorkingQueueControlIntent =
  | Readonly<{ kind: "approve_all" }>
  | Readonly<{ kind: "approve_one"; index: number }>
  | Readonly<{ kind: "approve_ids"; ids: readonly string[] }>
  | Readonly<{ kind: "defer_all" }>
  | Readonly<{ kind: "reject_all" }>
  | Readonly<{ kind: "defer_one"; index: number }>
  | Readonly<{ kind: "reject_one"; index: number }>;
