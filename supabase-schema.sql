-- ============================================================
-- Chart Vision AI - Supabase SQL Schema
-- Supabase Dashboard > SQL Editor 에서 전체 실행
-- ============================================================

-- 1. users 테이블
CREATE TABLE IF NOT EXISTS public.users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  credits       INTEGER NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. analysis_logs 테이블
CREATE TABLE IF NOT EXISTS public.analysis_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  timeframe    TEXT NOT NULL,
  purpose      TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  mode         TEXT NOT NULL DEFAULT 'ai',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. credit_transactions 테이블
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  admin_id   BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email            ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_user_id ON public.analysis_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created ON public.analysis_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id     ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created     ON public.credit_transactions(created_at DESC);

-- 5. RLS 비활성화 (service_role key로만 서버에서 접근)
ALTER TABLE public.users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_logs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions DISABLE ROW LEVEL SECURITY;

-- 6. credits 원자적 증가 함수 (관리자 충전)
CREATE OR REPLACE FUNCTION public.increment_credits(p_user_id BIGINT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  UPDATE public.users
  SET credits = credits + p_amount
  WHERE id = p_user_id
  RETURNING credits INTO new_credits;
  RETURN new_credits;
END;
$$;

-- 7. credits 원자적 차감 함수 (분석 시 1회 차감, 0 미만 차단)
CREATE OR REPLACE FUNCTION public.decrement_credit_safe(p_user_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT credits INTO current_credits
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET credits = credits - 1
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 완료. 관리자 계정은 서버 시작 시 ADMIN_EMAIL/ADMIN_PASSWORD
-- 환경변수로 자동 생성됩니다.
-- ============================================================
