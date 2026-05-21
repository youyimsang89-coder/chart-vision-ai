export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { addCredits } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "admin")
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  let body: { userId: number; amount: number; reason: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 }); }

  const { userId, amount, reason } = body;
  if (!userId || typeof amount !== "number" || amount === 0)
    return NextResponse.json({ error: "올바른 userId와 amount를 입력해주세요." }, { status: 400 });

  const adminId = parseInt(session.user.id, 10);
  const result = await addCredits(userId, amount, reason || "관리자 충전", adminId);

  if (!result.success)
    return NextResponse.json({ error: "크레딧 충전에 실패했습니다." }, { status: 500 });

  return NextResponse.json({ success: true, newCredits: result.newCredits });
}
