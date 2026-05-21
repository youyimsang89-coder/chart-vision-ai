export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getUserById, updateUserPasswordHash } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { success: false, error: "현재 비밀번호와 새 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { success: false, error: "새 비밀번호는 8자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { success: false, error: "현재 비밀번호와 다른 새 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const userId = Number.parseInt(session.user.id, 10);
  const user = await getUserById(userId);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "사용자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const validCurrentPassword = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );

  if (!validCurrentPassword) {
    return NextResponse.json(
      { success: false, error: "현재 비밀번호가 일치하지 않습니다." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await updateUserPasswordHash(user.id, passwordHash);

  return NextResponse.json({
    success: true,
    message: "비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.",
  });
}
