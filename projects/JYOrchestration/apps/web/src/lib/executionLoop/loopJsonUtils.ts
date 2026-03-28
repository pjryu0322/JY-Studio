/** 실행 루프에서 Task JSON 필드 파싱 */

export function parseCriteria(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export function parseStringArrayJson(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x ?? "").trim()).filter(Boolean);
}
