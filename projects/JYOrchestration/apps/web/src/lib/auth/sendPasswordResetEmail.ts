/**
 * 비밀번호 재설정 메일 발송.
 * `RESEND_API_KEY`·`RESEND_FROM_EMAIL`이 있으면 Resend HTTP API로 전송하고,
 * 없으면 개발 환경에서만 콘솔에 링크를 남긴다(운영에서는 발송 실패로 간주).
 */
export async function trySendPasswordResetEmail(input: {
  readonly to: string;
  readonly resetUrl: string;
  readonly displayName?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- 개발 시 메일 미설정 안내
      console.warn("[auth] RESEND_API_KEY 없음 · 비밀번호 재설정 링크(개발 전용):", input.resetUrl);
    }
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `JY Orchestration <${from}>`,
        to: [input.to],
        subject: "[JY Orchestration] 비밀번호 재설정",
        html: `<p>${input.displayName ? `${escapeHtml(input.displayName)}님, ` : ""}비밀번호를 재설정하려면 아래 링크를 눌러 주세요.</p>
<p><a href="${escapeHtml(input.resetUrl)}">${escapeHtml(input.resetUrl)}</a></p>
<p>이 링크는 1시간 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
