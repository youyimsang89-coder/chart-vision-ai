export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { fulfillPaymentOrder } from "@/lib/db";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = constructWebhookEvent(payload, sig);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; payment_status?: string };
    if (session.payment_status === "paid") {
      try {
        await fulfillPaymentOrder(session.id);
      } catch (err) {
        console.error("[Webhook] fulfillPaymentOrder failed:", err);
        return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
