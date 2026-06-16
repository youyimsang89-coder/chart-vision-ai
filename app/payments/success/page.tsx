"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }

    // 잠시 후 크레딧 확인 (webhook이 처리될 시간)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/user/credits");
        if (res.ok) {
          const data = await res.json();
          setCredits(data.credits);
        }
        setStatus("success");
      } catch {
        setStatus("success"); // 결제는 성공했으니 일단 success 표시
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      {status === "loading" && (
        <div className="text-center">
          <svg className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
          </svg>
          <p className="text-zinc-400">결제를 확인하는 중...</p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 mx-auto">
            <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-100">결제 완료!</h1>
          <p className="mb-2 text-zinc-400">크레딧이 계정에 지급되었습니다.</p>
          {credits !== null && (
            <p className="mb-6 text-lg font-semibold text-emerald-400">현재 잔여 크레딧: {credits.toLocaleString()}</p>
          )}
          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-black transition hover:bg-emerald-400"
          >
            차트 분석 시작하기
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 mx-auto">
            <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold">결제 오류</h1>
          <p className="mb-6 text-zinc-400">결제 처리 중 문제가 발생했습니다. 고객 지원에 문의해 주세요.</p>
          <button onClick={() => router.push("/")} className="rounded-xl bg-zinc-700 px-6 py-3 font-semibold transition hover:bg-zinc-600">
            홈으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
