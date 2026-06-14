-- =========================================
-- SCHEMA BOLÃO COPA 2026
-- Apenas estrutura de tabelas (sem dados)
-- =========================================

-- TABELAS

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  avatar_url text,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country_code text NOT NULL,
  group_id text,
  is_top15 boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number integer NOT NULL,
  round_label text NOT NULL,
  group_id text REFERENCES public.groups(id),
  home_team_id uuid REFERENCES public.teams(id),
  away_team_id uuid REFERENCES public.teams(id),
  home_score integer,
  away_score integer,
  is_finished boolean DEFAULT false,
  advancing_team_id uuid REFERENCES public.teams(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  advancing_team_id uuid REFERENCES public.teams(id),
  points_awarded integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, match_id)
);

CREATE TABLE IF NOT EXISTS public.special_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  champion_team_id uuid REFERENCES public.teams(id),
  underdog_team_id uuid REFERENCES public.teams(id),
  points_awarded integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  description text,
  points_value integer NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournament_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_phase text DEFAULT 'groups',
  group_picks_locked boolean DEFAULT false,
  knockout_picks_locked boolean DEFAULT false,
  special_picks_locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ÍNDICES

CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON public.predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_special_predictions_user_id ON public.special_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_group_id ON public.matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_round ON public.matches(round_label);
CREATE INDEX IF NOT EXISTS idx_matches_finished ON public.matches(is_finished);
CREATE INDEX IF NOT EXISTS idx_teams_group_id ON public.teams(group_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_active ON public.scoring_rules(active);

-- ROW LEVEL SECURITY

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: usuários veem apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can create profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Predictions: usuários veem e editam apenas seus palpites
CREATE POLICY "Users can view own predictions" ON public.predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert predictions" ON public.predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions" ON public.predictions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own predictions" ON public.predictions
  FOR DELETE USING (auth.uid() = user_id);

-- Special Predictions
CREATE POLICY "Users can view own special predictions" ON public.special_predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert special predictions" ON public.special_predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own special predictions" ON public.special_predictions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own special predictions" ON public.special_predictions
  FOR DELETE USING (auth.uid() = user_id);

-- Tournament Settings: leitura pública, escrita apenas admin
CREATE POLICY "Anyone can view tournament settings" ON public.tournament_settings
  FOR SELECT USING (true);

-- Teams, Groups, Matches: públicos para leitura (sem RLS necessário)
-- Scoring Rules: público para leitura (sem RLS necessário)

-- =========================================
-- FIM DO SCHEMA
-- =========================================
