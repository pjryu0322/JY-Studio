/**
 * 프로젝트당 직렬 실행 — initialize / chat / reseed 가 동시에 OpenAI·저장을 두 번 돌지 않게 한다.
 */
const chain = new Map<string, Promise<unknown>>();

export function withFeaturePlanningProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const id = projectId.trim();
  if (!id) return fn();
  const prev = chain.get(id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => fn()) as Promise<T>;
  chain.set(id, next);
  return next.finally(() => {
    if (chain.get(id) === next) chain.delete(id);
  });
}
