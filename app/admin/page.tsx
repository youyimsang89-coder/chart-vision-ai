"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ── 타입 ─────────────────────────────────────────────────────

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  credits: number;
  totalAnalyses: number;
  createdAt: number;
}

interface RecentLog {
  id: number;
  userEmail: string;
  userName: string;
  symbol: string;
  timeframe: string;
  purpose: string;
  mode: string;
  createdAt: number;
}

interface Stats {
  totalUsers: number;
  totalAnalyses: number;
  totalCreditsUsed: number;
  todayAnalyses: number;
}

// ── 유틸 ─────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function purposeLabel(p: string) {
  return p === "scalping" ? "스캘핑" : p === "daytrading" ? "단타" : "스윙";
}

// ── 컴포넌트 ──────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"overview" | "users" | "logs">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 크레딧 충전 모달 상태
  const [chargeModal, setChargeModal] = useState<{ user: AdminUser } | null>(null);
  const [chargeAmount, setChargeAmount] = useState("10");
  const [chargeReason, setChargeReason] = useState("");
  const [charging, setCharging] = useState(false);
  const [chargeMsg, setChargeMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 검색 필터
  const [search, setSearch] = useState("");

  // ── 데이터 로드 ────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
      ]);
      if (!statsRes.ok || !usersRes.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      setStats(statsData.stats);
      setRecentLogs(statsData.recentLogs);
      setUsers(usersData.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      router.replace("/");
      return;
    }
    loadData();
  }, [session, status, router, loadData]);

  // ── 크레딧 충전 ────────────────────────────────────────────

  async function handleCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!chargeModal) return;
    const amount = parseInt(chargeAmount, 10);
    if (isNaN(amount) || amount === 0) {
      setChargeMsg({ type: "err", text: "유효한 크레딧 수를 입력하세요." });
      return;
    }

    setCharging(true);
    setChargeMsg(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: chargeModal.user.id,
          amount,
          reason: chargeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChargeMsg({ type: "err", text: data.error ?? "충전에 실패했습니다." });
        return;
      }
      setChargeMsg({ type: "ok", text: data.message });
      await loadData();
      setTimeout(() => {
        setChargeModal(null);
        setChargeMsg(null);
        setChargeAmount("10");
        setChargeReason("");
      }, 1500);
    } catch {
      setChargeMsg({ type: "err", text: "서버 오류가 발생했습니다." });
    } finally {
      setCharging(false);
    }
  }

  // ── 로딩 / 접근 거부 ──────────────────────────────────────

  if (status === "loading" || (loading && !stats)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
          </svg>
          <p className="text-sm text-zinc-500">관리자 페이지 로딩 중...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 text-emerald-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <span className="text-sm font-semibold">관리자 대시보드</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition"
            >
              새로고침
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 탭 */}
        <div className="mb-6 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 w-fit">
          {(["overview", "users", "logs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                tab === t
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {t === "overview" ? "개요" : t === "users" ? `유저 관리 (${users.length})` : "분석 기록"}
            </button>
          ))}
        </div>

        {/* ── 개요 탭 ───────────────────────────────────────── */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "총 가입자", value: stats.totalUsers, color: "text-emerald-400", icon: "👥" },
                { label: "총 분석 횟수", value: stats.totalAnalyses, color: "text-blue-400", icon: "📊" },
                { label: "오늘 분석", value: stats.todayAnalyses, color: "text-yellow-400", icon: "⚡" },
                { label: "소비된 크레딧", value: stats.totalCreditsUsed, color: "text-purple-400", icon: "💎" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-1 text-lg">{item.icon}</div>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 최근 분석 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-300">최근 분석 기록</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                      <th className="pb-2 pr-4 font-medium">사용자</th>
                      <th className="pb-2 pr-4 font-medium">종목</th>
                      <th className="pb-2 pr-4 font-medium">타임프레임</th>
                      <th className="pb-2 pr-4 font-medium">목적</th>
                      <th className="pb-2 font-medium">시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {recentLogs.slice(0, 10).map((log) => (
                      <tr key={log.id} className="text-zinc-400 hover:text-zinc-200 transition">
                        <td className="py-2 pr-4">
                          <div className="text-xs font-medium text-zinc-300">{log.userName}</div>
                          <div className="text-xs text-zinc-600">{log.userEmail}</div>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-emerald-400">{log.symbol}</td>
                        <td className="py-2 pr-4 text-xs">{log.timeframe}</td>
                        <td className="py-2 pr-4 text-xs">{purposeLabel(log.purpose)}</td>
                        <td className="py-2 text-xs text-zinc-500">{fmtDate(log.createdAt)}</td>
                      </tr>
                    ))}
                    {recentLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-zinc-600">
                          분석 기록이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 유저 관리 탭 ──────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="이름 또는 이메일 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-500">{filteredUsers.length}명</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 bg-zinc-900">
                      <th className="px-4 py-3 font-medium">사용자</th>
                      <th className="px-4 py-3 font-medium">역할</th>
                      <th className="px-4 py-3 font-medium text-right">크레딧</th>
                      <th className="px-4 py-3 font-medium text-right">총 분석</th>
                      <th className="px-4 py-3 font-medium">가입일</th>
                      <th className="px-4 py-3 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-800/30 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200">{user.name}</div>
                          <div className="text-xs text-zinc-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            user.role === "admin"
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-zinc-700 text-zinc-400",
                          ].join(" ")}>
                            {user.role === "admin" ? "관리자" : "일반"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold tabular-nums ${user.credits === 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {user.credits.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                          {user.totalAnalyses}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setChargeModal({ user });
                              setChargeAmount("10");
                              setChargeReason("");
                              setChargeMsg(null);
                            }}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
                          >
                            크레딧 충전
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-xs text-zinc-600">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 전체 분석 기록 탭 ─────────────────────────────── */}
        {tab === "logs" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 bg-zinc-900">
                    <th className="px-4 py-3 font-medium">사용자</th>
                    <th className="px-4 py-3 font-medium">종목</th>
                    <th className="px-4 py-3 font-medium">타임프레임</th>
                    <th className="px-4 py-3 font-medium">분석 목적</th>
                    <th className="px-4 py-3 font-medium">모드</th>
                    <th className="px-4 py-3 font-medium">일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-zinc-300">{log.userName}</div>
                        <div className="text-xs text-zinc-600">{log.userEmail}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-400">{log.symbol}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{log.timeframe}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{purposeLabel(log.purpose)}</td>
                      <td className="px-4 py-3">
                        <span className={[
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          log.mode === "claude" || log.mode === "openai"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-zinc-700 text-zinc-400",
                        ].join(" ")}>
                          {log.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(log.createdAt)}</td>
                    </tr>
                  ))}
                  {recentLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-zinc-600">
                        분석 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── 크레딧 충전 모달 ────────────────────────────────── */}
      {chargeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setChargeModal(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">크레딧 충전 / 차감</h3>
              <button
                onClick={() => setChargeModal(null)}
                className="text-zinc-500 hover:text-zinc-300 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-800/60 p-3">
              <div className="text-sm font-medium text-zinc-200">{chargeModal.user.name}</div>
              <div className="text-xs text-zinc-500">{chargeModal.user.email}</div>
              <div className="mt-1.5 text-xs text-zinc-400">
                현재 크레딧: <span className="font-bold text-emerald-400">{chargeModal.user.credits}</span>
              </div>
            </div>

            {chargeMsg && (
              <div className={[
                "mb-4 rounded-lg border px-3 py-2.5 text-sm",
                chargeMsg.type === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400",
              ].join(" ")}>
                {chargeMsg.text}
              </div>
            )}

            <form onSubmit={handleCharge} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  크레딧 수 <span className="text-zinc-600">(음수 입력 시 차감)</span>
                </label>
                <input
                  type="number"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  사유 <span className="text-zinc-600">(선택)</span>
                </label>
                <input
                  type="text"
                  value={chargeReason}
                  onChange={(e) => setChargeReason(e.target.value)}
                  placeholder="관리자 수동 충전"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setChargeModal(null)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={charging}
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-60"
                >
                  {charging ? "처리 중..." : "확인"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
