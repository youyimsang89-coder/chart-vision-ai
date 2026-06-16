export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  createSignalResult,
  getUserSignalResults,
  getUserSignalStats,
} from "@/lib/db";

// GET /api/signals — 목록 + 통계
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const [signals, stats] = await Promise.all([
    getUserSignalResults(userId, 100),
    getUserSignalStats(userId),
  ]);

  return NextResponse.json({ success: true, signals, stats });
}

// POST /api/signals — 새 시그널 등록
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  let body: {
    analysisLogId?: number;
    symbol: string;
    timeframe: string;
    purpose: string;
    longScore: number;
    shortScore: number;
    signalDirection?: "long" | "short";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.symbol || !body.timeframe || !body.purpose) {
    return NextResponse.json({ success: false, error: "종목, 타임프레임, 목적이 필요합니다." }, { status: 400 });
  }

  const signal = await createSignalResult(userId, body);
  return NextResponse.json({ success: true, signal });
}
