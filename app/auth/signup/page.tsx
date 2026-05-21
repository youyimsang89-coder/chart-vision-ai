"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initialCredits = Number.parseInt(
    process.env.NEXT_PUBLIC_INITIAL_CREDITS ?? "5",
    10
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          password,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.error ?? "회원가입에 실패했습니다.");
        return;
      }

      router.push("/auth/login?registered=1");
    } catch {
      setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-8">
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

      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl backdrop-blur">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">회원가입</h2>
        <p className="mb-6 text-xs text-zinc-500">
          가입하면 무료 분석{" "}
          <span className="font-semibold text-emerald-400">
            {Number.isFinite(initialCredits) ? initialCredits : 5}회
          </span>
          가 지급됩니다.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              이름
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
              placeholder="홍길동"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

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
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              비밀번호 <span className="text-zinc-600">(최소 8자)</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
              placeholder="비밀번호 입력"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              비밀번호 확인
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              autoComplete="new-password"
              placeholder="비밀번호 다시 입력"
              className={[
                "w-full rounded-lg border px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:outline-none focus:ring-1",
                confirm && password !== confirm
                  ? "border-red-500/60 bg-red-500/5 focus:border-red-500 focus:ring-red-500"
                  : "border-zinc-700 bg-zinc-800/60 focus:border-emerald-500 focus:ring-emerald-500",
              ].join(" ")}
            />
            {confirm && password !== confirm && (
              <p className="mt-1 text-xs text-red-400">
                비밀번호가 일치하지 않습니다.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (!!confirm && password !== confirm)}
            className="mt-2 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-500"
          >
            {loading ? "가입 중..." : "무료 가입하기"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-500">
          이미 계정이 있으신가요?{" "}
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
