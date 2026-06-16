export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getUserById, createPaymentOrder } from "@/lib/db";
import { createCheckoutSession, CREDIT_PACKAGES } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  const user = await getUserById(userId);
  if (!user)
    return NextResponse.json({ success: false, error: "사용자를 찾을 수 없습니다." }, { status: 401 });

  let body: { packageId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pkg = CREDIT_PACKAGES.find((p) => p.id === body.packageId);
  if (!pkg)
    return NextResponse.json({ success: false, error: "유효하지 않은 패키지입니다." }, { status: 400 });

  const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const stripeSession = await createCheckoutSession(
    userId,
    user.email,
    body.packageId,
    `${origin}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    `${origin}/?payment=cancelled`
  );

  // DB에 주문 기록 (pending)
  await createPaymentOrder(userId, stripeSession.id, pkg.credits, pkg.priceKrw);

  return NextResponse.json({ success: true, url: stripeSession.url });
}
