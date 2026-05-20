import { NextRequest, NextResponse } from "next/server";
import { detectChartMetaWithAI } from "@/lib/analyze-chart";
import { DetectChartMetaRequest, DetectChartMetaResponse } from "@/lib/types";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** 10 MB base64 상한 */
const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3)) + 100;

function err(
  message: string,
  status: number
): NextResponse<DetectChartMetaResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<DetectChartMetaResponse>> {
  let body: DetectChartMetaRequest;
  try {
    body = (await request.json()) as DetectChartMetaRequest;
  } catch {
    return err("요청 본문이 올바른 JSON 형식이 아닙니다.", 400);
  }

  const { imageBase64, mimeType } = body;

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return err("이미지 데이터가 없습니다.", 400);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return err("이미지 크기가 너무 큽니다.", 400);
  }
  if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return err("허용되지 않는 파일 형식입니다.", 400);
  }

  try {
    const detected = await detectChartMetaWithAI(imageBase64, mimeType);
    return NextResponse.json({ success: true, detected });
  } catch {
    // 자동 감지 실패는 치명적이지 않음 — 빈 결과 반환
    return NextResponse.json({ success: true, detected: {} });
  }
}
