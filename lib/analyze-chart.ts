import {
  AnalysisMode,
  AnalysisOptions,
  AnalysisProvider,
  AnalysisResult,
  DetectedChartMeta,
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
    shortView:
      "직전 지지 이탈과 약세 캔들이 함께 확인되면 단기 조정 가능성을 참고할 수 있습니다.",
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
    shortView:
      "하단 이탈 시 박스권 하방 돌파 가능성을 검토할 수 있습니다.",
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
    shortView:
      "주요 저항 실패와 약세 캔들이 확인되면 하락 지속 시나리오를 검토할 수 있습니다.",
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
  description: "Return a structured chart analysis result.",
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
      longView: { type: "string" },
      shortView: { type: "string" },
      riskSummary: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 100 },
    },
    required: [
      "detectedSymbol",
      "detectedTimeframe",
      "trend",
      "supportLevels",
      "resistanceLevels",
      "pattern",
      "longView",
      "shortView",
      "riskSummary",
      "confidence",
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
    options: AnalysisOptions
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
                { type: "text", text: buildAnalysisUserPrompt(options) },
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
  return `You are a chart image analysis assistant.
Use the provided tool to return a structured result.
The output is reference-only technical analysis, not investment advice.
Do not use definitive buy/sell instructions or guaranteed profit language.
Use conditional Korean wording such as "확인되면", "참고할 수 있습니다", "가능성이 있습니다".
Analyze both long and short scenarios. Do not claim one side is certain.`;
}

function buildAnalysisUserPrompt(options: AnalysisOptions): string {
  return `현재 사용자가 선택한 값:
종목: ${options.symbol}
타임프레임: ${options.timeframe}
분석 목적: ${PURPOSE_LABELS[options.purpose]}

이미지에서 보이는 종목과 타임프레임을 먼저 읽고, 차트 구조를 분석해주세요.
supportLevels와 resistanceLevels는 이미지에서 읽히는 주요 가격대만 문자열 배열로 반환해주세요.
confidence는 롱/숏 성공률이 아니라 이미지에서 차트 구조와 주요 레벨을 얼마나 명확히 읽었는지에 대한 0-100 점수입니다.`;
}

function buildMetaPrompt(): string {
  return `이미지에서 보이는 트레이딩 종목과 캔들 타임프레임만 읽어주세요.
예: BTCUSDT, BTCUSDT.P, BTC/USDT, BINANCE:BTCUSDT, 1m, 5m, 15m, 1h, 4h, 1D.
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
    longView: readText(
      value.longView,
      "롱 관점은 지지/저항 재확인 후 참고할 수 있습니다."
    ),
    shortView: readText(
      value.shortView,
      "숏 관점은 이탈 여부 확인 후 참고할 수 있습니다."
    ),
    riskSummary: readText(
      value.riskSummary,
      "본 분석은 참고용이며 실제 거래 전 별도 검토가 필요합니다."
    ),
    confidence: normalizeConfidence(value.confidence),
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
    shortView: `${options.symbol} ${options.timeframe} 차트의 숏 관점은 이탈 여부 확인 후 참고할 수 있습니다.`,
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
  options: AnalysisOptions
): Promise<ProviderResult> {
  return getProvider().analyze(imageBase64, mimeType, options);
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
