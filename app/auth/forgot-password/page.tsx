"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Chart Vision <span className="text-emerald-400">AI</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-500">비밀번호 초기화 안내</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-zinc-100">
          비밀번호를 잊으셨나요?
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-zinc-400">
          현재는 이메일 자동 재설정 대신 운영자가 임시 비밀번호를 발급하는 방식으로
          처리합니다.
        </p>

        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <p className="font-semibold text-yellow-200">요청 방법</p>
          <p className="mt-2 leading-relaxed text-yellow-100/80">
            가입한 이메일 주소를 관리자에게 알려주세요. 관리자가 확인 후 임시
            비밀번호를 발급해드립니다.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-xs leading-relaxed text-zinc-500">
          임시 비밀번호로 로그인한 뒤, 우측 상단 사용자 메뉴에서
          <span className="font-semibold text-zinc-300"> 비밀번호 변경</span>을 눌러
          새 비밀번호로 바꿔주세요.
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2">
          <Link
            href="/auth/login"
            className="rounded-xl bg-emerald-500 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            로그인으로 돌아가기
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-center text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
          >
            새 계정 만들기
          </Link>
        </div>
      </div>
    </div>
  );
}
