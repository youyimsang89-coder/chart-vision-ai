export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";
export type Purpose = "scalping" | "daytrading" | "swing";
export type AnalysisMode = "claude" | "mock" | "fallback";

export interface AnalysisOptions {
  symbol: string;
  timeframe: Timeframe;
  purpose: Purpose;
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
  longView: string;
  shortView: string;
  riskSummary: string;
  confidence: number;
}

export interface AnalysisProvider {
  analyze(
    imageBase64: string,
    mimeType: string,
    options: AnalysisOptions
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
