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
  /** 롱 진입 권장 구간 */
  entryZoneLong?: string;
  /** 롱 1차 목표가 */
  tp1Long?: string;
  /** 롱 2차 목표가 */
  tp2Long?: string;
  /** 롱 손절가 */
  stopLossLong?: string;
  /** 롱 R:R 비율 */
  riskRewardLong?: string;
  /** 숏 진입 권장 구간 */
  entryZoneShort?: string;
  /** 숏 1차 목표가 */
  tp1Short?: string;
  /** 숏 2차 목표가 */
  tp2Short?: string;
  /** 숏 손절가 */
  stopLossShort?: string;
  /** 숏 R:R 비율 */
  riskRewardShort?: string;
  /** 멀티 타임프레임 컨텍스트 */
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
