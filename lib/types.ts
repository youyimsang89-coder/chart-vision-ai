export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";
export type Purpose = "scalping" | "daytrading" | "swing";
export type AnalysisMode = "claude" | "mock" | "fallback";

export interface AnalysisOptions {
  symbol: string;
  timeframe: Timeframe;
  purpose: Purpose;
}

export interface MarketPriceContext {
  symbol: string;
  market: string;
  price: number;
  currency: "KRW";
  source: string;
  fetchedAt: string;
}

export interface DetectedChartMeta {
  symbol?: string;
  timeframe?: Timeframe;
}

export interface AnalysisResult {
  trend: string;
  supportLevels: string[];
  resistanceLevels: string[];
  pattern: string;
  /** 주요 캔들 패턴 목록 (예: ["망치형", "상승 삼병법", "도지"]) */
  candlePatterns?: string[];
  longView: string;
  longScore: number;
  shortView: string;
  shortScore: number;
  riskSummary: string;
  confidence: number;
  /** 롱 진입 권장 구간 (예: "67,200 ~ 67,500") */
  entryZoneLong?: string;
  /** 숏 진입 권장 구간 */
  entryZoneShort?: string;
  /** 목표가 1 (첫 번째 익절) */
  tp1?: string;
  /** 목표가 2 (두 번째 익절) */
  tp2?: string;
  /** 손절가 */
  stopLoss?: string;
  /** 리스크/리워드 비율 (예: "1:2.5") */
  riskReward?: string;
  /** 멀티 타임프레임 컨텍스트 (상위 타임프레임 추세 요약) */
  higherTimeframeContext?: string;
}

export interface AnalysisProvider {
  analyze(
    imageBase64: string,
    mimeType: string,
    options: AnalysisOptions,
    marketPrice?: MarketPriceContext
  ): Promise<{
    result: AnalysisResult;
    mode: AnalysisMode;
    warning?: string;
    detected?: DetectedChartMeta;
  }>;
  detectMeta?(imageBase64: string, mimeType: string): Promise<DetectedChartMeta>;
}

export interface AnalyzeChartRequest {
  imageBase64: string;
  mimeType: string;
  options: AnalysisOptions;
}

export interface AnalyzeChartResponse {
  success: boolean;
  mode?: AnalysisMode;
  warning?: string;
  result?: AnalysisResult;
  data?: AnalysisResult;
  detected?: DetectedChartMeta;
  remainingCredits?: number;
  error?: string;
}

export interface DetectChartMetaRequest {
  imageBase64: string;
  mimeType: string;
}

export interface DetectChartMetaResponse {
  success: boolean;
  symbol: string | null;
  timeframe: Timeframe | null;
  confidence: number;
  warning: string;
  error?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  options: AnalysisOptions;
  result: AnalysisResult;
  thumbnailDataUrl?: string;
}

// ── 사용자 / 크레딧 타입 ─────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  credits: number;
}

export interface CreditTransaction {
  id: number;
  amount: number;
  reason: string;
  createdAt: number;
}

export interface UserCreditsResponse {
  success: boolean;
  credits: number;
  transactions: CreditTransaction[];
  error?: string;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  credits: number;
  totalAnalyses: number;
  createdAt: number;
}
