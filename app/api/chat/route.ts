export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import type { AnalysisResult } from "@/lib/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  imageBase64: string;
  mimeType: string;
  analysisResult: AnalysisResult;
  messages: ChatMessage[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { imageBase64, mimeType, analysisResult, messages } = body;
  if (!imageBase64 || !mimeType || !messages?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const systemPrompt = `당신은 차트 기술적 분석 전문가입니다. 사용자가 업로드한 차트를 이미 분석했으며 결과는 아래와 같습니다.

[기존 분석 결과]
- 추세: ${analysisResult.trend}
- 패턴: ${analysisResult.pattern}
- 캔들 패턴: ${analysisResult.candlePatterns?.join(", ") || "없음"}
- 지지선: ${analysisResult.supportLevels?.join(", ") || "없음"}
- 저항선: ${analysisResult.resistanceLevels?.join(", ") || "없음"}
- 롱 관점: ${analysisResult.longView}
- 숏 관점: ${analysisResult.shortView}
- 리스크 요약: ${analysisResult.riskSummary}

이 차트 이미지를 직접 보면서 사용자 질문에 기술적 분석 관점에서 답하세요.

답변 원칙:
- 매매 지시·리딩이 아닌 차트 구조 해석에 집중
- 한국어로 답변
- 간결하고 명확하게 (3~5문장 내외)
- "~하세요" 지시형 대신 "~로 보입니다", "~가 확인됩니다" 형태 사용
- 차트에서 직접 보이는 근거를 들어 설명`;

  // 첫 번째 user 메시지에만 이미지 포함
  const anthropicMessages = messages.map((msg: ChatMessage, idx: number) => {
    if (msg.role === "user" && idx === 0) {
      return {
        role: "user" as const,
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          { type: "text", text: msg.content },
        ],
      };
    }
    return { role: msg.role as "user" | "assistant", content: msg.content };
  });

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-5",
        max_tokens: 800,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ error: "AI 응답 실패" }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    return NextResponse.json({ content: text });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json({ error: "AI 응답 실패. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
