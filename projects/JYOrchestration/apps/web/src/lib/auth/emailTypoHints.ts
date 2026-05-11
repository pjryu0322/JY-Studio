/** 자주 틀리는 메일 도메인 → 사용자에게만 힌트(서버 판별과 무관) */
export function getEmailDomainTypoHint(email: string): string | null {
  const t = String(email ?? "").trim().toLowerCase();
  const hints: readonly { re: RegExp; hint: string }[] = [
    { re: /@gamil\.com$/i, hint: "「gamil.com」이 아니라「gmail.com」이 맞는지 확인해 주세요." },
    { re: /@gmai\.com$/i, hint: "「gmai.com」이 아니라「gmail.com」이 맞는지 확인해 주세요." },
    { re: /@gmial\.com$/i, hint: "「gmial.com」이 아니라「gmail.com」이 맞는지 확인해 주세요." },
    { re: /@gmal\.com$/i, hint: "「gmal.com」이 아니라「gmail.com」이 맞는지 확인해 주세요." },
    { re: /@gnail\.com$/i, hint: "「gnail.com」이 아니라「gmail.com」이 맞는지 확인해 주세요." },
    { re: /@hotmai\.com$/i, hint: "「hotmai.com」이 아니라「hotmail.com」이 맞는지 확인해 주세요." },
    { re: /@hotmial\.com$/i, hint: "「hotmial.com」이 아니라「hotmail.com」이 맞는지 확인해 주세요." },
  ];
  for (const { re, hint } of hints) {
    if (re.test(t)) return hint;
  }
  return null;
}
