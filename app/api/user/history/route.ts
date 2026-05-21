export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getUserAnalysisLogs } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const logs = await getUserAnalysisLogs(userId, 50);
  return NextResponse.json({ logs });
}
