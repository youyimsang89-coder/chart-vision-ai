export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { resolveSignalResult } from "@/lib/db";

// PATCH /api/signals/[id] — 결과 기록
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const signalId = parseInt(params.id, 10);
  if (isNaN(signalId)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  let body: { outcome: "win" | "loss" | "break_even"; signalDirection: "long" | "short"; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const valid = ["win", "loss", "break_even"];
  if (!valid.includes(body.outcome)) return NextResponse.json({ success: false, error: "outcome은 win/loss/break_even 중 하나." }, { status: 400 });
  if (!["long", "short"].includes(body.signalDirection)) return NextResponse.json({ success: false, error: "signalDirection은 long/short 중 하나." }, { status: 400 });

  const updated = await resolveSignalResult(signalId, userId, body.outcome, body.signalDirection, body.note);
  if (!updated) return NextResponse.json({ success: false, error: "시그널을 찾을 수 없거나 권한이 없습니다." }, { status: 404 });

  return NextResponse.json({ success: true, signal: updated });
}
