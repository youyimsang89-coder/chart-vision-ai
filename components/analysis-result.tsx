"use client";

import { memo, useCallback, useRef, useState } from "react";
import { AnalysisOptions, AnalysisResult } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getClarityStyle(confidence: number) {
  if (confidence >= 90) {
    return { text: "text-emerald-400", bar: "bg-emerald-500", label: "높음" };
  }
  if (confidence >= 70) {
    return { text: "text-yellow-400", bar: "bg-yellow-500", label: "보통" };
  }
  return { text: "text-red-400", bar: "bg-red-500", label: "낮음" };
}

function formatResultText(result: AnalysisResult, options?: AnalysisOptions): string {
  const header = options
    ? `Chart Vision AI 분석 결과\n종목: ${options.symbol} | 타임프레임: ${options.timeframe}\n`
    : "Chart Vision AI 분석 결과\n";

  const longGuide = result.entryZoneLong || result.tp1Long || result.stopLossLong
    ? `\n[롱 매매 가이드]\n${result.entryZoneLong ? `진입 구간: ${result.entryZoneLong}` : ""}${result.tp1Long ? `\nTP1: ${result.tp1Long}` : ""}${result.tp2Long ? `\nTP2: ${result.tp2Long}` : ""}${result.stopLossLong ? `\n손절가: ${result.stopLossLong}` : ""}${result.riskRewardLong ? `\nR:R = ${result.riskRewardLong}` : ""}`
    : "";
  const shortGuide = result.entryZoneShort || result.tp1Short || result.stopLossShort
    ? `\n[숏 매매 가이드]\n${result.entryZoneShort ? `진입 구간: ${result.entryZoneShort}` : ""}${result.tp1Short ? `\nTP1: ${result.tp1Short}` : ""}${result.tp2Short ? `\nTP2: ${result.tp2Short}` : ""}${result.stopLossShort ? `\n손절가: ${result.stopLossShort}` : ""}${result.riskRewardShort ? `\nR:R = ${result.riskRewardShort}` : ""}`
    : "";
  const tpslSection = longGuide + shortGuide;

  const candleSection = result.candlePatterns?.length
    ? `\n캔들 패턴: ${result.candlePatterns.join(", ")}`
    : "";

  return `${header}
추세: ${result.trend}
패턴: ${result.pattern}${candleSection}
지지선: ${result.supportLevels.join(", ") || "없음"}
저항선: ${result.resistanceLevels.join(", ") || "없음"}
${tpslSection}
롱 관점 참고 (${result.longScore}점):
${result.longView}

숏 관점 참고 (${result.shortScore}점):
${result.shortView}

리스크:
${result.riskSummary}

분석 명확도: ${result.confidence}%`.trim();
}

const GuideRow = memo(function GuideRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`font-mono text-sm ${bold ? "font-bold" : "font-semibold"} ${color}`}>{value}</span>
    </div>
  );
});

const Badge = memo(function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
});

const LevelList = memo(function LevelList({
  items,
  colorClass,
}: {
  items: string[];
  colorClass: string;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2" role="list">
      {items.length > 0 ? (
        items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            role="listitem"
            className={`rounded-md px-2.5 py-1 font-mono text-sm font-semibold ${colorClass}`}
          >
            {item}
          </span>
        ))
      ) : (
        <span className="text-sm text-zinc-600">없음</span>
      )}
    </div>
  );
});

interface AnalysisResultPanelProps {
  result: AnalysisResult;
  options?: AnalysisOptions;
  onReset: () => void;
  onRegisterSignal?: () => void;
  imageBase64?: string;
  mimeType?: string;
}

function AnalysisResultPanel({ result, options, onReset, onRegisterSignal, imageBase64, mimeType }: AnalysisResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const clarityStyle = getClarityStyle(result.confidence);

  // 차트 대화 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !imageBase64 || !mimeType) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, analysisResult: result, messages: newMessages }),
      });
      const data = await res.json();
      if (res.ok && data.content) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.error ?? "응답을 받지 못했습니다." }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "네트워크 오류가 발생했습니다." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatLoading, chatMessages, imageBase64, mimeType, result]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(formatResultText(result, options));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result, options, copyToClipboard]);

  const handleDownload = useCallback(() => {
    const payload = { analyzedAt: new Date().toISOString(), ...(options && { options }), result };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chart-analysis-${options?.symbol ?? "chart"}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result, options]);

  const handleShare = useCallback(async () => {
    const text = formatResultText(result, options);
    const title = options ? `Chart Vision AI - ${options.symbol} ${options.timeframe}` : "Chart Vision AI 분석 결과";
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, text }); return; } catch { /* fallback */ }
    }
    await copyToClipboard(text);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }, [result, options, copyToClipboard]);

  const btnBase = "flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

  const hasLongGuide = !!(result.entryZoneLong || result.tp1Long || result.stopLossLong);
  const hasShortGuide = !!(result.entryZoneShort || result.tp1Short || result.stopLossShort);
  const hasTpSl = hasLongGuide || hasShortGuide;
  const hasCandlePatterns = result.candlePatterns && result.candlePatterns.length > 0;

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" aria-label="분석 결과">
      {/* 헤더 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          분석 결과
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={handleCopy} aria-label="분석 결과 텍스트 복사" className={btnBase}>
            {copied ? "복사됨" : "복사"}
          </button>
          <button onClick={handleDownload} aria-label="분석 결과 JSON 다운로드" className={btnBase}>JSON</button>
          <button onClick={handleShare} aria-label="분석 결과 공유" className={btnBase}>
            {shared ? "복사됨" : "공유"}
          </button>
          {onRegisterSignal && (
            <button
              onClick={onRegisterSignal}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-xs text-violet-400 transition-colors hover:border-violet-400 hover:text-violet-300 focus:outline-none"
            >
              적중률 등록
            </button>
          )}
          <button
            onClick={onReset}
            aria-label="분석 결과 초기화"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-500 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 방향 해석 안내 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">방향 해석</p>
        <p className="text-sm leading-relaxed text-zinc-300">
          이 결과는 롱/숏 중 하나를 확정 추천하지 않고, 현재 차트에서 참고할 수 있는 양방향 시나리오를 나눠 보여줍니다. 실제 방향 판단은 아래 지지, 저항, 조건 확인을 함께 봐야 합니다.
        </p>
      </div>

      {/* 상위 TF 컨텍스트 */}
      {result.higherTimeframeContext && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">상위 타임프레임 컨텍스트</p>
          <p className="text-sm leading-relaxed text-blue-300">{result.higherTimeframeContext}</p>
        </div>
      )}

      {/* 추세 / 패턴 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">추세</p>
          <p className="text-base font-bold text-zinc-100">{result.trend}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">패턴</p>
          <p className="text-base font-bold text-zinc-100">{result.pattern}</p>
          {hasCandlePatterns && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.candlePatterns!.map((p, i) => (
                <span key={i} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 지지선 / 저항선 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">지지선</p>
          <LevelList items={result.supportLevels} colorClass="border border-emerald-500/30 bg-emerald-500/15 text-emerald-400" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">저항선</p>
          <LevelList items={result.resistanceLevels} colorClass="border border-red-500/30 bg-red-500/15 text-red-400" />
        </div>
      </div>

      {/* 매매 가이드 — 롱/숏 분리 */}
      {hasTpSl && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hasLongGuide && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-500">롱 매매 가이드</p>
              <div className="space-y-2">
                {result.entryZoneLong && <GuideRow label="진입 구간" value={result.entryZoneLong} color="text-emerald-300" />}
                {result.tp1Long && <GuideRow label="TP 1차" value={result.tp1Long} color="text-emerald-400" />}
                {result.tp2Long && <GuideRow label="TP 2차" value={result.tp2Long} color="text-emerald-300" />}
                {result.stopLossLong && <GuideRow label="손절가" value={result.stopLossLong} color="text-red-400" />}
                {result.riskRewardLong && <GuideRow label="R : R" value={result.riskRewardLong} color="text-violet-300" bold />}
              </div>
            </div>
          )}
          {hasShortGuide && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-500">숏 매매 가이드</p>
              <div className="space-y-2">
                {result.entryZoneShort && <GuideRow label="진입 구간" value={result.entryZoneShort} color="text-red-300" />}
                {result.tp1Short && <GuideRow label="TP 1차" value={result.tp1Short} color="text-red-400" />}
                {result.tp2Short && <GuideRow label="TP 2차" value={result.tp2Short} color="text-red-300" />}
                {result.stopLossShort && <GuideRow label="손절가" value={result.stopLossShort} color="text-orange-400" />}
                {result.riskRewardShort && <GuideRow label="R : R" value={result.riskRewardShort} color="text-violet-300" bold />}
              </div>
            </div>
          )}
        </div>
      )}
      {hasTpSl && (
        <p className="text-xs text-zinc-600">차트 구조 기반 참고값입니다. 실제 진입/청산은 반드시 본인이 직접 판단하세요.</p>
      )}

      {/* 롱/숏 관점 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <Badge color="bg-emerald-500/20 text-emerald-400">롱 관점 참고</Badge>
            <span
              className={`text-lg font-bold tabular-nums ${result.longScore >= 60 ? "text-emerald-400" : result.longScore >= 40 ? "text-yellow-400" : "text-zinc-500"}`}
              aria-label={`롱 점수 ${result.longScore}점`}
            >
              {result.longScore}<span className="text-xs font-normal text-zinc-500">점</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{result.longView}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <Badge color="bg-red-500/20 text-red-400">숏 관점 참고</Badge>
            <span
              className={`text-lg font-bold tabular-nums ${result.shortScore >= 60 ? "text-red-400" : result.shortScore >= 40 ? "text-yellow-400" : "text-zinc-500"}`}
              aria-label={`숏 점수 ${result.shortScore}점`}
            >
              {result.shortScore}<span className="text-xs font-normal text-zinc-500">점</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{result.shortView}</p>
        </div>
      </div>

      {/* 리스크 */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">리스크</p>
        <p className="text-sm leading-relaxed text-zinc-300">{result.riskSummary}</p>
      </div>

      {/* 분석 명확도 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">분석 명확도</p>
            <p className={`mt-0.5 text-xs ${clarityStyle.text}`}>{clarityStyle.label}</p>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${clarityStyle.text}`} aria-label={`분석 명확도 ${result.confidence}%`}>
            {result.confidence}%
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuenow={result.confidence}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="분석 명확도"
        >
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${clarityStyle.bar}`}
            style={{ width: `${result.confidence}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          이미지에서 차트 구조와 주요 레벨을 얼마나 명확히 읽었는지에 대한 참고 점수입니다.
        </p>
      </div>

      {/* 차트 대화 */}
      {imageBase64 && mimeType && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            이 차트에 대해 질문하기
          </p>

          {chatMessages.length > 0 && (
            <div className="mb-3 max-h-72 space-y-3 overflow-y-auto pr-1">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-500/20 text-emerald-100"
                        : "border border-zinc-700 bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {chatMessages.length === 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                "왜 이 레벨이 지지선인가요?",
                "이 패턴이 실패하면 어떻게 되나요?",
                "가장 주목할 캔들이 어디인가요?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setChatInput(q)}
                  className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendChat();
                }
              }}
              placeholder="이 차트에 대해 궁금한 점을 물어보세요..."
              disabled={chatLoading}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || chatLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="질문 전송"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">차트 구조 질문만 가능합니다. 매매 추천은 제공하지 않습니다.</p>
        </div>
      )}
    </section>
  );
}

export default memo(AnalysisResultPanel);
