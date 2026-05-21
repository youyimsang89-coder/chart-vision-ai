export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getAllUsers, getUserAnalysisLogs } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "admin")
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const users = await getAllUsers();

  const usersWithStats = await Promise.all(
    users.map(async (u) => {
      const logs = await getUserAnalysisLogs(u.id, 9999);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        credits: u.credits,
        createdAt: u.createdAt,
        totalAnalyses: logs.length,
      };
    })
  );

  return NextResponse.json({ users: usersWithStats });
}
