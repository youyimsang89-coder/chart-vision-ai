import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { analyzeChartWithAI } from "@/lib/analyze-chart";
import { deductCredit, logAnalysis, getUserById } from "@/lib/db";
import type { AnalyzeChartResponse, AnalysisOptions } from "@/lib/types";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg","image/jpg","image/png","image/webp"]);
const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3)) + 100;

function err(message: string, status: number): NextResponse<AnalyzeChartResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeChartResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("로그인이 필요합니다.", 401);

  const userId = parseInt(session.user.id, 10);
  const user = getUserById(userId);
  if (!user) return err("사용자 정보를 찾을 수 없습니다.", 401);

  if (user.credits <= 0)
    return err("분석 크레딧이 부족합니다. 관리자에게 충전을 요청하세요.", 402);

  let body: { imageBase64: string; mimeType: string; options: AnalysisOptions };
  try { body = await request.json(); }
  catch { return err("요청 본문이 올바른 JSON 형식이 아닙니다.", 400); }

  const { imageBase64, mimeType, options } = body;

  if (typeof imageBase64 !== "string" || imageBase64.length === 0)
    return err("이미지 데이터가 없습니다.", 400);
  if (imageBase64.length > MAX_BASE64_CHARS)
    return err("파일 크기가 10MB를 초과합니다.", 400);
  if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType))
    return err("허용되지 않는 파일 형식입니다. JPG, PNG, WEBP만 가능합니다.", 400);
  if (!options || typeof options !== "object")
    return err("분석 옵션이 없습니다.", 400);

  const symbol = typeof options.symbol === "string" ? options.symbol.trim() : "";
  if (!symbol) return err("종목을 입력해주세요.", 400);

  const validTimeframes = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
  if (!validTimeframes.includes(options.timeframe))
    return err("올바른 타임프레임을 선택해주세요.", 400);

  const validPurposes = ["scalping", "daytrading", "swing"] as const;
  if (!validPurposes.includes(options.purpose))
    return err("올바른 분석 목적을 선택해주세요.", 400);

  try {
    const analysisOptions: AnalysisOptions = { symbol: symbol.toUpperCase(), timeframe: options.timeframe, purpose: options.purpose };
    const { result, detected, mode, warning } = await analyzeChartWithAI(imageBase64, mimeType, analysisOptions);

    deductCredit(userId);
    logAnalysis(userId, symbol.toUpperCase(), options.timeframe, options.purpose, mode);

    const freshUser = getUserById(userId);
    const remainingCredits = freshUser?.credits ?? 0;

    return NextResponse.json({ success: true, mode, warning, result, data: result, detected, remainingCredits });
  } catch {
    return err("분석 중 알 수 없는 오류가 발생했습니다.", 500);
  }
}
