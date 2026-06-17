import {
  AnalysisMode,
  AnalysisOptions,
  AnalysisProvider,
  AnalysisResult,
  DetectedChartMeta,
  MarketPriceContext,
  Timeframe,
} from "./types";

type ProviderResult = {
  result: AnalysisResult;
  mode: AnalysisMode;
  warning?: string;
  detected?: DetectedChartMeta;
};

type ClaudeContentBlock =
  | { type: "text"; text?: string }
  | { type: "tool_use"; name?: string; input?: unknown };

type ClaudeMessageResponse = {
  content?: ClaudeContentBlock[];
};

type ClaudeErrorBody = {
  error?: { type?: string; message?: string };
};

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-latest";
const CLAUDE_ANALYSIS_TIMEOUT_MS = 45_000;
const CLAUDE_META_TIMEOUT_MS = 15_000;
const VALID_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D"];

const MOCK_RESULTS: AnalysisResult[] = [
  {
    trend: "상승 추세",
    supportLevels: ["67,500", "66,000"],
    resistanceLevels: ["69,200", "70,500"],
    pattern: "상승 채널",
    longView:
      "주요 저항 돌파 후 지지 전환이 확인되면 롱 관점을 참고할 수 있습니다.",
    longScore: 72,
    shortView:
      "직전 지지 이탈과 약세 캔들이 함께 확인되면 단기 조정 가능성을 참고할 수 있습니다.",
    shortScore: 38,
    riskSummary:
      "거래량이 부족한 돌파는 실패 가능성이 있습니다. 본 분석은 참고용이며 투자 조언이 아닙니다.",
    confidence: 76,
  },
  {
    trend: "횡보",
    supportLevels: ["65,000", "63,800"],
    resistanceLevels: ["67,200", "68,500"],
    pattern: "대칭 삼각형",
    longView:
      "상단 돌파와 거래량 증가가 동반되면 상승 시나리오를 참고할 수 있습니다.",
    longScore: 52,
    shortView:
      "하단 이탈 시 박스권 하방 돌파 가능성을 검토할 수 있습니다.",
    shortScore: 48,
    riskSummary:
      "수렴 구간에서는 방향성이 불확실합니다. 확정적 판단보다 돌파 이후 확인이 중요합니다.",
    confidence: 61,
  },
  {
    trend: "하락 추세",
    supportLevels: ["62,000", "60,500"],
    resistanceLevels: ["64,800", "66,000"],
    pattern: "하락 쐐기",
    longView:
      "하단 지지와 과매도 신호가 함께 보이면 제한적 반등 가능성을 참고할 수 있습니다.",
    longScore: 31,
    shortView:
      "주요 저항 실패와 약세 캔들이 확인되면 하락 지속 시나리오를 검토할 수 있습니다.",
    shortScore: 74,
    riskSummary:
      "전체 흐름은 약세입니다. 추격 진입은 위험할 수 있으며 포지션 크기 관리가 필요합니다.",
    confidence: 83,
  },
];

const PURPOSE_LABELS: Record<AnalysisOptions["purpose"], string> = {
  scalping: "스캘핑",
  daytrading: "데이 트레이딩",
  swing: "스윙",
};

const ANALYSIS_TOOL = {
  name: "return_chart_analysis",
  description: "Return a structured chart analysis result with TP/SL levels and candlestick patterns.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      detectedSymbol: { type: ["string", "null"] },
      detectedTimeframe: {
        type: ["string", "null"],
        enum: ["1m", "5m", "15m", "1h", "4h", "1D", null],
      },
      trend: { type: "string" },
      supportLevels: { type: "array", items: { type: "string" } },
      resistanceLevels: { type: "array", items: { type: "string" } },
      pattern: { type: "string" },
      candlePatterns: {
        type: "array",
        items: { type: "string" },
        description: "List of detected candlestick patterns in Korean (e.g. 망치형, 도지, 상승 삼병법, 하락 장악형, 샛별형, 저녁별형, 핀바)"
      },
      longView: { type: "string" },
      longScore: { type: "number", minimum: 0, maximum: 100 },
      shortView: { type: "string" },
      shortScore: { type: "number", minimum: 0, maximum: 100 },
      riskSummary: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 100 },
      entryZoneLong: {
        type: ["string", "null"],
        description: "Long entry price zone string (e.g. '67,200 ~ 67,500'). Null if chart trend doesn't favor a long."
      },
      entryZoneShort: {
        type: ["string", "null"],
        description: "Short entry price zone string (e.g. '69,000 ~ 69,300'). Null if chart trend doesn't favor a short."
      },
      tp1Long: {
        type: ["string", "null"],
        description: "Long TP1: first UPSIDE target above long entry (nearby resistance). Null if no long setup."
      },
      tp2Long: {
        type: ["string", "null"],
        description: "Long TP2: second UPSIDE target further above TP1. Null if no long setup."
      },
      stopLossLong: {
        type: ["string", "null"],
        description: "Long stop-loss: price BELOW long entry based on swing low or key support. Null if no long setup."
      },
      riskRewardLong: {
        type: ["string", "null"],
        description: "Long R:R ratio string (e.g. '1:2.5') from long entry to TP1 vs stop loss. Null if no long setup."
      },
      tp1Short: {
        type: ["string", "null"],
        description: "Short TP1: first DOWNSIDE target below short entry (nearby support). Price must be LOWER than entry. Null if no short setup."
      },
      tp2Short: {
        type: ["string", "null"],
        description: "Short TP2: second DOWNSIDE target further below TP1. Price must be LOWER than TP1. Null if no short setup."
      },
      stopLossShort: {
        type: ["string", "null"],
        description: "Short stop-loss: price ABOVE short entry based on swing high or key resistance. Null if no short setup."
      },
      riskRewardShort: {
        type: ["string", "null"],
        description: "Short R:R ratio string (e.g. '1:2.0') from short entry to TP1Short vs stopLossShort. Null if no short setup."
      },
      higherTimeframeContext: {
        type: ["string", "null"],
        description: "Brief comment on the implied higher-timeframe trend context visible in the chart (e.g. 일봉 상승 추세 유지, 4H 저항 근처). 1-2 sentences."
      },
    },
    required: [
      "detectedSymbol",
      "detectedTimeframe",
      "trend",
      "supportLevels",
      "resistanceLevels",
      "pattern",
      "candlePatterns",
      "longView",
      "longScore",
      "shortView",
      "shortScore",
      "riskSummary",
      "confidence",
      "entryZoneLong",
      "tp1Long",
      "tp2Long",
      "stopLossLong",
      "riskRewardLong",
      "entryZoneShort",
      "tp1Short",
      "tp2Short",
      "stopLossShort",
      "riskRewardShort",
      "higherTimeframeContext",
    ],
  },
} as const;

const META_TOOL = {
  name: "return_chart_meta",
  description: "Return detected chart symbol and timeframe.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      detectedSymbol: { type: ["string", "null"] },
      detectedTimeframe: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 100 },
    },
    required: ["detectedSymbol", "detectedTimeframe", "confidence"],
  },
} as const;

class MockProvider implements AnalysisProvider {
  async analyze(): Promise<ProviderResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { result: getMockResult(), mode: "mock" };
  }
}

class ClaudeProvider implements AnalysisProvider {
  constructor(private readonly apiKey: string) {}

  async analyze(
    imageBase64: string,
    mimeType: string,
    options: AnalysisOptions,
    marketPrice?: MarketPriceContext
  ): Promise<ProviderResult> {
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL;

    try {
      const response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        signal: AbortSignal.timeout(CLAUDE_ANALYSIS_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          temperature: 0,
          system: buildAnalysisSystemPrompt(),
          tools: [ANALYSIS_TOOL],
          tool_choice: { type: "tool", name: ANALYSIS_TOOL.name },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: imageBase64,
                  },
                },
                { type: "text", text: buildAnalysisUserPrompt(options, marketPrice) },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        await logClaudeHttpError(response, model);
        return createFallbackProviderResult(
          options,
          warningForClaudeStatus(response.status)
        );
      }

      const json = (await response.json()) as ClaudeMessageResponse;
      const raw = getToolInput(json, ANALYSIS_TOOL.name) ?? getTextJsonInput(json);
      if (!raw) {
        return createFallbackProviderResult(
          options,
          "Claude response was empty. Mock result returned."
        );
      }

      const normalized = validateAndNormalizeProviderResult(raw, options);
      return { ...normalized, mode: "claude" };
    } catch (error) {
      logClaudeNetworkError(error, model);
      return createFallbackProviderResult(options, warningForNetworkError(error));
    }
  }
}

function buildAnalysisSystemPrompt(): string {
  return `You are a professional chart image analysis assistant specializing in technical analysis.
The chart may be for stocks, crypto, futures, ETFs, indices, or forex. Analyze what is visible in the image; do not assume it is crypto-only.
Use the provided tool to return a structured result.
The output is reference-only technical analysis, not investment advice.
Do not use definitive buy/sell instructions or guaranteed profit language.
If a current market price context is provided, use it to keep BTC/KRW price levels on the correct scale. Do not invent stale BTC/KRW prices.
Use conditional Korean wording such as "확인되면", "참고할 수 있습니다", "가능성이 있습니다".
Analyze both long and short scenarios. Do not claim one side is certain.

ADVANCED ANALYSIS REQUIREMENTS:
1. Candlestick patterns: Identify specific candlestick patterns visible in the chart (e.g., 망치형, 역망치형, 도지, 핀바, 상승 삼병법, 하락 삼병법, 샛별형, 저녁별형, 상승 장악형, 하락 장악형, 상승 집게형, 하락 집게형). Return as an array. Empty array if none are clear.
2. Entry zones: Based on the chart structure, suggest a reasonable entry price zone for both long and short scenarios. Use key support/resistance levels. Return null if no clear setup.
3. TP/SL levels: Calculate TP1 (first target), TP2 (second target), and StopLoss based on the chart structure (swing highs/lows, key levels, measured moves). These should be derived from what's visible in the chart.
4. Risk/Reward: Calculate the R:R ratio from the mid-point of entry zone to TP1 vs StopLoss. Format as "1:X.X".
5. Higher timeframe context: Describe what the implied higher timeframe trend looks like based on the overall chart structure visible.`;
}

function buildAnalysisUserPrompt(
  options: AnalysisOptions,
  marketPrice?: MarketPriceContext
): string {
  const marketPricePrompt = marketPrice
    ? `
현재 시세 기준:
- ${marketPrice.symbol} ${marketPrice.market}: ${marketPrice.price.toLocaleString("ko-KR")} ${marketPrice.currency}
- 출처: ${marketPrice.source}
- 조회 시각: ${marketPrice.fetchedAt}

BTC 원화 가격대를 언급할 때는 위 현재가와 같은 스케일을 사용하세요. 현재가가 9천만원대라면 지지/저항도 차트에서 명확히 보이는 경우가 아니라면 1억1천만원대처럼 멀리 벗어난 값으로 쓰지 마세요. 차트가 USDT/USD 기준이면 가격 문자열에 USDT/USD 단위를 붙이고, KRW로 환산해 말할 때만 위 KRW 현재가를 기준으로 보정하세요.
`
    : "";

  return `현재 사용자가 선택한 값:
종목: ${options.symbol}
타임프레임: ${options.timeframe}
분석 목적: ${PURPOSE_LABELS[options.purpose]}
${marketPricePrompt}

이미지에서 보이는 종목과 타임프레임을 먼저 읽고, 차트 구조를 분석해주세요.

[기본 분석]
- supportLevels, resistanceLevels: 이미지에서 읽히는 주요 가격대만 문자열 배열로 반환
- pattern: 전체 차트 패턴 (예: 상승 채널, 삼각수렴, 헤드앤숄더 등)
- trend: 현재 추세 방향과 강도
- confidence: 차트 구조를 얼마나 명확히 읽었는지 0-100 점수 (롱/숏 성공률 아님)
- longScore/shortScore: 각 시나리오의 유리함 0-100 (합이 100일 필요 없음, 독립 평가)

[고급 분석 - 중요]
- candlePatterns: 최근 캔들스틱 패턴 감지 (망치형, 도지, 핀바, 상승 삼병법 등). 명확한 것만.
- entryZoneLong: 롱 진입 구간 (지지 기반). 롱이 불리하면 null.
- tp1Long: 롱 1차 목표가 — 진입보다 위의 가까운 저항. 반드시 entryZoneLong보다 높아야 함.
- tp2Long: 롱 2차 목표가 — tp1Long보다 더 위. 반드시 tp1Long보다 높아야 함.
- stopLossLong: 롱 손절가 — 진입보다 아래 스윙로우/주요지지. 반드시 entryZoneLong보다 낮아야 함.
- riskRewardLong: 롱 R:R 비율 (예: "1:2.3"). 없으면 null.
- entryZoneShort: 숏 진입 구간 (저항 기반). 숏이 불리하면 null.
- tp1Short: 숏 1차 목표가 — 진입보다 아래의 가까운 지지. 반드시 entryZoneShort보다 낮아야 함.
- tp2Short: 숏 2차 목표가 — tp1Short보다 더 아래. 반드시 tp1Short보다 낮아야 함.
- stopLossShort: 숏 손절가 — 진입보다 위 스윙하이/주요저항. 반드시 entryZoneShort보다 높아야 함.
- riskRewardShort: 숏 R:R 비율 (예: "1:2.0"). 없으면 null.
- higherTimeframeContext: 차트에서 보이는 상위 타임프레임 컨텍스트 1-2문장`;
}

function buildMetaPrompt(): string {
  return `이미지에서 보이는 트레이딩 종목과 캔들 타임프레임만 읽어주세요.
예: AAPL, TSLA, 005930, 005930.KS, KOSPI, SPY, BTCUSDT, BTCUSDT.P, BTC/USDT, BINANCE:BTCUSDT, 1m, 5m, 15m, 1h, 4h, 1D.
확실하지 않으면 null을 반환하세요.`;
}

function getToolInput(json: ClaudeMessageResponse, toolName: string): unknown | null {
  const content = json.content;
  if (!Array.isArray(content)) return null;

  const toolUse = content.find(
    (block) => block.type === "tool_use" && block.name === toolName
  );
  return toolUse?.type === "tool_use" ? toolUse.input ?? null : null;
}

function getTextJsonInput(json: ClaudeMessageResponse): unknown | null {
  const content = json.content;
  if (!Array.isArray(content)) return null;

  const text = content.find(
    (block) => block.type === "text" && typeof block.text === "string"
  );
  if (text?.type !== "text" || !text.text) return null;

  return parseLooseJson(text.text);
}

function parseLooseJson(content: string): unknown | null {
  const cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function validateAndNormalizeProviderResult(
  raw: unknown,
  options: AnalysisOptions
): Omit<ProviderResult, "mode" | "warning"> {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid Claude response shape.");
  }

  const value = raw as Record<string, unknown>;
  const result: AnalysisResult = {
    trend: readText(value.trend, "추세 판단 불가"),
    supportLevels: readStringArray(value.supportLevels),
    resistanceLevels: readStringArray(value.resistanceLevels),
    pattern: readText(value.pattern, "명확한 패턴 없음"),
    candlePatterns: readStringArray(value.candlePatterns),
    longView: readText(
      value.longView,
      "롱 관점은 지지/저항 재확인 후 참고할 수 있습니다."
    ),
    longScore: normalizeConfidence(value.longScore),
    shortView: readText(
      value.shortView,
      "숏 관점은 이탈 여부 확인 후 참고할 수 있습니다."
    ),
    shortScore: normalizeConfidence(value.shortScore),
    riskSummary: readText(
      value.riskSummary,
      "본 분석은 참고용이며 실제 거래 전 별도 검토가 필요합니다."
    ),
    confidence: normalizeConfidence(value.confidence),
    entryZoneLong: readOptionalText(value.entryZoneLong),
    entryZoneShort: readOptionalText(value.entryZoneShort),
    tp1Long: readOptionalText(value.tp1Long),
    tp2Long: readOptionalText(value.tp2Long),
    stopLossLong: readOptionalText(value.stopLossLong),
    riskRewardLong: readOptionalText(value.riskRewardLong),
    tp1Short: readOptionalText(value.tp1Short),
    tp2Short: readOptionalText(value.tp2Short),
    stopLossShort: readOptionalText(value.stopLossShort),
    riskRewardShort: readOptionalText(value.riskRewardShort),
    higherTimeframeContext: readOptionalText(value.higherTimeframeContext),
  };

  const detected = normalizeDetectedMeta(value, options);
  return Object.keys(detected).length > 0 ? { result, detected } : { result };
}

function normalizeDetectedMeta(
  value: Record<string, unknown>,
  options: AnalysisOptions
): DetectedChartMeta {
  const detected: DetectedChartMeta = {};
  const rawSymbol = typeof value.detectedSymbol === "string" ? value.detectedSymbol : "";
  const rawTimeframe =
    typeof value.detectedTimeframe === "string" ? value.detectedTimeframe : "";
  const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : "";
  const timeframe = rawTimeframe ? normalizeTimeframe(rawTimeframe) : null;

  if (symbol && symbol !== options.symbol.toUpperCase()) detected.symbol = symbol;
  if (timeframe && timeframe !== options.timeframe) detected.timeframe = timeframe;
  return detected;
}

function normalizeTimeframe(raw: string): Timeframe | null {
  const s = raw.trim().toLowerCase();
  const map: Record<string, Timeframe> = {
    "1m": "1m",
    "1min": "1m",
    "1분": "1m",
    "1": "1m",
    "5m": "5m",
    "5min": "5m",
    "5분": "5m",
    "5": "5m",
    "15m": "15m",
    "15min": "15m",
    "15분": "15m",
    "15": "15m",
    "1h": "1h",
    "60m": "1h",
    "1시간": "1h",
    "60": "1h",
    "4h": "4h",
    "240m": "4h",
    "4시간": "4h",
    "240": "4h",
    "1d": "1D",
    "d": "1D",
    "1일": "1D",
    "일봉": "1D",
  };
  return map[s] ?? null;
}

function normalizeSymbol(raw: string): string {
  let s = raw.replace(/^[A-Za-z]+:/, "").trim().toUpperCase();
  s = s.replace(/\.(P|PERP|FUTURES|SWAP)$/i, "").trim();
  s = s.replace(/\s+(PERP|FUTURES|SWAP|PERPETUAL|CONTRACT)$/i, "").trim();

  if (s.includes("/")) {
    const [base, quote = ""] = s.split("/");
    s = `${base.trim()}${quote.trim() === "USD" ? "USDT" : quote.trim()}`;
  }

  return s;
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);
}

function normalizeConfidence(value: unknown): number {
  return typeof value === "number"
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 50;
}

function getMockResult(): AnalysisResult {
  const source = MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)];
  return {
    ...source,
    supportLevels: [...source.supportLevels],
    resistanceLevels: [...source.resistanceLevels],
  };
}

function createFallbackProviderResult(
  options: AnalysisOptions,
  warning: string
): ProviderResult {
  return {
    result: createFallbackResult(options, warning),
    mode: "fallback",
    warning,
  };
}

function createFallbackResult(
  options: AnalysisOptions,
  reason: string
): AnalysisResult {
  return {
    trend: "분석 결과 확인 필요",
    supportLevels: [],
    resistanceLevels: [],
    pattern: "명확한 패턴 없음",
    longView: `${options.symbol} ${options.timeframe} 차트의 롱 관점은 지지/저항 재확인이 필요합니다.`,
    longScore: 50,
    shortView: `${options.symbol} ${options.timeframe} 차트의 숏 관점은 이탈 여부 확인 후 참고할 수 있습니다.`,
    shortScore: 50,
    riskSummary: `${reason} 본 결과는 참고용이며 투자 조언이 아닙니다.`,
    confidence: 35,
  };
}

async function logClaudeHttpError(
  response: Response,
  model: string
): Promise<void> {
  let body: ClaudeErrorBody | null = null;
  try {
    body = (await response.json()) as ClaudeErrorBody;
  } catch {
    // Ignore malformed error body.
  }

  console.error("[ChartVisionAI] Claude API HTTP error", {
    apiKeyPresent: true,
    model,
    httpStatus: response.status,
    errorType: body?.error?.type ?? "unknown",
    errorMessage: body?.error?.message ?? "(no message)",
  });
}

function logClaudeNetworkError(error: unknown, model: string): void {
  const isTimeout =
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError");

  console.error("[ChartVisionAI] Claude API error", {
    apiKeyPresent: true,
    model,
    isTimeout,
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

function warningForClaudeStatus(status: number): string {
  if (status === 401) return "Claude authentication failed. Mock result returned.";
  if (status === 403) return "Claude access forbidden. Mock result returned.";
  if (status === 429) return "Claude rate limit or quota exceeded. Mock result returned.";
  if (status >= 500 && status <= 599) {
    return "Claude server error. Mock result returned.";
  }
  return `Claude API failed (HTTP ${status}). Mock result returned.`;
}

function warningForNetworkError(error: unknown): string {
  const isTimeout =
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError");
  return isTimeout
    ? "Claude API timed out. Mock result returned."
    : "Claude API failed. Mock result returned.";
}

function getAnthropicApiKey(): string | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return apiKey && apiKey.length > 10 ? apiKey : null;
}

function getProvider(): AnalysisProvider {
  const apiKey = getAnthropicApiKey();
  return apiKey ? new ClaudeProvider(apiKey) : new MockProvider();
}

export async function analyzeChartWithAI(
  imageBase64: string,
  mimeType: string,
  options: AnalysisOptions,
  marketPrice?: MarketPriceContext
): Promise<ProviderResult> {
  return getProvider().analyze(imageBase64, mimeType, options, marketPrice);
}

export async function detectChartMetaWithAI(
  imageBase64: string,
  mimeType: string
): Promise<{ symbol: string | null; timeframe: Timeframe | null; confidence: number }> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return { symbol: null, timeframe: null, confidence: 0 };

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL;

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      signal: AbortSignal.timeout(CLAUDE_META_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0,
        system: "Use the provided tool to return detected chart metadata.",
        tools: [META_TOOL],
        tool_choice: { type: "tool", name: META_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              { type: "text", text: buildMetaPrompt() },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      await logClaudeHttpError(response, model);
      return { symbol: null, timeframe: null, confidence: 0 };
    }

    const json = (await response.json()) as ClaudeMessageResponse;
    const raw = getToolInput(json, META_TOOL.name) ?? getTextJsonInput(json);
    if (typeof raw !== "object" || raw === null) {
      return { symbol: null, timeframe: null, confidence: 0 };
    }

    const parsed = raw as Record<string, unknown>;
    const rawSymbol =
      typeof parsed.detectedSymbol === "string" ? parsed.detectedSymbol : null;
    const rawTimeframe =
      typeof parsed.detectedTimeframe === "string" ? parsed.detectedTimeframe : null;
    const confidence = normalizeConfidence(parsed.confidence);
    const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : null;
    const timeframe = rawTimeframe ? normalizeTimeframe(rawTimeframe) : null;
    const hasResult = Boolean(symbol || timeframe);

    return {
      symbol: symbol || null,
      timeframe,
      confidence: hasResult ? confidence : 0,
    };
  } catch (error) {
    logClaudeNetworkError(error, model);
    return { symbol: null, timeframe: null, confidence: 0 };
  }
}
