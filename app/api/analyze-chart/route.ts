export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { analyzeChartWithAI } from "@/lib/analyze-chart";
import { deductCredit, logAnalysis, getUserById, createSignalResult } from "@/lib/db";
import type { AnalyzeChartResponse, AnalysisOptions, MarketPriceContext } from "@/lib/types";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg","image/jpg","image/png","image/webp"]);
const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3)) + 100;
const UPBIT_TICKER_URL = "https://api.upbit.com/v1/ticker?markets=KRW-BTC";

function err(message: string, status: number): NextResponse<AnalyzeChartResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isBitcoinSymbol(symbol: string): boolean {
  return symbol.toUpperCase().includes("BTC");
}

async function fetchBtcKrwPriceContext(): Promise<MarketPriceContext | undefined> {
  try {
    const response = await fetch(UPBIT_TICKER_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return undefined;

    const data = (await response.json()) as Array<{ market?: string; trade_price?: number }>;
    const ticker = Array.isArray(data) ? data[0] : undefined;
    if (!ticker || ticker.market !== "KRW-BTC" || typeof ticker.trade_price !== "number") {
      return undefined;
    }

    return {
      symbol: "BTC",
      market: "KRW-BTC",
      price: ticker.trade_price,
      currency: "KRW",
      source: "Upbit",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeChartResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("로그인이 필요합니다.", 401);

  const userId = parseInt(session.user.id, 10);
  const user = await getUserById(userId);
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
    const marketPrice = isBitcoinSymbol(analysisOptions.symbol)
      ? await fetchBtcKrwPriceContext()
      : undefined;
    const { result, detected, mode, warning } = await analyzeChartWithAI(imageBase64, mimeType, analysisOptions, marketPrice);

    await deductCredit(userId);
    const [logResult] = await Promise.all([
      logAnalysis(userId, symbol.toUpperCase(), options.timeframe, options.purpose, mode),
    ]);

    // 분석 완료 시 시그널 트래킹 자동 등록 (결과 미결 상태로)
    let signalId: number | undefined;
    try {
      const signal = await createSignalResult(userId, {
        symbol: symbol.toUpperCase(),
        timeframe: options.timeframe,
        purpose: options.purpose,
        longScore: result.longScore,
        shortScore: result.shortScore,
      });
      signalId = signal.id;
    } catch {
      // 시그널 등록 실패는 분석 결과에 영향 없음
    }

    void logResult;

    const freshUser = await getUserById(userId);
    const remainingCredits = freshUser?.credits ?? 0;

    return NextResponse.json({ success: true, mode, warning, result, data: result, detected, remainingCredits, signalId });
  } catch {
    return err("분석 중 알 수 없는 오류가 발생했습니다.", 500);
  }
}
