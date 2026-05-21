export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function hasValue(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    env: {
      SUPABASE_URL: hasValue("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: hasValue("SUPABASE_SERVICE_ROLE_KEY"),
      NEXTAUTH_SECRET: hasValue("NEXTAUTH_SECRET"),
      NEXTAUTH_URL: hasValue("NEXTAUTH_URL"),
      ANTHROPIC_API_KEY: hasValue("ANTHROPIC_API_KEY"),
    },
  });
}
