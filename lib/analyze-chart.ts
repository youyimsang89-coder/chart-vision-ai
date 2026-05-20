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

type ClaudeMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-latest";
const CLAUDE_ANALYSIS_TIMEOUT_MS = 30_000;
const CLAUDE_META_TIMEOUT_MS = 12_000;
const VALID_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D"];

const MOCK_RESULTS: AnalysisResult[] = [
  {
    trend: "상승 추세",
    supportLevels: ["67,500", "66,000"],
    resistanceLevels: ["69,200", "70,500"],
    pattern: "상승 채널",
    longView:
      "69,200 부근을 거래량과 함께 돌파하고 지지 전환이 확인되면 롱 관점을 참고할 수 있습니다.",
    shortView:
      "67,500 지지 이탈과 약세 캔들이 함께 확인되면 단기 조정 가능성을 참고할 수 있습니다.",
    riskSummary:
      "거래량이 부족한 돌파는 실패 가능성이 있습니다. 본 분석은 참고용이며 변동성 확인이 필요합니다.",
    confidence: 76,
  },
  {
    trend: "횡보",
    supportLevels: ["65,000", "63,800"],
    resistanceLevels: ["67,200", "68,500"],
    pattern: "대칭 삼각형",
    longView:
      "67,200 상단 돌파와 거래량 증가가 동반되면 상승 시나리오를 참고할 수 있습니다.",
    shortView:
      "65,000 하단 이탈 시 박스권 하방 돌파 가능성을 검토할 수 있습니다.",
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
      "하락 쐐기 하단 지지와 과매도 신호가 함께 보이면 제한적 반등 가능성을 참고할 수 있습니다.",
    shortView:
      "64,800 저항 실패와 약세 캔들이 확인되면 하락 지속 시나리오를 검토할 수 있습니다.",
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
          model: process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL,
          max_tokens: 1000,
          temperature: 0.2,
          system: buildAnalysisSystemPrompt(),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mimeType, data: imageBase64 },
                },
                { type: "text", text: buildAnalysisUserPrompt(options) },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        return createFallbackProviderResult(options, warningForClaudeStatus(response.status));
      }

      const json = (await response.json()) as ClaudeMessageResponse;
      const content = getClaudeText(json);
      if (!content) {
        return createFallbackProviderResult(options, "Claude response was empty. Mock result returned.");
      }

      try {
        const parsed = JSON.parse(extractJsonText(content));
        const normalized = validateAndNormalizeProviderResult(parsed, options);
        return { ...normalized, mode: "claude" };
      } catch {
        return createFallbackProviderResult(options, "Claude response JSON parse failed. Mock result returned.");
      }
    } catch {
      return createFallbackProviderResult(options, "Claude API failed. Mock result returned.");
    }
  }
}

function buildAnalysisSystemPrompt(): string {
  return `You are a chart image analysis assistant.
Return only one valid JSON object. Do not include markdown, code fences, explanations, or extra text.
Analyze the uploaded chart image and produce a reference-only technical analysis.
Avoid definitive investment advice, guaranteed profit language, or direct buy/sell instructions.
Use conditional wording such as "can be referenced", "may indicate", "if confirmed", and "needs confirmation".

The JSON object must have exactly these keys:
{
  "detectedSymbol": string | null,
  "detectedTimeframe": "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | null,
  "trend": string,
  "supportLevels": string[],
  "resistanceLevels": string[],
  "pattern": string,
  "longView": string,
  "shortView": string,
  "riskSummary": string,
  "confidence": number
}

If the symbol or timeframe is not clearly visible in the image, return null for that field.
Write the analysis in Korean.`;
}

function buildAnalysisUserPrompt(options: AnalysisOptions): string {
  return `User selected options:
Symbol: ${options.symbol}
Timeframe: ${options.timeframe}
Purpose: ${PURPOSE_LABELS[options.purpose]}

First read the visible symbol/timeframe from the chart image if possible, then return the JSON analysis.`;
}

function buildMetaPrompt(): string {
  return `Read only the visible chart symbol and timeframe from this image.
Return only one valid JSON object with this shape:
{
  "detectedSymbol": string | null,
  "detectedTimeframe": "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | null
}
If either value is unclear, return null for that field.`;
}

function getClaudeText(json: ClaudeMessageResponse): string | null {
  const content = json.content;
  if (!Array.isArray(content)) return null;
  return content.find((block) => block.type === "text" && typeof block.text === "string")?.text ?? null;
}

function extractJsonText(content: string): string {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
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
    longView: readText(value.longView, "롱 관점은 추가 확인 후 참고할 수 있습니다."),
    shortView: readText(value.shortView, "숏 관점은 추가 확인 후 참고할 수 있습니다."),
    riskSummary: readText(value.riskSummary, "본 분석은 참고용이며 실제 거래 전 별도 검토가 필요합니다."),
    confidence:
      typeof value.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(value.confidence)))
        : 50,
  };
  const detected = normalizeDetectedMeta(value, options);
  return Object.keys(detected).length > 0 ? { result, detected } : { result };
}

function normalizeDetectedMeta(
  value: Record<string, unknown>,
  options: AnalysisOptions
): DetectedChartMeta {
  const detected: DetectedChartMeta = {};
  const symbol = typeof value.detectedSymbol === "string" ? value.detectedSymbol.trim().toUpperCase() : "";
  const timeframe = typeof value.detectedTimeframe === "string" ? value.detectedTimeframe : "";
  if (symbol && symbol !== options.symbol.toUpperCase()) detected.symbol = symbol;
  if (VALID_TIMEFRAMES.includes(timeframe as Timeframe) && timeframe !== options.timeframe) {
    detected.timeframe = timeframe as Timeframe;
  }
  return detected;
}

function normalizeDetectedMetaOnly(value: unknown): DetectedChartMeta {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const detected: DetectedChartMeta = {};
  const symbol = typeof raw.detectedSymbol === "string" ? raw.detectedSymbol.trim().toUpperCase() : "";
  const timeframe = typeof raw.detectedTimeframe === "string" ? raw.detectedTimeframe : "";
  if (symbol) detected.symbol = symbol;
  if (VALID_TIMEFRAMES.includes(timeframe as Timeframe)) detected.timeframe = timeframe as Timeframe;
  return detected;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 6);
}

function getMockResult(): AnalysisResult {
  const source = MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)];
  return { ...source, supportLevels: [...source.supportLevels], resistanceLevels: [...source.resistanceLevels] };
}

function createFallbackProviderResult(options: AnalysisOptions, warning: string): ProviderResult {
  return { result: createFallbackResult(options, warning), mode: "fallback", warning };
}

function createFallbackResult(options: AnalysisOptions, reason: string): AnalysisResult {
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

function warningForClaudeStatus(status: number): string {
  if (status === 401) return "Claude authentication failed. Mock result returned.";
  if (status === 429) return "Claude rate limit or quota exceeded. Mock result returned.";
  if (status >= 500 && status <= 599) return "Claude server error. Mock result returned.";
  return "Claude API failed. Mock result returned.";
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
): Promise<DetectedChartMeta> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return {};

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
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL,
        max_tokens: 180,
        temperature: 0,
        system: "Return only valid JSON. Do not include markdown or extra text.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              { type: "text", text: buildMetaPrompt() },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return {};
    const json = (await response.json()) as ClaudeMessageResponse;
    const content = getClaudeText(json);
    if (!content) return {};
    return normalizeDetectedMetaOnly(JSON.parse(extractJsonText(content)));
  } catch {
    return {};
  }
}
