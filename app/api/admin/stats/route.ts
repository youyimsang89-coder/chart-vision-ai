import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getAdminStats, getAllAnalysisLogs } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "admin")
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const [stats, recentLogs] = await Promise.all([
    getAdminStats(),
    getAllAnalysisLogs(20),
  ]);

  return NextResponse.json({ stats, recentLogs });
}
