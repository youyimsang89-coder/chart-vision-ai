import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { email: string; name: string; password: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 }); }

  const { email, name, password } = body;

  if (!email || !name || !password)
    return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });

  if (password.length < 8)
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });

  if (name.trim().length < 2)
    return NextResponse.json({ error: "이름은 2자 이상이어야 합니다." }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await getUserByEmail(normalizedEmail);
  if (existing)
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(normalizedEmail, name.trim(), passwordHash);
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, credits: user.credits },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "회원가입에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
