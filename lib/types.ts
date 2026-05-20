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
  accessPassword?: string;
}

export interface AnalyzeChartResponse {
  success: boolean;
  mode?: AnalysisMode;
  warning?: string;
  result?: AnalysisResult;
  data?: AnalysisResult;
  detected?: DetectedChartMeta;
  error?: string;
}

export interface DetectChartMetaRequest {
  imageBase64: string;
  mimeType: string;
  accessPassword?: string;
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
