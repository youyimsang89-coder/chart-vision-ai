"use client";

import { memo, useCallback, useEffect, useState } from "react";

interface SignalResult {
  id: number;
  symbol: string;
  timeframe: string;
  purpose: string;
  longScore: number;
  shortScore: number;
  signalDirection: "long" | "short" | null;
  outcome: "win" | "loss" | "break_even" | null;
  note: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

interface SignalStats {
  total: number;
  resolved: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  bySymbol: { symbol: string; total: number; wins: number; winRate: number }[];
}

// ── 통계 요약 카드 ──────────────────────────────────────────────

function StatsCard({ stats }: { stats: SignalStats }) {
  const winColor =
    stats.winRate >= 60
      ? "text-emerald-400"
      : stats.winRate >= 45
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        적중률 통계
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-zinc-500">전체</p>
          <p className="text-xl font-bold text-zinc-100">{stats.total}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">결과 기록</p>
          <p className="text-xl font-bold text-zinc-100">{stats.resolved}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">승률</p>
          <p className={`text-xl font-bold ${winColor}`}>
            {stats.resolved > 0 ? `${stats.winRate}%` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">승</p>
          <p className="text-lg font-bold text-emerald-400">{stats.wins}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">패</p>
          <p className="text-lg font-bold text-red-400">{stats.losses}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">본전</p>
          <p className="text-lg font-bold text-zinc-400">{stats.breakEvens}</p>
        </div>
      </div>

      {stats.resolved > 0 && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${stats.winRate}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            {stats.wins}승 {stats.losses}패 {stats.breakEvens}본전 / 총 {stats.resolved}건 결과
          </p>
        </div>
      )}

      {stats.bySymbol.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-500">종목별 승률</p>
          <div className="space-y-1.5">
            {stats.bySymbol.map((s) => (
              <div key={s.symbol} className="flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-300">{s.symbol}</span>
                <span className={s.winRate >= 60 ? "text-emerald-400" : s.winRate >= 45 ? "text-yellow-400" : "text-red-400"}>
                  {s.winRate}% ({s.wins}/{s.total})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 결과 기록 모달 ──────────────────────────────────────────────

interface ResolveModalProps {
  signal: SignalResult;
  onResolve: (
    id: number,
    outcome: "win" | "loss" | "break_even",
    direction: "long" | "short",
    note?: string
  ) => void;
  onClose: () => void;
}

function ResolveModal({ signal, onResolve, onClose }: ResolveModalProps) {
  const [direction, setDirection] = useState<"long" | "short">(
    signal.longScore >= signal.shortScore ? "long" : "short"
  );
  const [outcome, setOutcome] = useState<"win" | "loss" | "break_even">("win");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl border border-zinc-700 bg-zinc-900 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-100">결과 기록</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        <p className="mb-4 text-sm text-zinc-400">
          <span className="font-mono font-semibold text-zinc-200">{signal.symbol}</span>{" "}
          {signal.timeframe} 분석 결과를 기록합니다.
        </p>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500">어느 방향으로 매매했나요?</p>
            <div className="flex gap-2">
              {(["long", "short"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                    direction === d
                      ? d === "long"
                        ? "bg-emerald-500 text-black"
                        : "bg-red-500 text-white"
                      : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {d === "long" ? "롱 (매수)" : "숏 (매도)"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500">결과는?</p>
            <div className="flex gap-2">
              {([
                { v: "win", label: "수익", color: "bg-emerald-500 text-black" },
                { v: "loss", label: "손실", color: "bg-red-500 text-white" },
                { v: "break_even", label: "본전", color: "bg-zinc-600 text-zinc-200" },
              ] as const).map(({ v, label, color }) => (
                <button
                  key={v}
                  onClick={() => setOutcome(v)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                    outcome === v
                      ? color
                      : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-zinc-500">메모 (선택)</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: TP1 도달 후 청산, 갑작스런 뉴스로 손절..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => onResolve(signal.id, outcome, direction, note || undefined)}
          className="mt-5 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          기록 저장
        </button>
      </div>
    </div>
  );
}

// ── 시그널 목록 아이템 ──────────────────────────────────────────

function SignalItem({
  signal,
  onResolveClick,
}: {
  signal: SignalResult;
  onResolveClick: (s: SignalResult) => void;
}) {
  const outcomeLabel =
    signal.outcome === "win"
      ? { label: "수익", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" }
      : signal.outcome === "loss"
      ? { label: "손실", cls: "bg-red-500/10 text-red-400 border-red-500/30" }
      : signal.outcome === "break_even"
      ? { label: "본전", cls: "bg-zinc-700/50 text-zinc-400 border-zinc-600" }
      : { label: "미결", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-zinc-100">{signal.symbol}</span>
          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">{signal.timeframe}</span>
          {signal.signalDirection && (
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${signal.signalDirection === "long" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {signal.signalDirection === "long" ? "롱" : "숏"}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
          <span>롱 {signal.longScore}점</span>
          <span>·</span>
          <span>숏 {signal.shortScore}점</span>
          <span>·</span>
          <span>{new Date(signal.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        {signal.note && <p className="mt-1 text-xs text-zinc-500">{signal.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${outcomeLabel.cls}`}>
          {outcomeLabel.label}
        </span>
        {!signal.outcome && (
          <button
            onClick={() => onResolveClick(signal)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            기록
          </button>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

function SignalTracker() {
  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<SignalResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/signals");
      if (!res.ok) return;
      const data = await res.json();
      setSignals(data.signals ?? []);
      setStats(data.stats ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleResolve = useCallback(
    async (id: number, outcome: "win" | "loss" | "break_even", direction: "long" | "short", note?: string) => {
      try {
        const res = await fetch(`/api/signals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome, signalDirection: direction, note }),
        });
        if (!res.ok) return;
        setResolveTarget(null);
        await fetchData();
      } catch { /* ignore */ }
    },
    [fetchData]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && <StatsCard stats={stats} />}

      {signals.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <p className="text-sm text-zinc-600">아직 등록된 시그널이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => (
            <SignalItem key={s.id} signal={s} onResolveClick={setResolveTarget} />
          ))}
        </div>
      )}

      {resolveTarget && (
        <ResolveModal
          signal={resolveTarget}
          onResolve={handleResolve}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
}

export default memo(SignalTracker);
