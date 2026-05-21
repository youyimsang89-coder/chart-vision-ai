export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getUserById, updateUserPasswordHash } from "@/lib/db";

function createTemporaryPassword() {
  const raw = crypto.randomBytes(9).toString("base64url");
  return `CV-${raw}`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  let body: { userId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  if (!body.userId || typeof body.userId !== "number") {
    return NextResponse.json(
      { success: false, error: "userId가 필요합니다." },
      { status: 400 }
    );
  }

  const user = await getUserById(body.userId);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "사용자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  await updateUserPasswordHash(user.id, passwordHash);

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    temporaryPassword,
  });
}
