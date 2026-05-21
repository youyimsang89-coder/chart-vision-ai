"use client";

export const dynamic = "force-dynamic";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!token) {
      setError("재설정 링크가 올바르지 않습니다.");
      return;
    }

    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.error ?? "비밀번호 변경에 실패했습니다.");
        return;
      }

      setMessage(data.message ?? "비밀번호가 변경되었습니다.");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch {
      setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
      <h2 className="mb-2 text-lg font-semibold text-zinc-100">
        새 비밀번호 설정
      </h2>
      <p className="mb-6 text-xs leading-relaxed text-zinc-500">
        새 비밀번호를 입력해주세요. 링크는 30분 동안만 유효합니다.
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
            htmlFor="password"
            className="mb-1.5 block text-xs font-medium text-zinc-400"
          >
            새 비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
            placeholder="8자 이상"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="mb-1.5 block text-xs font-medium text-zinc-400"
          >
            새 비밀번호 확인
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            autoComplete="new-password"
            placeholder="다시 입력"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-zinc-500">
        <Link
          href="/auth/login"
          className="text-emerald-400 transition hover:text-emerald-300"
        >
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}

function ResetFallback() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-zinc-800" />
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-10 animate-pulse rounded-xl bg-zinc-800" />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Chart Vision <span className="text-emerald-400">AI</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-500">비밀번호 재설정</p>
      </div>

      <Suspense fallback={<ResetFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
