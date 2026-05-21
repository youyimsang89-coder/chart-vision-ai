import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getUserAnalysisLogs } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const logs = getUserAnalysisLogs(userId, 50);

  return NextResponse.json({
    success: true,
    logs: logs.map((l) => ({
      id: l.id,
      symbol: l.symbol,
      timeframe: l.timeframe,
      purpose: l.purpose,
      creditsUsed: l.creditsUsed,
      mode: l.mode,
      createdAt: l.createdAt,
    })),
  });
}
