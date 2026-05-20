import { NextRequest, NextResponse } from "next/server";
import { verifyAccessPassword } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { accessPassword?: string };
  try {
    body = (await request.json()) as { accessPassword?: string };
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!verifyAccessPassword(body.accessPassword)) {
    return NextResponse.json(
      { success: false, error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true });
}
