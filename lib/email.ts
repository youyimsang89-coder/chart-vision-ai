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
      subject: "Chart Vision AI password reset",
      html: buildPasswordResetHtml(resetUrl),
      text: `Open this link to reset your Chart Vision AI password. This link is valid for 30 minutes.\n\n${resetUrl}`,
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
      <h2>Chart Vision AI password reset</h2>
      <p>Click the button below to set a new password.</p>
      <p>This link is valid for 30 minutes.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
          Reset password
        </a>
      </p>
      <p>If the button does not open, paste this URL into your browser.</p>
      <p style="word-break:break-all;color:#4b5563">${resetUrl}</p>
    </div>
  `;
}
