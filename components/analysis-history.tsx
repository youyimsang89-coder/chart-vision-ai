"use client";

import { memo, useCallback } from "react";
import { HistoryItem } from "@/lib/types";

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return "text-emerald-400";
  if (confidence >= 70) return "text-yellow-400";
  return "text-red-400";
}

function formatTimestamp(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;

  return new Date(timestamp).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

interface HistoryCardProps {
  item: HistoryItem;
  onSelect: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
}

const HistoryCard = memo(function HistoryCard({
  item,
  onSelect,
  onRemove,
}: HistoryCardProps) {
  const handleSelect = useCallback(() => onSelect(item), [item, onSelect]);
  const handleRemove = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove(item.id);
    },
    [item.id, onRemove]
  );

  const confidenceColor = getConfidenceColor(item.result.confidence);

  return (
    <div className="group relative flex items-stretch overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700">
      {item.thumbnailDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailDataUrl}
          alt=""
          aria-hidden="true"
          className="h-full w-16 shrink-0 object-cover opacity-70"
        />
      ) : (
        <div className="flex w-10 shrink-0 items-center justify-center bg-zinc-800" aria-hidden="true">
          <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
        </div>
      )}

      <button
        onClick={handleSelect}
        className="min-w-0 flex-1 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
        aria-label={`${item.options.symbol} ${item.options.timeframe} 분석 결과 불러오기`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-sm font-bold text-zinc-100">
            {item.options.symbol}
          </span>
          <span className={`shrink-0 text-sm font-bold tabular-nums ${confidenceColor}`}>
            {item.result.confidence}%
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
            {item.options.timeframe}
          </span>
          <span className="truncate text-xs text-zinc-600">{item.result.trend}</span>
        </div>
        <p className="mt-0.5 text-xs text-zinc-600">{formatTimestamp(item.timestamp)}</p>
      </button>

      <button
        onClick={handleRemove}
        aria-label={`${item.options.symbol} 기록 삭제`}
        className="shrink-0 px-2 text-zinc-500 opacity-100 transition-opacity hover:text-red-400 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset sm:opacity-0 sm:group-hover:opacity-100"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
});

interface AnalysisHistoryProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function AnalysisHistory({
  items,
  onSelect,
  onRemove,
  onClear,
}: AnalysisHistoryProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="분석 히스토리">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          최근 분석 <span className="font-normal text-zinc-600">({items.length}/10)</span>
        </h3>
        <button
          onClick={onClear}
          className="rounded text-xs text-zinc-600 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="분석 히스토리 전체 삭제"
        >
          전체 삭제
        </button>
      </div>

      <div className="space-y-1.5" role="list" aria-label="분석 히스토리 목록">
        {items.map((item) => (
          <div key={item.id} role="listitem">
            <HistoryCard item={item} onSelect={onSelect} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default memo(AnalysisHistory);
