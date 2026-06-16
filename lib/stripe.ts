import Stripe from "stripe";

// ── 크레딧 패키지 정의 ─────────────────────────────────────────
export interface CreditPackage {
  id: string;
  credits: number;
  priceKrw: number;    // 표시 가격 (원)
  priceUsd: number;    // Stripe 청구 가격 (USD cents / 100)
  label: string;
  badge?: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter",  credits: 10,  priceKrw: 3900,  priceUsd: 2.99, label: "스타터",  badge: undefined },
  { id: "basic",    credits: 30,  priceKrw: 9900,  priceUsd: 7.99, label: "베이직",  badge: "인기" },
  { id: "pro",      credits: 100, priceKrw: 24900, priceUsd: 19.99, label: "프로",   badge: "절약" },
  { id: "unlimited",credits: 300, priceKrw: 59900, priceUsd: 49.99, label: "무제한팩", badge: "최대절약" },
];

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  packageId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error("Invalid package ID");

  const stripe = getStripe();

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Chart Vision AI — ${pkg.label} (${pkg.credits} 크레딧)`,
            description: `${pkg.credits}회 AI 차트 분석 크레딧`,
          },
          unit_amount: Math.round(pkg.priceUsd * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: String(userId),
      packageId,
      credits: String(pkg.credits),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

export function constructWebhookEvent(payload: string, sig: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return Stripe.webhooks.constructEvent(payload, sig, secret);
}
