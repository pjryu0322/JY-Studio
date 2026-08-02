/**
 * Prisma query counter for MEASURED evidence (P12.2).
 * Uses $extends query middleware; does not alter business behavior.
 */
import { Prisma, PrismaClient } from "@prisma/client";

export type PrismaQueryCountResult = {
  total: number;
  byModel: Record<string, number>;
  byOperation: Record<string, number>;
};

export function createCountingPrisma(base: PrismaClient): {
  client: PrismaClient;
  reset: () => void;
  snapshot: () => PrismaQueryCountResult;
} {
  let total = 0;
  const byModel: Record<string, number> = {};
  const byOperation: Record<string, number> = {};

  const client = base.$extends({
    name: "p12-2-query-counter",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          total += 1;
          const m = model ?? "raw";
          byModel[m] = (byModel[m] ?? 0) + 1;
          byOperation[operation] = (byOperation[operation] ?? 0) + 1;
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;

  return {
    client,
    reset: () => {
      total = 0;
      for (const k of Object.keys(byModel)) delete byModel[k];
      for (const k of Object.keys(byOperation)) delete byOperation[k];
    },
    snapshot: () => ({
      total,
      byModel: { ...byModel },
      byOperation: { ...byOperation },
    }),
  };
}

/** Fallback counter via $on('query') for clients that do not use $extends. */
export function attachPrismaQueryListener(client: PrismaClient): {
  reset: () => void;
  snapshot: () => PrismaQueryCountResult;
  detach: () => void;
} {
  let total = 0;
  const byModel: Record<string, number> = {};
  const byOperation: Record<string, number> = {};

  const handler = (e: Prisma.QueryEvent) => {
    total += 1;
    const target = String(e.target ?? "query");
    byModel[target] = (byModel[target] ?? 0) + 1;
    byOperation.query = (byOperation.query ?? 0) + 1;
  };

  // PrismaClient event typing varies by generated client; cast for listen.
  (client as unknown as { $on: (e: string, cb: (ev: Prisma.QueryEvent) => void) => void }).$on(
    "query",
    handler,
  );

  return {
    reset: () => {
      total = 0;
      for (const k of Object.keys(byModel)) delete byModel[k];
      for (const k of Object.keys(byOperation)) delete byOperation[k];
    },
    snapshot: () => ({
      total,
      byModel: { ...byModel },
      byOperation: { ...byOperation },
    }),
    detach: () => {
      /* Prisma $on cannot detach; reset is enough for test isolation. */
    },
  };
}
