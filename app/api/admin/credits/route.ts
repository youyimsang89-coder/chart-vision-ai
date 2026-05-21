import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { addCredits, getUserById } from "@/lib/db";

interface AddCreditsBody {
  userId: number;
  amount: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  let body: AddCreditsBody;
  try {
    body = (await req.json()) as AddCreditsBody;
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { userId, amount, reason } = body;

  if (!userId || typeof userId !== "number") {
    return NextResponse.json({ success: false, error: "올바른 사용자 ID가 필요합니다." }, { status: 400 });
  }

  if (!amount || typeof amount !== "number" || amount === 0) {
    return NextResponse.json(
      { success: false, error: "유효한 충전 금액을 입력해주세요." },
      { status: 400 }
    );
  }

  if (Math.abs(amount) > 10000) {
    return NextResponse.json(
      { success: false, error: "1회 최대 충전량은 10,000 크레딧입니다." },
      { status: 400 }
    );
  }

  const targetUser = getUserById(userId);
  if (!targetUser) {
    return NextResponse.json({ success: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const adminId = parseInt(session.user.id, 10);
  const finalReason = reason?.trim() || (amount > 0 ? "관리자 수동 충전" : "관리자 수동 차감");
  const { newCredits } = addCredits(userId, amount, finalReason, adminId);

  return NextResponse.json({
    success: true,
    userId,
    amount,
    newCredits,
    message: `${targetUser.name}(${targetUser.email})님에게 ${amount > 0 ? `+${amount}` : amount} 크레딧 ${amount > 0 ? "충전" : "차감"}되었습니다.`,
  });
}
