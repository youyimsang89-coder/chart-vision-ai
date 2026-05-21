/**
 * lib/db.ts
 * Supabase Postgres 기반 데이터베이스 레이어
 * JSON 파일 DB에서 교체 — 함수 시그니처 동일하게 유지
 */
import bcrypt from "bcryptjs";
import { supabase } from "./supabase";

// ─── 타입 정의 ──────────────────────────────────────────────

export interface DbUser {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "admin";
  credits: number;
  createdAt: number; // unix timestamp ms
}

export interface DbAnalysisLog {
  id: number;
  userId: number;
  symbol: string;
  timeframe: string;
  purpose: string;
  creditsUsed: number;
  mode: string;
  createdAt: number;
}

export interface DbCreditTransaction {
  id: number;
  userId: number;
  amount: number;
  reason: string;
  adminId: number | null;
  createdAt: number;
}

export interface AdminStats {
  totalUsers: number;
  totalAnalyses: number;
  totalCreditsUsed: number;
  todayAnalyses: number;
}

// ─── 내부 변환 헬퍼 ──────────────────────────────────────────

function toDbUser(row: Record<string, unknown>): DbUser {
  return {
    id: row.id as number,
    email: row.email as string,
    name: row.name as string,
    passwordHash: row.password_hash as string,
    role: row.role as "user" | "admin",
    credits: row.credits as number,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

function toDbLog(row: Record<string, unknown>): DbAnalysisLog {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    symbol: row.symbol as string,
    timeframe: row.timeframe as string,
    purpose: row.purpose as string,
    creditsUsed: row.credits_used as number,
    mode: row.mode as string,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

function toDbTx(row: Record<string, unknown>): DbCreditTransaction {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    amount: row.amount as number,
    reason: row.reason as string,
    adminId: row.admin_id as number | null,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

// ─── 관리자 시드 ──────────────────────────────────────────────

let _adminSeeded = false;

export async function seedAdminIfNeeded(): Promise<void> {
  if (_adminSeeded) return;
  _adminSeeded = true;

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminEmail || !adminPassword) return;

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existing) return;

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await supabase.from("users").insert({
    email: adminEmail,
    name: "관리자",
    password_hash: passwordHash,
    role: "admin",
    credits: 999999,
  });
}

// ─── User API ────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<DbUser | undefined> {
  await seedAdminIfNeeded();
  const { data } = await supabase
    .from("users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  return data ? toDbUser(data as Record<string, unknown>) : undefined;
}

export async function getUserById(id: number): Promise<DbUser | undefined> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? toDbUser(data as Record<string, unknown>) : undefined;
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string
): Promise<DbUser> {
  const initialCredits = parseInt(process.env.INITIAL_CREDITS ?? "10", 10);

  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      name,
      password_hash: passwordHash,
      role: "user",
      credits: initialCredits,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("이미 사용 중인 이메일입니다.");
    throw new Error(error.message);
  }

  const user = toDbUser(data as Record<string, unknown>);

  if (initialCredits > 0) {
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: initialCredits,
      reason: "가입 보너스",
      admin_id: null,
    });
  }

  return user;
}

export async function getAllUsers(): Promise<DbUser[]> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: unknown) => toDbUser(r as Record<string, unknown>));
}

export function getUserCredits(userId: number): Promise<number> {
  return getUserById(userId).then((u) => u?.credits ?? 0);
}

// ─── Credits API ─────────────────────────────────────────────

export async function addCredits(
  userId: number,
  amount: number,
  reason: string,
  adminId?: number
): Promise<{ success: boolean; newCredits: number }> {
  // credits 업데이트 (atomic RPC)
  const { data, error } = await supabase.rpc("increment_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) return { success: false, newCredits: 0 };

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    reason,
    admin_id: adminId ?? null,
  });

  return { success: true, newCredits: data as number };
}

export async function deductCredit(userId: number): Promise<boolean> {
  // credits 차감 (atomic RPC — 0 미만이면 실패 반환)
  const { data, error } = await supabase.rpc("decrement_credit_safe", {
    p_user_id: userId,
  });

  if (error || !data) return false;

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -1,
    reason: "차트 분석",
    admin_id: null,
  });

  return true;
}

export async function getCreditTransactions(
  userId: number
): Promise<DbCreditTransaction[]> {
  const { data } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: unknown) => toDbTx(r as Record<string, unknown>));
}

// ─── Analysis Log API ─────────────────────────────────────────

export async function logAnalysis(
  userId: number,
  symbol: string,
  timeframe: string,
  purpose: string,
  mode: string
): Promise<void> {
  await supabase.from("analysis_logs").insert({
    user_id: userId,
    symbol,
    timeframe,
    purpose,
    credits_used: 1,
    mode,
  });
}

export async function getUserAnalysisLogs(
  userId: number,
  limit = 50
): Promise<DbAnalysisLog[]> {
  const { data } = await supabase
    .from("analysis_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: unknown) => toDbLog(r as Record<string, unknown>));
}

export async function getAllAnalysisLogs(
  limit = 200
): Promise<(DbAnalysisLog & { userEmail: string; userName: string })[]> {
  const { data } = await supabase
    .from("analysis_logs")
    .select("*, users(email, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown> & {
      users: { email: string; name: string } | null;
    };
    return {
      ...toDbLog(row),
      userEmail: row.users?.email ?? "unknown",
      userName: row.users?.name ?? "unknown",
    };
  });
}

// ─── Admin Stats API ──────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [usersRes, totalLogsRes, creditSumRes, todayLogsRes] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("analysis_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("credit_transactions")
      .select("amount")
      .lt("amount", 0),
    supabase
      .from("analysis_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
  ]);

  const totalCreditsUsed = (creditSumRes.data ?? []).reduce(
    (acc: number, t: unknown) => acc + Math.abs((t as { amount: number }).amount),
    0
  );

  return {
    totalUsers: usersRes.count ?? 0,
    totalAnalyses: totalLogsRes.count ?? 0,
    totalCreditsUsed,
    todayAnalyses: todayLogsRes.count ?? 0,
  };
}
