/**
 * lib/db.ts
 * 파일 기반 JSON 데이터베이스 (better-sqlite3 대체)
 * 네이티브 컴파일 불필요 · 서버사이드 전용
 */

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// ─── 경로 설정 ──────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function dbPath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

// ─── 제네릭 JSON 파일 읽기/쓰기 ─────────────────────────────

function readJson<T>(name: string, def: T): T {
  ensureDir();
  const p = dbPath(name);
  if (!fs.existsSync(p)) return def;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return def;
  }
}

function writeJson<T>(name: string, data: T): void {
  ensureDir();
  fs.writeFileSync(dbPath(name), JSON.stringify(data, null, 2), "utf-8");
}

// ─── 타입 정의 ──────────────────────────────────────────────

export interface DbUser {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "admin";
  credits: number;
  createdAt: number; // unix timestamp (ms)
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
  amount: number;       // 양수=충전, 음수=차감
  reason: string;
  adminId: number | null;
  createdAt: number;
}

// ─── 내부 스토어 ─────────────────────────────────────────────

interface Store {
  users: DbUser[];
  analysisLogs: DbAnalysisLog[];
  creditTransactions: DbCreditTransaction[];
  sequences: { users: number; analysisLogs: number; creditTransactions: number };
}

let _store: Store | null = null;

function getStore(): Store {
  if (!_store) {
    _store = {
      users: readJson<DbUser[]>("users", []),
      analysisLogs: readJson<DbAnalysisLog[]>("analysis_logs", []),
      creditTransactions: readJson<DbCreditTransaction[]>("credit_transactions", []),
      sequences: readJson("sequences", { users: 0, analysisLogs: 0, creditTransactions: 0 }),
    };
    seedAdminIfNeeded();
  }
  return _store;
}

function save(key: keyof Omit<Store, "sequences">): void {
  const s = getStore();
  writeJson(key === "users" ? "users" : key === "analysisLogs" ? "analysis_logs" : "credit_transactions", s[key]);
}

function saveSeqs(): void {
  writeJson("sequences", getStore().sequences);
}

function nextId(seq: keyof Store["sequences"]): number {
  const s = getStore();
  s.sequences[seq] += 1;
  saveSeqs();
  return s.sequences[seq];
}

// ─── 관리자 시드 ──────────────────────────────────────────────

function seedAdminIfNeeded(): void {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminEmail || !adminPassword) return;

  const s = _store!;
  const exists = s.users.find((u) => u.email === adminEmail);
  if (exists) return;

  const id = (s.sequences.users += 1);
  saveSeqs();
  const admin: DbUser = {
    id,
    email: adminEmail,
    name: "관리자",
    passwordHash: bcrypt.hashSync(adminPassword, 10),
    role: "admin",
    credits: 999999,
    createdAt: Date.now(),
  };
  s.users.push(admin);
  writeJson("users", s.users);
}

// ─── User API ────────────────────────────────────────────────

export function getUserByEmail(email: string): DbUser | undefined {
  return getStore().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getUserById(id: number): DbUser | undefined {
  return getStore().users.find((u) => u.id === id);
}

export function createUser(email: string, name: string, passwordHash: string): DbUser {
  const s = getStore();
  if (s.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("이미 사용 중인 이메일입니다.");
  }

  const initialCredits = parseInt(process.env.INITIAL_CREDITS ?? "10", 10);
  const id = nextId("users");
  const user: DbUser = {
    id,
    email,
    name,
    passwordHash,
    role: "user",
    credits: initialCredits,
    createdAt: Date.now(),
  };
  s.users.push(user);
  save("users");

  if (initialCredits > 0) {
    addCreditTransaction(id, initialCredits, "가입 보너스", null);
  }
  return user;
}

export function getAllUsers(): DbUser[] {
  return [...getStore().users].sort((a, b) => b.createdAt - a.createdAt);
}

export function getUserCredits(userId: number): number {
  return getUserById(userId)?.credits ?? 0;
}

// ─── Credits API ─────────────────────────────────────────────

function addCreditTransaction(
  userId: number,
  amount: number,
  reason: string,
  adminId: number | null
): void {
  const s = getStore();
  const id = nextId("creditTransactions");
  s.creditTransactions.push({ id, userId, amount, reason, adminId, createdAt: Date.now() });
  save("creditTransactions");
}

export function addCredits(
  userId: number,
  amount: number,
  reason: string,
  adminId?: number
): { success: boolean; newCredits: number } {
  const s = getStore();
  const user = s.users.find((u) => u.id === userId);
  if (!user) return { success: false, newCredits: 0 };

  user.credits += amount;
  save("users");
  addCreditTransaction(userId, amount, reason, adminId ?? null);
  return { success: true, newCredits: user.credits };
}

export function deductCredit(userId: number): boolean {
  const s = getStore();
  const user = s.users.find((u) => u.id === userId);
  if (!user || user.credits <= 0) return false;

  user.credits -= 1;
  save("users");
  addCreditTransaction(userId, -1, "차트 분석", null);
  return true;
}

export function getCreditTransactions(userId: number): DbCreditTransaction[] {
  return getStore()
    .creditTransactions.filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}

// ─── Analysis Log API ─────────────────────────────────────────

export function logAnalysis(
  userId: number,
  symbol: string,
  timeframe: string,
  purpose: string,
  mode: string
): void {
  const s = getStore();
  const id = nextId("analysisLogs");
  s.analysisLogs.push({
    id,
    userId,
    symbol,
    timeframe,
    purpose,
    creditsUsed: 1,
    mode,
    createdAt: Date.now(),
  });
  save("analysisLogs");
}

export function getUserAnalysisLogs(userId: number, limit = 50): DbAnalysisLog[] {
  return getStore()
    .analysisLogs.filter((l) => l.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function getAllAnalysisLogs(
  limit = 200
): (DbAnalysisLog & { userEmail: string; userName: string })[] {
  const s = getStore();
  const userMap = new Map(s.users.map((u) => [u.id, u]));
  return s.analysisLogs
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((l) => ({
      ...l,
      userEmail: userMap.get(l.userId)?.email ?? "unknown",
      userName: userMap.get(l.userId)?.name ?? "unknown",
    }));
}

// ─── Admin Stats API ──────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalAnalyses: number;
  totalCreditsUsed: number;
  todayAnalyses: number;
}

export function getAdminStats(): AdminStats {
  const s = getStore();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime();

  return {
    totalUsers: s.users.filter((u) => u.role === "user").length,
    totalAnalyses: s.analysisLogs.length,
    totalCreditsUsed: s.creditTransactions
      .filter((t) => t.amount < 0)
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
    todayAnalyses: s.analysisLogs.filter((l) => l.createdAt >= todayTs).length,
  };
}
