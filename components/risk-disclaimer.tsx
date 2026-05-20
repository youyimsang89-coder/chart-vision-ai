export default function RiskDisclaimer() {
  return (
    <footer className="mt-8 border-t border-zinc-800 pb-8 pt-6">
      <div className="mx-auto flex max-w-2xl items-start gap-3 text-center sm:mx-0 sm:text-left">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-xs leading-relaxed text-zinc-500">
          본 분석은 참고용이며 실제 매매 책임은 사용자 본인에게 있습니다.
          AI 분석 결과는 투자 권유가 아니며, 암호화폐 및 금융 자산에는 원금 손실
          위험이 있습니다.
        </p>
      </div>
    </footer>
  );
}
