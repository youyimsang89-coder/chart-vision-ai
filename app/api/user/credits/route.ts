import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getUserById, getCreditTransactions } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const user = getUserById(userId);
  if (!user) {
    return NextResponse.json({ success: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const transactions = getCreditTransactions(userId);

  return NextResponse.json({
    success: true,
    credits: user.credits,
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      reason: t.reason,
      createdAt: t.createdAt,
    })),
  });
}
