export async function probeHttpOk(url: string, opts?: { timeoutMs?: number }): Promise<{ ok: boolean; httpStatus?: number }> {
  const timeoutMs = Math.max(300, Math.min(8000, Math.floor(opts?.timeoutMs ?? 2500)));
  const u = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(u)) return { ok: false };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Use GET for compatibility (some hosts block HEAD)
    const res = await fetch(u, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "JYOrchestration/probe" },
    });
    return { ok: res.status >= 200 && res.status < 400, httpStatus: res.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

