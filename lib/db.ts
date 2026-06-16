import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabase } from "./supabase";

export interface DbUser {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "admin";
  credits: number;
  createdAt: number;
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

type UserRow = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: "user" | "admin";
  credits: number;
  created_at: string;
};

type AnalysisLogRow = {
  id: number;
  user_id: number;
  symbol: string;
  timeframe: string;
  purpose: string;
  credits_used: number;
  mode: string;
  created_at: string;
};

type CreditTransactionRow = {
  id: number;
  user_id: number;
  amount: number;
  reason: string;
  admin_id: number | null;
  created_at: string;
};

type PasswordResetTokenRow = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

function toDbUser(row: UserRow): DbUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    credits: row.credits,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function toDbLog(row: AnalysisLogRow): DbAnalysisLog {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    purpose: row.purpose,
    creditsUsed: row.credits_used,
    mode: row.mode,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function toDbTx(row: CreditTransactionRow): DbCreditTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    reason: row.reason,
    adminId: row.admin_id,
    createdAt: new Date(row.created_at).getTime(),
  };
}

let adminSeeded = false;

export async function seedAdminIfNeeded(): Promise<void> {
  if (adminSeeded) return;
  adminSeeded = true;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminEmail || !adminPassword) return;

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (existing) return;

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const { error } = await supabase.from("users").insert({
    email: adminEmail,
    name: "Admin",
    password_hash: passwordHash,
    role: "admin",
    credits: 999999,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function getUserByEmail(email: string): Promise<DbUser | undefined> {
  await seedAdminIfNeeded();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toDbUser(data as UserRow) : undefined;
}

export async function getUserById(id: number): Promise<DbUser | undefined> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toDbUser(data as UserRow) : undefined;
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string
): Promise<DbUser> {
  const initialCredits = Number.parseInt(process.env.INITIAL_CREDITS ?? "5", 10);

  const { data, error } = await supabase
    .from("users")
    .insert({
      email: email.trim().toLowerCase(),
      name,
      password_hash: passwordHash,
      role: "user",
      credits: Number.isFinite(initialCredits) ? initialCredits : 5,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 사용 중인 이메일입니다.");
    }
    throw new Error(error.message);
  }

  const user = toDbUser(data as UserRow);

  if (user.credits > 0) {
    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: user.credits,
      reason: "signup_bonus",
      admin_id: null,
    });

    if (txError) throw new Error(txError.message);
  }

  return user;
}

export async function getAllUsers(): Promise<DbUser[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as UserRow[]).map(toDbUser);
}

export async function getUserCredits(userId: number): Promise<number> {
  return (await getUserById(userId))?.credits ?? 0;
}

export async function createPasswordResetToken(
  email: string
): Promise<{ token: string; user: DbUser } | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("used_at", null);

  const { error } = await supabase.from("password_reset_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);
  return { token, user };
}

export async function resetPasswordWithToken(
  token: string,
  passwordHash: string
): Promise<boolean> {
  const tokenHash = hashResetToken(token);

  const { data, error } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  const resetToken = data as PasswordResetTokenRow;
  if (new Date(resetToken.expires_at).getTime() < Date.now()) return false;

  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", resetToken.user_id);

  if (updateError) throw new Error(updateError.message);

  const { error: useError } = await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", resetToken.id);

  if (useError) throw new Error(useError.message);
  return true;
}

export async function updateUserPasswordHash(
  userId: number,
  passwordHash: string
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return true;
}

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function addCredits(
  userId: number,
  amount: number,
  reason: string,
  adminId?: number
): Promise<{ success: boolean; newCredits: number }> {
  const { data, error } = await supabase.rpc("increment_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error || typeof data !== "number") {
    return { success: false, newCredits: 0 };
  }

  const { error: txError } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    reason,
    admin_id: adminId ?? null,
  });

  if (txError) return { success: false, newCredits: data };
  return { success: true, newCredits: data };
}

export async function deductCredit(userId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("decrement_credit_safe", {
    p_user_id: userId,
  });

  if (error || data !== true) return false;

  const { error: txError } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -1,
    reason: "chart_analysis",
    admin_id: null,
  });

  return !txError;
}

export async function getCreditTransactions(
  userId: number
): Promise<DbCreditTransaction[]> {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return ((data ?? []) as CreditTransactionRow[]).map(toDbTx);
}

export async function logAnalysis(
  userId: number,
  symbol: string,
  timeframe: string,
  purpose: string,
  mode: string
): Promise<void> {
  const { error } = await supabase.from("analysis_logs").insert({
    user_id: userId,
    symbol,
    timeframe,
    purpose,
    credits_used: 1,
    mode,
  });

  if (error) throw new Error(error.message);
}

export async function getUserAnalysisLogs(
  userId: number,
  limit = 50
): Promise<DbAnalysisLog[]> {
  const { data, error } = await supabase
    .from("analysis_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as AnalysisLogRow[]).map(toDbLog);
}

export async function getAllAnalysisLogs(
  limit = 200
): Promise<(DbAnalysisLog & { userEmail: string; userName: string })[]> {
  const { data, error } = await supabase
    .from("analysis_logs")
    .select("*, users(email, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const log = row as AnalysisLogRow & {
      users: { email: string; name: string } | null;
    };

    return {
      ...toDbLog(log),
      userEmail: log.users?.email ?? "unknown",
      userName: log.users?.name ?? "unknown",
    };
  });
}

// ── 적중률 트래킹 ────────────────────────────────────────────

export interface DbSignalResult {
  id: number;
  analysisLogId: number | null;
  userId: number;
  symbol: string;
  timeframe: string;
  purpose: string;
  longScore: number;
  shortScore: number;
  signalDirection: "long" | "short" | null;
  outcome: "win" | "loss" | "break_even" | null;
  note: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

type SignalResultRow = {
  id: number;
  analysis_log_id: number | null;
  user_id: number;
  symbol: string;
  timeframe: string;
  purpose: string;
  long_score: number;
  short_score: number;
  signal_direction: "long" | "short" | null;
  outcome: "win" | "loss" | "break_even" | null;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
};

function toDbSignal(row: SignalResultRow): DbSignalResult {
  return {
    id: row.id,
    analysisLogId: row.analysis_log_id,
    userId: row.user_id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    purpose: row.purpose,
    longScore: row.long_score,
    shortScore: row.short_score,
    signalDirection: row.signal_direction,
    outcome: row.outcome,
    note: row.note,
    createdAt: new Date(row.created_at).getTime(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : null,
  };
}

export async function createSignalResult(
  userId: number,
  data: {
    analysisLogId?: number;
    symbol: string;
    timeframe: string;
    purpose: string;
    longScore: number;
    shortScore: number;
    signalDirection?: "long" | "short";
  }
): Promise<DbSignalResult> {
  const { data: row, error } = await supabase
    .from("signal_results")
    .insert({
      user_id: userId,
      analysis_log_id: data.analysisLogId ?? null,
      symbol: data.symbol,
      timeframe: data.timeframe,
      purpose: data.purpose,
      long_score: data.longScore,
      short_score: data.shortScore,
      signal_direction: data.signalDirection ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toDbSignal(row as SignalResultRow);
}

export async function resolveSignalResult(
  signalId: number,
  userId: number,
  outcome: "win" | "loss" | "break_even",
  signalDirection: "long" | "short",
  note?: string
): Promise<DbSignalResult | null> {
  const { data, error } = await supabase
    .from("signal_results")
    .update({
      outcome,
      signal_direction: signalDirection,
      note: note ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", signalId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return null;
  return toDbSignal(data as SignalResultRow);
}

export async function getUserSignalResults(
  userId: number,
  limit = 50
): Promise<DbSignalResult[]> {
  const { data, error } = await supabase
    .from("signal_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as SignalResultRow[]).map(toDbSignal);
}

export interface SignalStats {
  total: number;
  resolved: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number; // 0-100 %
  bySymbol: { symbol: string; total: number; wins: number; winRate: number }[];
}

export async function getUserSignalStats(userId: number): Promise<SignalStats> {
  const { data, error } = await supabase
    .from("signal_results")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SignalResultRow[];

  const total = rows.length;
  const resolved = rows.filter((r) => r.outcome !== null).length;
  const wins = rows.filter((r) => r.outcome === "win").length;
  const losses = rows.filter((r) => r.outcome === "loss").length;
  const breakEvens = rows.filter((r) => r.outcome === "break_even").length;
  const winRate = resolved > 0 ? Math.round((wins / resolved) * 100) : 0;

  // 종목별 집계
  const symbolMap = new Map<string, { total: number; wins: number }>();
  for (const r of rows) {
    if (!r.outcome) continue;
    const s = symbolMap.get(r.symbol) ?? { total: 0, wins: 0 };
    s.total++;
    if (r.outcome === "win") s.wins++;
    symbolMap.set(r.symbol, s);
  }
  const bySymbol = Array.from(symbolMap.entries())
    .map(([symbol, s]) => ({
      symbol,
      total: s.total,
      wins: s.wins,
      winRate: Math.round((s.wins / s.total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { total, resolved, wins, losses, breakEvens, winRate, bySymbol };
}

// ── 결제 ───────────────────────────────────────────────────────

export async function createPaymentOrder(
  userId: number,
  stripeSessionId: string,
  creditsToAdd: number,
  amountKrw: number
): Promise<void> {
  const { error } = await supabase.from("payment_orders").insert({
    user_id: userId,
    stripe_session_id: stripeSessionId,
    credits_to_add: creditsToAdd,
    amount_krw: amountKrw,
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

export async function fulfillPaymentOrder(stripeSessionId: string): Promise<boolean> {
  // 이미 paid 처리됐으면 중복 실행 방지
  const { data: existing } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (!existing || existing.status === "paid") return false;

  const { error: updateError } = await supabase
    .from("payment_orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_session_id", stripeSessionId);

  if (updateError) throw new Error(updateError.message);

  // 크레딧 지급
  const { error: creditError } = await supabase.rpc("increment_credits", {
    p_user_id: existing.user_id,
    p_amount: existing.credits_to_add,
  });
  if (creditError) throw new Error(creditError.message);

  // 트랜잭션 기록
  await supabase.from("credit_transactions").insert({
    user_id: existing.user_id,
    amount: existing.credits_to_add,
    reason: `stripe_payment:${stripeSessionId}`,
    admin_id: null,
  });

  return true;
}

export async function getAdminStats(): Promise<AdminStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [usersRes, logsRes, creditsRes, todayRes] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("analysis_logs").select("id", { count: "exact", head: true }),
    supabase.from("credit_transactions").select("amount").lt("amount", 0),
    supabase
      .from("analysis_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
  ]);

  if (usersRes.error) throw new Error(usersRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);
  if (creditsRes.error) throw new Error(creditsRes.error.message);
  if (todayRes.error) throw new Error(todayRes.error.message);

  const totalCreditsUsed = ((creditsRes.data ?? []) as { amount: number }[]).reduce(
    (total, item) => total + Math.abs(item.amount),
    0
  );

  return {
    totalUsers: usersRes.count ?? 0,
    totalAnalyses: logsRes.count ?? 0,
    totalCreditsUsed,
    todayAnalyses: todayRes.count ?? 0,
  };
}
