import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db";

interface SignupBody {
  email: string;
  name: string;
  password: string;
}

export async function POST(req: NextRequest) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { email, name, password } = body;

  if (!email || !name || !password) {
    return NextResponse.json(
      { success: false, error: "모든 항목을 입력해주세요." },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { success: false, error: "올바른 이메일 형식이 아닙니다." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: "비밀번호는 최소 6자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (name.trim().length < 2) {
    return NextResponse.json(
      { success: false, error: "이름은 최소 2자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { success: false, error: "이미 사용 중인 이메일입니다." },
      { status: 409 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser(email.toLowerCase().trim(), name.trim(), passwordHash);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "회원가입에 실패했습니다.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
