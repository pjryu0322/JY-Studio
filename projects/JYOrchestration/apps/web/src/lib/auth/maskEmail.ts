/** 로그인 ID(이메일) 안내용 마스킹 */
export function maskEmailForDisplay(email: string): string {
  const t = String(email ?? "").trim().toLowerCase();
  const at = t.indexOf("@");
  if (at < 1) return "***";
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  const head = local.slice(0, 2);
  const tail = local.slice(-1);
  return `${head}***${tail}@${domain}`;
}
