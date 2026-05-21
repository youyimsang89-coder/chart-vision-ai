import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getAllUsers, getUserAnalysisLogs } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const users = getAllUsers();

  const result = users.map((u) => {
    const logs = getUserAnalysisLogs(u.id, 999);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      credits: u.credits,
      totalAnalyses: logs.length,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ success: true, users: result });
}
