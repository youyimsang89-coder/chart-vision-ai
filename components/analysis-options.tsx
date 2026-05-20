"use client";

import { memo, useCallback } from "react";
import { AnalysisOptions, Purpose, Timeframe } from "@/lib/types";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1분" },
  { value: "5m", label: "5분" },
  { value: "15m", label: "15분" },
  { value: "1h", label: "1시간" },
  { value: "4h", label: "4시간" },
  { value: "1D", label: "일봉" },
];

const PURPOSES: { value: Purpose; label: string; desc: string }[] = [
  { value: "scalping", label: "스캘핑", desc: "초단기" },
  { value: "daytrading", label: "데이", desc: "당일" },
  { value: "swing", label: "스윙", desc: "수일~수주" },
];

interface AnalysisOptionsProps {
  options: AnalysisOptions;
  onChange: (options: AnalysisOptions) => void;
  disabled?: boolean;
}

function AnalysisOptionsPanel({
  options,
  onChange,
  disabled = false,
}: AnalysisOptionsProps) {
  const handleSymbolChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...options, symbol: event.target.value.toUpperCase() });
    },
    [options, onChange]
  );

  const handleTimeframeChange = useCallback(
    (timeframe: Timeframe) => onChange({ ...options, timeframe }),
    [options, onChange]
  );

  const handlePurposeChange = useCallback(
    (purpose: Purpose) => onChange({ ...options, purpose }),
    [options, onChange]
  );

  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="symbol-input"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400"
        >
          종목
        </label>
        <input
          id="symbol-input"
          type="text"
          value={options.symbol}
          onChange={handleSymbolChange}
          disabled={disabled}
          placeholder="BTCUSDT"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
        />
      </div>

      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          타임프레임
        </legend>
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-6"
          role="group"
          aria-label="타임프레임 선택"
        >
          {TIMEFRAMES.map((timeframe) => {
            const selected = options.timeframe === timeframe.value;
            return (
              <button
                key={timeframe.value}
                type="button"
                onClick={() => handleTimeframeChange(timeframe.value)}
                disabled={disabled}
                aria-pressed={selected}
                className={[
                  "rounded-lg py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50",
                  selected
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                ].join(" ")}
              >
                {timeframe.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          분석 목적
        </legend>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="분석 목적 선택">
          {PURPOSES.map((purpose) => {
            const selected = options.purpose === purpose.value;
            return (
              <button
                key={purpose.value}
                type="button"
                onClick={() => handlePurposeChange(purpose.value)}
                disabled={disabled}
                aria-pressed={selected}
                className={[
                  "flex flex-col items-center rounded-lg px-2 py-2.5 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50",
                  selected
                    ? "border border-emerald-500 bg-emerald-500/15 text-emerald-400"
                    : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
                ].join(" ")}
              >
                <span className="font-semibold">{purpose.label}</span>
                <span className="mt-0.5 text-xs opacity-70">{purpose.desc}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

export default memo(AnalysisOptionsPanel);
