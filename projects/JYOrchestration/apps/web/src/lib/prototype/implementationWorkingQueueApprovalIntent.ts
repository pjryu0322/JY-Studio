export type WorkingQueueControlIntent =
  | Readonly<{ kind: "approve_all" }>
  | Readonly<{ kind: "approve_one"; index: number }>
  | Readonly<{ kind: "approve_ids"; ids: readonly string[] }>
  | Readonly<{ kind: "defer_all" }>
  | Readonly<{ kind: "reject_all" }>
  | Readonly<{ kind: "defer_one"; index: number }>
  | Readonly<{ kind: "reject_one"; index: number }>;

const APPROVE_PATTERNS = [
  /^진행해$/i,
  /^모두\s*진행/i,
  /^전부\s*진행/i,
  /승인$/,
  /진행\s*해\s*주세요/,
  /진행\s*해\s*줘/,
];

const DEFER_PATTERNS = [/보류/, /나중에/, /다음에/, /미루/];

const REJECT_PATTERNS = [/취소/, /하지\s*마/, /거절/, /안\s*할/, /하지\s*않/];

export function parseWorkingQueueControlIntent(text: string): WorkingQueueControlIntent | null {
  const t = text.trim();
  if (!t) return null;

  for (const p of REJECT_PATTERNS) {
    if (p.test(t)) {
      const one = t.match(/(\d+)\s*번/);
      if (one) return { kind: "reject_one", index: Number(one[1]) - 1 };
      return { kind: "reject_all" };
    }
  }

  for (const p of DEFER_PATTERNS) {
    if (p.test(t)) {
      const one = t.match(/(\d+)\s*번/);
      if (one) return { kind: "defer_one", index: Number(one[1]) - 1 };
      return { kind: "defer_all" };
    }
  }

  for (const p of APPROVE_PATTERNS) {
    if (p.test(t)) {
      if (/모두|전부|all/i.test(t)) return { kind: "approve_all" };
      const one = t.match(/(\d+)\s*번\s*만?/);
      if (one) return { kind: "approve_one", index: Number(one[1]) - 1 };
      return { kind: "approve_all" };
    }
  }

  if (/^(\d+)\s*번\s*만\s*진행/.test(t)) {
    const m = t.match(/^(\d+)/);
    if (m) return { kind: "approve_one", index: Number(m[1]) - 1 };
  }

  return null;
}
