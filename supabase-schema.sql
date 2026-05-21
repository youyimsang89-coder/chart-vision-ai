-- ============================================================
-- Chart Vision AI - Supabase SQL Schema
-- Supabase Dashboard > SQL Editor에서 전체 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  credits       INTEGER NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  admin_id   BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_user_id ON public.analysis_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created ON public.analysis_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens DISABLE ROW LEVEL SECURITY;

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
