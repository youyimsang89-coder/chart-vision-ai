"use client";

import { memo, useState } from "react";
import { CREDIT_PACKAGES, CreditPackage } from "@/lib/stripe";

interface CreditPurchaseModalProps {
  onClose: () => void;
}

function CreditPurchaseModal({ onClose }: CreditPurchaseModalProps) {
  const [selected, setSelected] = useState<string>("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "결제 페이지를 열 수 없습니다.");
        return;
      }
      // Stripe Checkout으로 이동
      window.location.href = data.url;
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-zinc-700 bg-zinc-900 p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">크레딧 충전</h2>
            <p className="text-xs text-zinc-500">분석 1회 = 크레딧 1개 소모</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">✕</button>
        </div>

        {/* 패키지 선택 */}
        <div className="space-y-2.5">
          {CREDIT_PACKAGES.map((pkg: CreditPackage) => (
            <button
              key={pkg.id}
              onClick={() => setSelected(pkg.id)}
              className={`relative w-full rounded-xl border p-4 text-left transition ${
                selected === pkg.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
              }`}
            >
              {pkg.badge && (
                <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-black">
                  {pkg.badge}
                </span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-100">
                    {pkg.label}
                    <span className="ml-2 text-sm font-normal text-zinc-400">
                      {pkg.credits}크레딧
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    분석 {pkg.credits}회 가능 · 개당 {Math.round(pkg.priceKrw / pkg.credits).toLocaleString()}원
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-zinc-100">
                    {pkg.priceKrw.toLocaleString()}
                    <span className="text-sm font-normal text-zinc-500">원</span>
                  </p>
                  <p className="text-xs text-zinc-600">(≈${pkg.priceUsd})</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={handlePurchase}
          disabled={loading}
          className={`mt-5 w-full rounded-xl py-3.5 text-sm font-semibold transition ${
            loading
              ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
              : "bg-emerald-500 text-black hover:bg-emerald-400"
          }`}
        >
          {loading ? "결제 페이지 여는 중..." : "Stripe로 안전하게 결제하기"}
        </button>

        <p className="mt-3 text-center text-xs text-zinc-600">
          Stripe 보안 결제 · 카드/애플페이/구글페이 지원 · 즉시 충전
        </p>
      </div>
    </div>
  );
}

export default memo(CreditPurchaseModal);
