export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

function getBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    new URL(request.url).origin
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown };

  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "올바른 이메일을 입력해주세요." },
      { status: 400 }
    );
  }

  const message =
    "가입된 이메일이면 비밀번호 재설정 링크를 발송했습니다.";

  try {
    const reset = await createPasswordResetToken(email);
    if (reset) {
      const resetUrl = `${getBaseUrl(request)}/auth/reset-password?token=${reset.token}`;
      await sendPasswordResetEmail({ to: reset.user.email, resetUrl });
    }

    return NextResponse.json({ success: true, message });
  } catch (error: unknown) {
    console.error("[forgot-password]", {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "비밀번호 재설정 메일 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
