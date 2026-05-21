"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.error ?? "메일 발송에 실패했습니다.");
        return;
      }

      setMessage(data.message ?? "비밀번호 재설정 링크를 발송했습니다.");
    } catch {
      setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Chart Vision <span className="text-emerald-400">AI</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-500">비밀번호 재설정</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-zinc-100">
          비밀번호 찾기
        </h2>
        <p className="mb-6 text-xs leading-relaxed text-zinc-500">
          가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.
        </p>

        {message && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="example@email.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "발송 중..." : "재설정 링크 받기"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-500">
          기억나셨나요?{" "}
          <Link
            href="/auth/login"
            className="text-emerald-400 transition hover:text-emerald-300"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
