type PasswordResetEmailParams = {
  to: string;
  resetUrl: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: PasswordResetEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("Email provider is not configured.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Chart Vision AI 비밀번호 재설정",
      html: buildPasswordResetHtml(resetUrl),
      text: `아래 링크에서 비밀번호를 재설정하세요. 이 링크는 30분 동안 유효합니다.\n\n${resetUrl}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Email send failed (${response.status}): ${body.slice(0, 200)}`);
  }
}

function buildPasswordResetHtml(resetUrl: string): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Chart Vision AI 비밀번호 재설정</h2>
      <p>아래 버튼을 눌러 새 비밀번호를 설정하세요.</p>
      <p>이 링크는 30분 동안만 유효합니다.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
          비밀번호 재설정
        </a>
      </p>
      <p>버튼이 열리지 않으면 아래 주소를 브라우저에 붙여넣으세요.</p>
      <p style="word-break:break-all;color:#4b5563">${resetUrl}</p>
    </div>
  `;
}
