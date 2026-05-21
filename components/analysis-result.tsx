"use client";

import { memo, useCallback, useState } from "react";
import { AnalysisOptions, AnalysisResult } from "@/lib/types";

function getClarityStyle(confidence: number) {
  if (confidence >= 90) {
    return { text: "text-emerald-400", bar: "bg-emerald-500", label: "높음" };
  }
  if (confidence >= 70) {
    return { text: "text-yellow-400", bar: "bg-yellow-500", label: "보통" };
  }
  return { text: "text-red-400", bar: "bg-red-500", label: "낮음" };
}

function formatResultText(
  result: AnalysisResult,
  options?: AnalysisOptions
): string {
  const header = options
    ? `Chart Vision AI 분석 결과\n종목: ${options.symbol} | 타임프레임: ${options.timeframe}\n`
    : "Chart Vision AI 분석 결과\n";

  return `${header}
추세: ${result.trend}
패턴: ${result.pattern}
지지선: ${result.supportLevels.join(", ") || "없음"}
저항선: ${result.resistanceLevels.join(", ") || "없음"}

롱 관점 참고:
${result.longView}

숏 관점 참고:
${result.shortView}

리스크:
${result.riskSummary}

분석 명확도: ${result.confidence}%`.trim();
}

const Badge = memo(function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
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
}

function AnalysisResultPanel({
  result,
  options,
  onReset,
}: AnalysisResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const clarityStyle = getClarityStyle(result.confidence);

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
    const payload = {
      analyzedAt: new Date().toISOString(),
      ...(options && { options }),
      result,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
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
    const title = options
      ? `Chart Vision AI - ${options.symbol} ${options.timeframe}`
      : "Chart Vision AI 분석 결과";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        // 공유 취소 시 복사 fallback으로 이어갑니다.
      }
    }

    await copyToClipboard(text);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }, [result, options, copyToClipboard]);

  const btnBase =
    "flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

  return (
    <section
      className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
      aria-label="분석 결과"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-100">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"
            aria-hidden="true"
          />
          분석 결과
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleCopy}
            aria-label="분석 결과 텍스트 복사"
            className={btnBase}
          >
            {copied ? "복사됨" : "복사"}
          </button>
          <button
            onClick={handleDownload}
            aria-label="분석 결과 JSON 다운로드"
            className={btnBase}
          >
            JSON
          </button>
          <button
            onClick={handleShare}
            aria-label="분석 결과 공유"
            className={btnBase}
          >
            {shared ? "복사됨" : "공유"}
          </button>
          <button
            onClick={onReset}
            aria-label="분석 결과 초기화"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-500 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          방향 해석
        </p>
        <p className="text-sm leading-relaxed text-zinc-300">
          이 결과는 롱/숏 중 하나를 확정 추천하지 않고, 현재 차트에서 참고할 수
          있는 양방향 시나리오를 나눠 보여줍니다. 실제 방향 판단은 아래 지지,
          저항, 조건 확인을 함께 봐야 합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            추세
          </p>
          <p className="text-base font-bold text-zinc-100">{result.trend}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            패턴
          </p>
          <p className="text-base font-bold text-zinc-100">{result.pattern}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            지지선
          </p>
          <LevelList
            items={result.supportLevels}
            colorClass="border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            저항선
          </p>
          <LevelList
            items={result.resistanceLevels}
            colorClass="border border-red-500/30 bg-red-500/15 text-red-400"
          />
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-2">
            <Badge color="bg-emerald-500/20 text-emerald-400">
              롱 관점 참고
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            {result.longView}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="mb-2">
            <Badge color="bg-red-500/20 text-red-400">숏 관점 참고</Badge>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            {result.shortView}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          리스크
        </p>
        <p className="text-sm leading-relaxed text-zinc-300">
          {result.riskSummary}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              분석 명확도
            </p>
            <p className={`mt-0.5 text-xs ${clarityStyle.text}`}>
              {clarityStyle.label}
            </p>
          </div>
          <span
            className={`text-2xl font-bold tabular-nums ${clarityStyle.text}`}
            aria-label={`분석 명확도 ${result.confidence}%`}
          >
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
          이 수치는 롱/숏 성공 확률이 아니라, 이미지에서 차트 구조와 주요 레벨을
          얼마나 명확히 읽었는지에 대한 참고 점수입니다.
        </p>
      </div>
    </section>
  );
}

export default memo(AnalysisResultPanel);
