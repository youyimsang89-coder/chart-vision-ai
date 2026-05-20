import { NextRequest, NextResponse } from "next/server";
import { analyzeChartWithAI } from "@/lib/analyze-chart";
import { AnalyzeChartRequest, AnalyzeChartResponse } from "@/lib/types";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3)) + 100;

function err(
  message: string,
  status: number
): NextResponse<AnalyzeChartResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeChartResponse>> {
  let body: AnalyzeChartRequest;

  try {
    body = (await request.json()) as AnalyzeChartRequest;
  } catch {
    return err("요청 본문이 올바른 JSON 형식이 아닙니다.", 400);
  }

  const { imageBase64, mimeType, options } = body;

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return err("이미지 데이터가 없습니다.", 400);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return err("파일 크기가 10MB를 초과합니다. 더 작은 이미지를 사용해주세요.", 400);
  }
  if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return err("허용되지 않는 파일 형식입니다. JPG, PNG, WEBP만 가능합니다.", 400);
  }
  if (!options || typeof options !== "object") {
    return err("분석 옵션이 없습니다.", 400);
  }

  const symbol = typeof options.symbol === "string" ? options.symbol.trim() : "";
  if (!symbol) return err("종목을 입력해주세요.", 400);

  const validTimeframes = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
  if (
    !validTimeframes.includes(
      options.timeframe as (typeof validTimeframes)[number]
    )
  ) {
    return err("올바른 타임프레임을 선택해주세요.", 400);
  }

  const validPurposes = ["scalping", "daytrading", "swing"] as const;
  if (!validPurposes.includes(options.purpose as (typeof validPurposes)[number])) {
    return err("올바른 분석 목적을 선택해주세요.", 400);
  }

  try {
    const { result, detected, mode, warning } = await analyzeChartWithAI(
      imageBase64,
      mimeType,
      {
        ...options,
        symbol: symbol.toUpperCase(),
      }
    );

    return NextResponse.json({
      success: true,
      mode,
      warning,
      result,
      data: result,
      detected,
    });
  } catch {
    return err("분석 중 알 수 없는 오류가 발생했습니다.", 500);
  }
}
