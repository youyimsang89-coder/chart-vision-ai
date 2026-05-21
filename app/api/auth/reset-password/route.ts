export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resetPasswordWithToken } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { token?: unknown; password?: unknown };

  try {
    body = (await request.json()) as { token?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json(
      { error: "재설정 토큰이 없습니다." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "비밀번호는 8자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const ok = await resetPasswordWithToken(token, passwordHash);

    if (!ok) {
      return NextResponse.json(
        { error: "링크가 만료되었거나 올바르지 않습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.",
    });
  } catch (error: unknown) {
    console.error("[reset-password]", {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "비밀번호 변경에 실패했습니다." },
      { status: 500 }
    );
  }
}
