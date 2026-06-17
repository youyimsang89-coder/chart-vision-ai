"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import ChartUpload from "@/components/chart-upload";
import AnalysisOptionsPanel from "@/components/analysis-options";
import AnalysisResultPanel from "@/components/analysis-result";
import AnalysisHistory from "@/components/analysis-history";
import RiskDisclaimer from "@/components/risk-disclaimer";
import dynamic from "next/dynamic";
import { useAnalysisHistory } from "@/hooks/use-analysis-history";
import { CompressedImage, validateImageFile } from "@/lib/image-utils";
import type {
  AnalysisOptions,
  AnalysisResult,
  AnalyzeChartResponse,
  DetectChartMetaResponse,
  HistoryItem,
} from "@/lib/types";

const CreditPurchaseModal = dynamic(() => import("@/components/credit-purchase-modal"), { ssr: false });

const DEFAULT_OPTIONS: AnalysisOptions = {
  symbol: "AAPL",
  timeframe: "1h",
  purpose: "daytrading",
};

type AnalysisStatus = "idle" | "loading" | "success" | "error";
type DetectStatus = "idle" | "detecting" | "success" | "failed";
const ANALYZE_TIMEOUT_MS = 65_000;

export default function HomePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [pendingSignalId, setPendingSignalId] = useState<number | null>(null);

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
  const [detectStatus, setDetectStatus] = useState<DetectStatus>("idle");
  const [detectMsg, setDetectMsg] = useState<string>("");

  const { history, mounted, addToHistory, removeFromHistory, clearHistory } = useAnalysisHistory();
  const prevPreviewUrl = useRef<string | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const detectAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/auth/login");
  }, [authStatus, router]);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/user/credits");
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") fetchCredits();
  }, [authStatus, fetchCredits]);

  const detectMetaFromImage = useCallback(async (compressed: CompressedImage, signal: AbortSignal) => {
    setDetectStatus("detecting");
    setDetectMsg("차트에서 종목/타임프레임 인식 중...");
    try {
      const response = await fetch("/api/detect-chart-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: compressed.base64, mimeType: compressed.mimeType }),
        signal,
      });
      if (signal.aborted) return;
      if (response.status === 401) {
        setDetectStatus("failed");
        setDetectMsg("차트 정보 자동 인식 실패. 직접 입력해 주세요.");
        return;
      }
      const json = (await response.json()) as DetectChartMetaResponse;
      if (signal.aborted) return;
      if (json.success && (json.symbol || json.timeframe)) {
        setOptions((prev) => ({
          ...prev,
          ...(json.symbol ? { symbol: json.symbol as string } : {}),
          ...(json.timeframe ? { timeframe: json.timeframe } : {}),
        }));
        const parts = [json.symbol, json.timeframe].filter(Boolean);
        setDetectStatus("success");
        setDetectMsg("차트 정보 자동 인식 완료: " + parts.join(" · "));
      } else {
        setDetectStatus("failed");
        setDetectMsg("차트 정보 자동 인식 실패. 직접 입력해 주세요.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setDetectStatus("failed");
      setDetectMsg("차트 정보 자동 인식 실패. 직접 입력해 주세요.");
    }
  }, []);

  const applyImage = useCallback((compressed: CompressedImage) => {
    detectAbortRef.current?.abort();
    const detectController = new AbortController();
    detectAbortRef.current = detectController;
    if (prevPreviewUrl.current) URL.revokeObjectURL(prevPreviewUrl.current);
    prevPreviewUrl.current = compressed.previewUrl;
    setImageBase64(compressed.base64);
    setMimeType(compressed.mimeType);
    setPreviewUrl(compressed.previewUrl);
    setThumbnailDataUrl(compressed.thumbnailDataUrl);
    setResult(null); setErrorMsg(null); setUploadError(null);
    setWarningMsg(null); setDetectStatus("idle"); setDetectMsg(""); setStatus("idle");
    void detectMetaFromImage(compressed, detectController.signal);
  }, [detectMetaFromImage]);

  useEffect(() => {
    const handleGlobalPaste = async (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
      if (status === "loading") return;
      const items = event.clipboardData?.items;
      if (!items) return;
      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) { imageFile = item.getAsFile(); break; }
      }
      if (!imageFile) return;
      event.preventDefault();
      const validation = validateImageFile(imageFile);
      if (!validation.valid) { setUploadError(validation.error ?? "파일 검증에 실패했습니다."); return; }
      try {
        setUploadError(null);
        const { compressImage } = await import("@/lib/image-utils");
        const compressed = await compressImage(imageFile);
        applyImage(compressed);
      } catch (error: unknown) {
        setUploadError(error instanceof Error ? error.message : "이미지 처리에 실패했습니다.");
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [status, applyImage]);

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort();
      detectAbortRef.current?.abort();
      if (prevPreviewUrl.current) URL.revokeObjectURL(prevPreviewUrl.current);
    };
  }, []);

  const handleImageReady = useCallback((compressed: CompressedImage) => applyImage(compressed), [applyImage]);

  const handleClear = useCallback(() => {
    if (prevPreviewUrl.current) { URL.revokeObjectURL(prevPreviewUrl.current); prevPreviewUrl.current = null; }
    setImageBase64(null); setMimeType(null); setPreviewUrl(null); setThumbnailDataUrl(undefined);
    setResult(null); setErrorMsg(null); setUploadError(null); setWarningMsg(null);
    setDetectStatus("idle"); setDetectMsg(""); setStatus("idle");
  }, []);

  const handleReset = useCallback(() => {
    setResult(null); setErrorMsg(null); setUploadError(null); setWarningMsg(null);
    setDetectStatus("idle"); setDetectMsg(""); setStatus("idle");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64 || !mimeType) { setErrorMsg("차트 이미지를 먼저 업로드해주세요."); setStatus("error"); return; }
    if (credits !== null && credits <= 0) {
      setErrorMsg("분석 크레딧이 부족합니다. 관리자에게 충전을 요청하세요.");
      setStatus("error"); return;
    }
    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
    setStatus("loading"); setResult(null); setErrorMsg(null); setWarningMsg(null);
    try {
      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, options }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.status === 401) { router.replace("/auth/login"); throw new Error("로그인이 필요합니다."); }
      if (response.status === 402) throw new Error("분석 크레딧이 부족합니다. 관리자에게 충전을 요청하세요.");
      const json = (await response.json()) as AnalyzeChartResponse & { remainingCredits?: number; signalId?: number };
      const analysisResult = json.result ?? json.data;
      if (!response.ok || !json.success || !analysisResult) throw new Error(json.error ?? "분석에 실패했습니다.");
      if (typeof json.remainingCredits === "number") setCredits(json.remainingCredits);
      else fetchCredits();
      const nextOptions: AnalysisOptions = {
        ...options,
        ...(json.detected?.symbol ? { symbol: json.detected.symbol } : {}),
        ...(json.detected?.timeframe ? { timeframe: json.detected.timeframe } : {}),
      };
      if (json.detected?.symbol) setOptions((p) => ({ ...p, symbol: json.detected!.symbol! }));
      if (json.detected?.timeframe) setOptions((p) => ({ ...p, timeframe: json.detected!.timeframe! }));
      setResult(analysisResult); setStatus("success");
      if (json.warning) setWarningMsg(json.warning);
      void nextOptions;
      if (typeof json.signalId === "number") setPendingSignalId(json.signalId);
      addToHistory({ options: nextOptions, result: analysisResult, thumbnailDataUrl });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError")
        setErrorMsg("요청 시간이 초과되었습니다 (65초). 네트워크 상태를 확인하고 다시 시도해주세요.");
      else setErrorMsg(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setStatus("error");
    }
  }, [imageBase64, mimeType, options, thumbnailDataUrl, credits, addToHistory, fetchCredits, router]);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setOptions(item.options); setResult(item.result); setStatus("success");
    setErrorMsg(null); setWarningMsg(null); setDetectStatus("idle"); setDetectMsg("");
  }, []);

  const canAnalyze = !!imageBase64 && status !== "loading";

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
        </svg>
      </div>
    );
  }
  if (authStatus === "unauthenticated") return null;

  const creditColor = credits === null ? "border-zinc-700 text-zinc-500"
    : credits <= 2 ? "border-red-500/40 bg-red-500/10 text-red-400"
    : credits <= 5 ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/30">
              <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight">Chart Vision <span className="text-emerald-400">AI</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={"flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold " + creditColor}>
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                <span>{credits === null ? "..." : credits.toLocaleString()}</span>
                <span className="opacity-60">크레딧</span>
              </div>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="hidden sm:flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 transition hover:border-emerald-400 hover:text-emerald-300"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                충전
              </button>
            </div>
            <UserMenu
              name={session?.user?.name ?? ""}
              role={session?.user?.role ?? "user"}
              onAdmin={() => router.push("/admin")}
              onChangePassword={() => router.push("/auth/change-password")}
              onSignOut={() => signOut({ callbackUrl: "/auth/login" })}
            />
          </div>
        </div>
      </header>

      {showPurchaseModal && <CreditPurchaseModal onClose={() => setShowPurchaseModal(false)} />}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">차트 업로드</h2>
              <ChartUpload onImageReady={handleImageReady} onClear={handleClear} previewUrl={previewUrl} disabled={status === "loading"} />
              {uploadError && (
                <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-red-400">
                  <span aria-hidden="true">!</span>{uploadError}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">분석 옵션</h2>
              <AnalysisOptionsPanel options={options} onChange={setOptions} disabled={status === "loading"} />
              {detectStatus === "detecting" && (
                <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
                  </svg>
                  {detectMsg}
                </p>
              )}
              {detectStatus === "success" && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                  {detectMsg}
                </p>
              )}
              {detectStatus === "failed" && <p className="mt-3 text-xs text-zinc-500">{detectMsg}</p>}
            </section>

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || (credits !== null && credits <= 0)}
              className={[
                "w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                canAnalyze && (credits === null || credits > 0)
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-[0.98]"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-600",
              ].join(" ")}
            >
              {status === "loading" ? "AI 분석 중..."
                : credits !== null && credits <= 0 ? "크레딧 부족 (관리자에게 문의)"
                : "AI 차트 분석 시작" + (credits !== null ? " (" + credits + " 크레딧 남음)" : "")}
            </button>

            {!imageBase64 && status !== "loading" && (
              <p className="text-center text-xs text-zinc-600">
                이미지를 업로드하거나 <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5">Ctrl+V</kbd>로 붙여넣으세요.
              </p>
            )}

            {mounted && history.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <AnalysisHistory items={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
              </div>
            )}
          </div>

          <div className="lg:col-span-3" aria-live="polite" aria-atomic="true">
            {warningMsg && status === "success" && (
              <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-400">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p>AI 응답에 문제가 발생해 샘플 참고 결과를 표시합니다. 실제 분석이 아닙니다.</p>
              </div>
            )}
            {status === "error" && errorMsg && (
              <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                <span className="mt-0.5 shrink-0" aria-hidden="true">!</span>
                <div>
                  <p className="font-semibold">분석 실패</p>
                  <p className="mt-1 text-red-300/80">{errorMsg}</p>
                  <button onClick={handleReset} className="mt-2 rounded text-xs underline underline-offset-2 hover:text-red-300">다시 시도</button>
                </div>
              </div>
            )}
            {status === "loading" && (
              <div role="status" className="animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-zinc-800 bg-zinc-900" />
                ))}
                <span className="sr-only">AI가 차트를 분석하고 있습니다.</span>
              </div>
            )}
            {status === "success" && result && (
              <AnalysisResultPanel
                result={result}
                options={options}
                onReset={handleReset}
                onRegisterSignal={pendingSignalId ? () => {} : undefined}
                imageBase64={imageBase64 ?? undefined}
                mimeType={mimeType ?? undefined}
              />
            )}
            {status === "idle" && !result && (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                  <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-500">분석 결과가 여기에 표시됩니다.</p>
                <p className="mt-1 text-xs text-zinc-700">차트 이미지를 업로드하고 분석 버튼을 클릭하세요.</p>
              </div>
            )}
          </div>
        </div>
        <RiskDisclaimer />
      </main>
    </div>
  );
}

function UserMenu({
  name,
  role,
  onAdmin,
  onChangePassword,
  onSignOut,
}: {
  name: string;
  role: string;
  onAdmin: () => void;
  onChangePassword: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initial = name.charAt(0).toUpperCase() || "U";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-zinc-200 hover:bg-zinc-600 transition"
        aria-label="사용자 메뉴"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-zinc-700 bg-zinc-900 py-1.5 shadow-xl">
          <div className="border-b border-zinc-800 px-4 py-2.5">
            <p className="text-sm font-medium text-zinc-200">{name}</p>
            <p className="text-xs text-zinc-500">{role === "admin" ? "관리자" : "일반 회원"}</p>
          </div>
          {role === "admin" && (
            <button
              onClick={() => { setOpen(false); onAdmin(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              관리자 대시보드
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onChangePassword(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586l6.257-6.257A6 6 0 1121 9z" />
            </svg>
            비밀번호 변경
          </button>
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
