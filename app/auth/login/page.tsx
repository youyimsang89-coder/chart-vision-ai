"use client";

export const dynamic = "force-dynamic";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const registered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl backdrop-blur">
      <h2 className="mb-6 text-lg font-semibold text-zinc-100">로그인</h2>

      {registered && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          회원가입이 완료되었습니다. 로그인해주세요.
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

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-zinc-400"
            >
              비밀번호
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-emerald-400 transition hover:text-emerald-300"
            >
              비밀번호 찾기
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-500"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-zinc-500">
        아직 계정이 없으신가요?{" "}
        <Link
          href="/auth/signup"
          className="text-emerald-400 transition hover:text-emerald-300"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
      <div className="mb-6 h-8 w-24 animate-pulse rounded bg-zinc-800" />
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-10 animate-pulse rounded-xl bg-zinc-800" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <svg
              className="h-5 w-5 text-black"
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
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Chart Vision <span className="text-emerald-400">AI</span>
          </h1>
        </div>
        <p className="text-sm text-zinc-500">AI 트레이딩 차트 분석 서비스</p>
      </div>

      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
