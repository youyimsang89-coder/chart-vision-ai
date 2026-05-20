"use client";

import { useState, useCallback, FormEvent } from "react";

interface PasswordGateProps {
  onSuccess: (password: string) => void;
}

export default function PasswordGate({ onSuccess }: PasswordGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) {
        setError("비밀번호를 입력해주세요.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessPassword: trimmed }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!res.ok || !json.success) {
          setError(json.error ?? "비밀번호가 올바르지 않습니다.");
          return;
        }
        onSuccess(trimmed);
      } catch {
        setError("서버에 연결할 수 없습니다. 네트워크를 확인해주세요.");
      } finally {
        setLoading(false);
      }
    },
    [value, onSuccess]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <svg
              className="h-6 w-6 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">
              Chart Vision <span className="text-emerald-400">AI</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">접근 비밀번호를 입력하세요</p>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder="비밀번호"
              autoFocus
              autoComplete="current-password"
              className={[
                "w-full rounded-xl border bg-zinc-900 px-4 py-3 text-sm text-zinc-100",
                "placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500",
                error ? "border-red-500/50" : "border-zinc-800",
              ].join(" ")}
            />
            {error && (
              <p className="mt-2 text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={[
              "w-full rounded-xl py-3 text-sm font-semibold transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              loading
                ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                : "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.98]",
            ].join(" ")}
          >
            {loading ? "확인 중..." : "입장"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-700">
          권한이 없으면 관리자에게 문의하세요
        </p>
      </div>
    </div>
  );
}
