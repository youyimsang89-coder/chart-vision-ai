"use client";

export const dynamic = "force-dynamic";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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

interface TempPasswordResult {
  name: string;
  email: string;
  temporaryPassword: string;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function purposeLabel(purpose: string) {
  if (purpose === "scalping") return "스캘핑";
  if (purpose === "daytrading") return "데이";
  if (purpose === "swing") return "스윙";
  return purpose;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"overview" | "users" | "logs">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [chargeModal, setChargeModal] = useState<{ user: AdminUser } | null>(null);
  const [chargeAmount, setChargeAmount] = useState("10");
  const [chargeReason, setChargeReason] = useState("");
  const [charging, setCharging] = useState(false);
  const [chargeMessage, setChargeMessage] = useState<string | null>(null);

  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [tempPassword, setTempPassword] = useState<TempPasswordResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsResponse, usersResponse] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ]);

      const statsData = await statsResponse.json();
      const usersData = await usersResponse.json();

      if (!statsResponse.ok || !usersResponse.ok) {
        throw new Error(
          statsData.error || usersData.error || "관리자 데이터를 불러오지 못했습니다."
        );
      }

      setStats(statsData.stats);
      setRecentLogs(statsData.recentLogs ?? []);
      setUsers(usersData.users ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "관리자 데이터 로드에 실패했습니다.");
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
  }, [loadData, router, session, status]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(keyword) ||
        user.name.toLowerCase().includes(keyword)
    );
  }, [search, users]);

  async function handleCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chargeModal) return;

    const amount = Number.parseInt(chargeAmount, 10);
    if (!Number.isFinite(amount) || amount === 0) {
      setChargeMessage("충전 또는 차감할 횟수를 입력해주세요.");
      return;
    }

    setCharging(true);
    setChargeMessage(null);

    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: chargeModal.user.id,
          amount,
          reason: chargeReason.trim() || "관리자 수동 처리",
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "크레딧 처리에 실패했습니다.");
      }

      setChargeMessage(`처리 완료. 현재 잔여 횟수: ${data.newCredits}회`);
      await loadData();
    } catch (caught) {
      setChargeMessage(caught instanceof Error ? caught.message : "크레딧 처리에 실패했습니다.");
    } finally {
      setCharging(false);
    }
  }

  async function handleResetPassword(user: AdminUser) {
    const confirmed = window.confirm(
      `${user.name} (${user.email}) 계정의 비밀번호를 임시 비밀번호로 초기화할까요?`
    );
    if (!confirmed) return;

    setResettingUserId(user.id);
    setError(null);

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "임시 비밀번호 발급에 실패했습니다.");
      }

      setTempPassword({
        name: data.user.name,
        email: data.user.email,
        temporaryPassword: data.temporaryPassword,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "임시 비밀번호 발급에 실패했습니다.");
    } finally {
      setResettingUserId(null);
    }
  }

  async function copyTemporaryPassword() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword.temporaryPassword);
  }

  if (status === "loading" || (loading && !stats)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        관리자 페이지 로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
            >
              메인으로
            </button>
            <div>
              <div className="text-sm font-semibold">관리자 대시보드</div>
              <div className="text-xs text-zinc-500">{session?.user?.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            새로고침
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {[
            ["overview", "개요"],
            ["users", `사용자 관리 (${users.length})`],
            ["logs", "분석 기록"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as "overview" | "users" | "logs")}
              className={[
                "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                tab === value ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && stats && (
          <section className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="총 사용자" value={stats.totalUsers} />
              <StatCard label="총 분석" value={stats.totalAnalyses} />
              <StatCard label="오늘 분석" value={stats.todayAnalyses} />
              <StatCard label="사용된 횟수" value={stats.totalCreditsUsed} />
            </div>
            <LogTable logs={recentLogs.slice(0, 10)} />
          </section>
        )}

        {tab === "users" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-72"
              />
              <span className="text-xs text-zinc-500">{filteredUsers.length}명</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                      <th className="px-4 py-3 font-medium">사용자</th>
                      <th className="px-4 py-3 font-medium">권한</th>
                      <th className="px-4 py-3 text-right font-medium">잔여 횟수</th>
                      <th className="px-4 py-3 text-right font-medium">총 분석</th>
                      <th className="px-4 py-3 font-medium">가입일</th>
                      <th className="px-4 py-3 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-800/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200">{user.name}</div>
                          <div className="text-xs text-zinc-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {user.role === "admin" ? "관리자" : "일반"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">
                          {user.credits.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">
                          {user.totalAnalyses.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setChargeModal({ user });
                                setChargeAmount("10");
                                setChargeReason("");
                                setChargeMessage(null);
                              }}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                            >
                              횟수 충전
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                              disabled={resettingUserId === user.id}
                              className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-60"
                            >
                              {resettingUserId === user.id ? "발급 중..." : "임시 비번"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "logs" && <LogTable logs={recentLogs} />}
      </main>

      {chargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">횟수 충전 / 차감</h3>
              <button
                type="button"
                onClick={() => setChargeModal(null)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                닫기
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-zinc-800 p-3 text-sm">
              <div className="font-medium">{chargeModal.user.name}</div>
              <div className="text-xs text-zinc-500">{chargeModal.user.email}</div>
              <div className="mt-2 text-xs text-zinc-400">
                현재 잔여 횟수:{" "}
                <span className="font-bold text-emerald-400">{chargeModal.user.credits}</span>
              </div>
            </div>
            {chargeMessage && (
              <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200">
                {chargeMessage}
              </div>
            )}
            <form onSubmit={handleCharge} className="space-y-3">
              <label className="block text-xs font-medium text-zinc-400">
                횟수
                <input
                  type="number"
                  value={chargeAmount}
                  onChange={(event) => setChargeAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-400">
                사유
                <input
                  value={chargeReason}
                  onChange={(event) => setChargeReason(event.target.value)}
                  placeholder="관리자 수동 충전"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>
              <button
                type="submit"
                disabled={charging}
                className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {charging ? "처리 중..." : "처리하기"}
              </button>
            </form>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-yellow-500/40 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-yellow-200">임시 비밀번호 발급 완료</h3>
            <p className="mt-2 text-sm text-zinc-400">
              아래 임시 비밀번호는 이 화면에서만 확인됩니다. 사용자에게 직접 전달해주세요.
            </p>
            <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">
              <div className="font-medium text-zinc-100">{tempPassword.name}</div>
              <div className="text-xs text-zinc-500">{tempPassword.email}</div>
            </div>
            <div className="mt-4 rounded-lg border border-zinc-700 bg-black px-4 py-3 font-mono text-lg text-emerald-300">
              {tempPassword.temporaryPassword}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={copyTemporaryPassword}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                복사
              </button>
              <button
                type="button"
                onClick={() => setTempPassword(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="text-2xl font-bold text-emerald-400">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function LogTable({ logs }: { logs: RecentLog[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">사용자</th>
              <th className="px-4 py-3 font-medium">종목</th>
              <th className="px-4 py-3 font-medium">타임프레임</th>
              <th className="px-4 py-3 font-medium">목적</th>
              <th className="px-4 py-3 font-medium">모드</th>
              <th className="px-4 py-3 font-medium">일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-zinc-800/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-200">{log.userName}</div>
                  <div className="text-xs text-zinc-500">{log.userEmail}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">{log.symbol}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">{log.timeframe}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">{purposeLabel(log.purpose)}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">{log.mode}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(log.createdAt)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-zinc-600">
                  표시할 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
