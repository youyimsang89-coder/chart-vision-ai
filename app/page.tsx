"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChartUpload from "@/components/chart-upload";
import AnalysisOptionsPanel from "@/components/analysis-options";
import AnalysisResultPanel from "@/components/analysis-result";
import AnalysisHistory from "@/components/analysis-history";
import RiskDisclaimer from "@/components/risk-disclaimer";
import { useAnalysisHistory } from "@/hooks/use-analysis-history";
import { CompressedImage, validateImageFile } from "@/lib/image-utils";
import {
  AnalysisOptions,
  AnalysisResult,
  AnalyzeChartResponse,
  DetectedChartMeta,
  DetectChartMetaResponse,
  HistoryItem,
} from "@/lib/types";

const DEFAULT_OPTIONS: AnalysisOptions = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  purpose: "daytrading",
};

type AnalysisStatus = "idle" | "loading" | "success" | "error";

const ANALYZE_TIMEOUT_MS = 65_000;

export default function HomePage() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | undefined>();

  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<DetectedChartMeta | null>(null);
  const [isDetectingMeta, setIsDetectingMeta] = useState(false);

  const { history, mounted, addToHistory, removeFromHistory, clearHistory } =
    useAnalysisHistory();

  const prevPreviewUrl = useRef<string | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const detectAbortRef = useRef<AbortController | null>(null);

  const updateOptionsFromDetected = useCallback(
    (detected?: DetectedChartMeta) => {
      if (!detected?.symbol && !detected?.timeframe) return;
      setOptions((prev) => ({
        ...prev,
        ...(detected.symbol ? { symbol: detected.symbol } : {}),
        ...(detected.timeframe ? { timeframe: detected.timeframe } : {}),
      }));
      setDetectedMeta(detected);
    },
    []
  );

  const detectMetaFromImage = useCallback(
    async (compressed: CompressedImage, signal: AbortSignal) => {
      setIsDetectingMeta(true);
      try {
        const response = await fetch("/api/detect-chart-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: compressed.base64,
            mimeType: compressed.mimeType,
          }),
          signal,
        });
        if (signal.aborted) return;
        const json = (await response.json()) as DetectChartMetaResponse;
        if (response.ok && json.success) {
          updateOptionsFromDetected(json.detected);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        if (!signal.aborted) setIsDetectingMeta(false);
      }
    },
    [updateOptionsFromDetected]
  );

  const applyImage = useCallback(
    (compressed: CompressedImage) => {
      detectAbortRef.current?.abort();
      const detectController = new AbortController();
      detectAbortRef.current = detectController;

      if (prevPreviewUrl.current) {
        URL.revokeObjectURL(prevPreviewUrl.current);
      }

      prevPreviewUrl.current = compressed.previewUrl;
      setImageBase64(compressed.base64);
      setMimeType(compressed.mimeType);
      setPreviewUrl(compressed.previewUrl);
      setThumbnailDataUrl(compressed.thumbnailDataUrl);
      setResult(null);
      setErrorMsg(null);
      setUploadError(null);
      setWarningMsg(null);
      setDetectedMeta(null);
      setStatus("idle");
      void detectMetaFromImage(compressed, detectController.signal);
    },
    [detectMetaFromImage]
  );

  useEffect(() => {
    const handleGlobalPaste = async (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      if (status === "loading") return;

      const items = event.clipboardData?.items;
      if (!items) return;

      let imageFile: File | null = null;
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          imageFile = item.getAsFile();
          break;
        }
      }

      if (!imageFile) return;
      event.preventDefault();

      const validation = validateImageFile(imageFile);
      if (!validation.valid) {
        setUploadError(validation.error ?? "파일 검증에 실패했습니다.");
        return;
      }

      try {
        setUploadError(null);
        const { compressImage } = await import("@/lib/image-utils");
        const compressed = await compressImage(imageFile);
        applyImage(compressed);
      } catch (error: unknown) {
        setUploadError(
          error instanceof Error ? error.message : "이미지 처리에 실패했습니다."
        );
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [status, applyImage]);

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort();
      detectAbortRef.current?.abort();
      if (prevPreviewUrl.current) {
        URL.revokeObjectURL(prevPreviewUrl.current);
      }
    };
  }, []);

  const handleImageReady = useCallback(
    (compressed: CompressedImage) => {
      applyImage(compressed);
    },
    [applyImage]
  );

  const handleClear = useCallback(() => {
    if (prevPreviewUrl.current) {
      URL.revokeObjectURL(prevPreviewUrl.current);
      prevPreviewUrl.current = null;
    }
    setImageBase64(null);
    setMimeType(null);
    setPreviewUrl(null);
    setThumbnailDataUrl(undefined);
    setResult(null);
    setErrorMsg(null);
    setUploadError(null);
    setWarningMsg(null);
    setDetectedMeta(null);
    setStatus("idle");
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setErrorMsg(null);
    setUploadError(null);
    setWarningMsg(null);
    setDetectedMeta(null);
    setStatus("idle");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64 || !mimeType) {
      setErrorMsg("차트 이미지를 먼저 업로드해주세요.");
      setStatus("error");
      return;
    }

    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    setStatus("loading");
    setResult(null);
    setErrorMsg(null);
    setWarningMsg(null);
    setDetectedMeta(null);

    try {
      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, options }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const json = (await response.json()) as AnalyzeChartResponse;
      const analysisResult = json.result ?? json.data;

      if (!response.ok || !json.success || !analysisResult) {
        throw new Error(json.error ?? "분석에 실패했습니다.");
      }

      const nextOptions = {
        ...options,
        ...(json.detected?.symbol ? { symbol: json.detected.symbol } : {}),
        ...(json.detected?.timeframe ? { timeframe: json.detected.timeframe } : {}),
      };
      updateOptionsFromDetected(json.detected);
      setResult(analysisResult);
      setStatus("success");
      if (json.warning) setWarningMsg(json.warning);
      addToHistory({ options: nextOptions, result: analysisResult, thumbnailDataUrl });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        setErrorMsg("요청 시간이 초과되었습니다 (65초). 네트워크 상태를 확인하고 다시 시도해주세요.");
      } else {
        setErrorMsg(
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
        );
      }
      setStatus("error");
    }
  }, [
    imageBase64,
    mimeType,
    options,
    thumbnailDataUrl,
    addToHistory,
    updateOptionsFromDetected,
  ]);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setOptions(item.options);
    setResult(item.result);
    setStatus("success");
    setErrorMsg(null);
    setWarningMsg(null);
    setDetectedMeta(null);
  }, []);

  const canAnalyze = !!imageBase64 && status !== "loading";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/30"
              aria-hidden="true"
            >
              <svg
                className="h-4 w-4 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight">
              Chart Vision <span className="text-emerald-400">AI</span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="hidden sm:inline">Vision ready</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-2">
            <section
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
              aria-label="이미지 업로드 영역"
            >
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                차트 업로드
              </h2>
              <ChartUpload
                onImageReady={handleImageReady}
                onClear={handleClear}
                previewUrl={previewUrl}
                disabled={status === "loading"}
              />
              {uploadError && (
                <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-red-400">
                  <span aria-hidden="true">!</span>
                  {uploadError}
                </p>
              )}
            </section>

            <section
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
              aria-label="분석 옵션"
            >
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                분석 옵션
              </h2>
              <AnalysisOptionsPanel
                options={options}
                onChange={setOptions}
                disabled={status === "loading"}
              />
              {isDetectingMeta && (
                <p className="mt-3 text-xs text-zinc-500" role="status">
                  차트에서 종목과 타임프레임을 읽는 중입니다...
                </p>
              )}
              {detectedMeta && (
                <p className="mt-3 text-xs text-emerald-400" role="status">
                  차트에서 읽은 값으로 옵션을 업데이트했습니다.
                  {detectedMeta.symbol ? ` 종목: ${detectedMeta.symbol}` : ""}
                  {detectedMeta.timeframe ? ` 타임프레임: ${detectedMeta.timeframe}` : ""}
                </p>
              )}
            </section>

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              aria-label={!imageBase64 ? "이미지를 먼저 업로드하세요" : "AI 차트 분석 시작"}
              className={[
                "w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                canAnalyze
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-[0.98]"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-600",
              ].join(" ")}
            >
              {status === "loading" ? "AI 분석 중..." : "AI 차트 분석 시작"}
            </button>

            {!imageBase64 && status !== "loading" && (
              <p className="text-center text-xs text-zinc-600" aria-live="polite">
                이미지를 업로드하거나{" "}
                <kbd
                  className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5"
                  aria-label="Ctrl V"
                >
                  Ctrl+V
                </kbd>
                로 붙여넣으세요.
              </p>
            )}

            {mounted && history.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <AnalysisHistory
                  items={history}
                  onSelect={handleHistorySelect}
                  onRemove={removeFromHistory}
                  onClear={clearHistory}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-3" aria-live="polite" aria-atomic="true">
            {warningMsg && status === "success" && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-400"
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                  />
                </svg>
                <p>AI 응답에 문제가 발생해 샘플 참고 결과를 표시합니다. 실제 분석이 아닙니다.</p>
              </div>
            )}

            {status === "error" && errorMsg && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
              >
                <span className="mt-0.5 shrink-0" aria-hidden="true">!</span>
                <div>
                  <p className="font-semibold">분석 실패</p>
                  <p className="mt-1 text-red-300/80">{errorMsg}</p>
                  <button
                    onClick={handleReset}
                    className="mt-2 rounded text-xs underline underline-offset-2 hover:text-red-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            )}

            {status === "loading" && (
              <div role="status" aria-label="분석 중" className="animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-24 rounded-xl border border-zinc-800 bg-zinc-900" />
                ))}
                <span className="sr-only">AI가 차트를 분석하고 있습니다.</span>
              </div>
            )}

            {status === "success" && result && (
              <AnalysisResultPanel result={result} options={options} onReset={handleReset} />
            )}

            {status === "idle" && !result && (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900"
                  aria-hidden="true"
                >
                  <svg
                    className="h-8 w-8 text-zinc-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-500">
                  분석 결과가 여기에 표시됩니다.
                </p>
                <p className="mt-1 text-xs text-zinc-700">
                  차트 이미지를 업로드하고 분석 버튼을 클릭하세요.
                </p>
              </div>
            )}
          </div>
        </div>

        <RiskDisclaimer />
      </main>
    </div>
  );
}
