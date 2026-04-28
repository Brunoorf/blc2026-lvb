
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.match_phase AS ENUM ('group', 'r32', 'r16', 'qf', 'sf', 'final');
CREATE TYPE public.tournament_phase AS ENUM ('groups', 'knockout', 'finished');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================
-- USER ROLES + has_role function
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Roles viewable by authenticated"
  ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- AUTO-CREATE PROFILE + FIRST USER = ADMIN
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- GROUPS (A..L)
-- =========================================
CREATE TABLE public.groups (
  id TEXT PRIMARY KEY, -- 'A','B'...'L'
  name TEXT NOT NULL
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups viewable by authenticated"
  ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage groups"
  ON public.groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- TEAMS (48 seleções)
-- =========================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- FIFA 3-letter code
  name TEXT NOT NULL,
  flag TEXT NOT NULL, -- emoji ou URL
  group_id TEXT NOT NULL REFERENCES public.groups(id),
  fifa_rank INTEGER,
  is_top15 BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams viewable by authenticated"
  ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage teams"
  ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- MATCHES
-- =========================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase match_phase NOT NULL,
  round_label TEXT NOT NULL, -- 'Rodada 1', 'Oitavas Jogo 3' etc.
  match_number INTEGER NOT NULL UNIQUE,
  group_id TEXT REFERENCES public.groups(id),
  home_team_id UUID REFERENCES public.teams(id),
  away_team_id UUID REFERENCES public.teams(id),
  home_score INTEGER,
  away_score INTEGER,
  match_date TIMESTAMPTZ,
  is_finished BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches viewable by authenticated"
  ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage matches"
  ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- PREDICTIONS (placar de partidas)
-- =========================================
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own predictions"
  ON public.predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all predictions"
  ON public.predictions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own predictions"
  ON public.predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own predictions"
  ON public.predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own predictions"
  ON public.predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================
-- KNOCKOUT PREDICTIONS (quais seleções avançam por fase)
-- =========================================
CREATE TABLE public.knockout_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reached_phase match_phase NOT NULL, -- até onde o usuário acha que chega
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);
ALTER TABLE public.knockout_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own knockout"
  ON public.knockout_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all knockout"
  ON public.knockout_predictions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users manage own knockout"
  ON public.knockout_predictions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- SPECIAL PREDICTIONS (campeão, artilheiro, etc)
-- =========================================
CREATE TABLE public.special_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  champion_team_id UUID REFERENCES public.teams(id),
  top_scorer TEXT,
  best_goalkeeper TEXT,
  best_player TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.special_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own special"
  ON public.special_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all special"
  ON public.special_predictions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users manage own special"
  ON public.special_predictions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- OFFICIAL RESULTS (qual fase cada seleção alcançou na realidade)
-- =========================================
CREATE TABLE public.team_official_results (
  team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  reached_phase match_phase,
  group_position INTEGER -- 1,2,3,4 quando aplicável
);
ALTER TABLE public.team_official_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Official results viewable"
  ON public.team_official_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage official results"
  ON public.team_official_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- SCORING RULES (configurável)
-- =========================================
CREATE TABLE public.scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT
);
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rules viewable by authenticated"
  ON public.scoring_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rules"
  ON public.scoring_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.scoring_rules (rule_key, label, points, description) VALUES
  ('exact_score', 'Placar exato', 25, 'Acertou o placar exato da partida'),
  ('correct_result', 'Acerto de resultado (V/E/D)', 10, 'Acertou quem venceu ou empate, mas errou placar'),
  ('team_advances', 'Seleção que passou de fase', 15, 'Para cada seleção que avançou (independente da posição)'),
  ('group_order', 'Ordem correta do grupo', 10, 'Bônus por acertar a ordem 1º/2º/3º/4º'),
  ('advance_r16', 'Avançar para Oitavas', 20, 'Acerto de quem chegou às oitavas'),
  ('advance_qf', 'Avançar para Quartas', 30, 'Acerto de quem chegou às quartas'),
  ('advance_sf', 'Avançar para Semis', 40, 'Acerto de quem chegou às semis'),
  ('advance_final', 'Avançar para Final', 60, 'Acerto de quem chegou à final'),
  ('champion', 'Acerto do campeão', 100, 'Acertou o campeão da Copa'),
  ('top_scorer', 'Artilheiro', 50, 'Acertou o artilheiro do torneio'),
  ('best_goalkeeper', 'Melhor goleiro', 50, 'Acertou o melhor goleiro'),
  ('best_player', 'Melhor jogador', 50, 'Acertou o melhor jogador'),
  ('underdog_bonus', 'Bônus Zebra', 50, 'Seleção fora do Top 15 FIFA que chegou nas quartas');

-- =========================================
-- TOURNAMENT SETTINGS
-- =========================================
CREATE TABLE public.tournament_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_phase tournament_phase NOT NULL DEFAULT 'groups',
  group_picks_locked BOOLEAN NOT NULL DEFAULT false,
  knockout_picks_locked BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by authenticated"
  ON public.tournament_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings"
  ON public.tournament_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.tournament_settings (id) VALUES (1);

-- =========================================
-- SEED: 12 GROUPS A..L
-- =========================================
INSERT INTO public.groups (id, name) VALUES
  ('A','Grupo A'),('B','Grupo B'),('C','Grupo C'),('D','Grupo D'),
  ('E','Grupo E'),('F','Grupo F'),('G','Grupo G'),('H','Grupo H'),
  ('I','Grupo I'),('J','Grupo J'),('K','Grupo K'),('L','Grupo L');

-- =========================================
-- SEED: 48 TEAMS (Copa 2026 - distribuição em 12 grupos de 4)
-- Sedes confirmadas (CAN, MEX, USA) + 45 demais qualificadas/projetadas
-- =========================================
INSERT INTO public.teams (code, name, flag, group_id, fifa_rank, is_top15) VALUES
  -- Grupo A
  ('CAN','Canadá','🇨🇦','A',28,false),
  ('ECU','Equador','🇪🇨','A',23,false),
  ('TUN','Tunísia','🇹🇳','A',45,false),
  ('UZB','Uzbequistão','🇺🇿','A',57,false),
  -- Grupo B
  ('MEX','México','🇲🇽','B',17,false),
  ('CRO','Croácia','🇭🇷','B',10,true),
  ('NOR','Noruega','🇳🇴','B',30,false),
  ('JOR','Jordânia','🇯🇴','B',64,false),
  -- Grupo C
  ('USA','Estados Unidos','🇺🇸','C',16,false),
  ('JPN','Japão','🇯🇵','C',18,false),
  ('SCO','Escócia','🇴🇴','C',39,false),
  ('CRC','Costa Rica','🇨🇷','C',54,false),
  -- Grupo D
  ('BRA','Brasil','🇧🇷','D',5,true),
  ('SEN','Senegal','🇸🇳','D',19,false),
  ('PAR','Paraguai','🇵🇾','D',38,false),
  ('NZL','Nova Zelândia','🇳🇿','D',86,false),
  -- Grupo E
  ('ARG','Argentina','🇦🇷','E',1,true),
  ('SUI','Suíça','🇨🇭','E',20,false),
  ('AUS','Austrália','🇦🇺','E',26,false),
  ('SAU','Arábia Saudita','🇸🇦','E',58,false),
  -- Grupo F
  ('FRA','França','🇫🇷','F',2,true),
  ('MAR','Marrocos','🇲🇦','F',14,true),
  ('IRN','Irã','🇮🇷','F',22,false),
  ('CIV','Costa do Marfim','🇨🇮','F',41,false),
  -- Grupo G
  ('ESP','Espanha','🇪🇸','G',3,true),
  ('COL','Colômbia','🇨🇴','G',13,true),
  ('EGY','Egito','🇪🇬','G',32,false),
  ('PAN','Panamá','🇵🇦','G',33,false),
  -- Grupo H
  ('ENG','Inglaterra','🏴󠁧󠁢󠁥󠁮󠁧󠁿','H',4,true),
  ('URU','Uruguai','🇺🇾','H',15,true),
  ('KOR','Coreia do Sul','🇰🇷','H',24,false),
  ('CPV','Cabo Verde','🇨🇻','H',70,false),
  -- Grupo I
  ('POR','Portugal','🇵🇹','I',7,true),
  ('BEL','Bélgica','🇧🇪','I',8,true),
  ('NGA','Nigéria','🇳🇬','I',43,false),
  ('HAI','Haiti','🇭🇹','I',83,false),
  -- Grupo J
  ('GER','Alemanha','🇩🇪','J',9,true),
  ('NED','Holanda','🇳🇱','J',6,true),
  ('GHA','Gana','🇬🇭','J',73,false),
  ('JAM','Jamaica','🇯🇲','J',60,false),
  -- Grupo K
  ('ITA','Itália','🇮🇹','K',12,true),
  ('AUT','Áustria','🇦🇹','K',21,false),
  ('ALG','Argélia','🇩🇿','K',36,false),
  ('CUW','Curaçao','🇨🇼','K',88,false),
  -- Grupo L
  ('DEN','Dinamarca','🇩🇰','L',25,false),
  ('TUR','Turquia','🇹🇷','L',27,false),
  ('RSA','África do Sul','🇿🇦','L',56,false),
  ('QAT','Catar','🇶🇦','L',55,false);

-- =========================================
-- SEED: MATCHES da fase de grupos (6 jogos por grupo = 72 jogos)
-- Cruzamentos: 1v2, 3v4, 1v3, 2v4, 1v4, 2v3 (ordem alfabética dentro do grupo)
-- =========================================
DO $$
DECLARE
  g RECORD;
  t1 UUID; t2 UUID; t3 UUID; t4 UUID;
  mn INTEGER := 1;
BEGIN
  FOR g IN SELECT id FROM public.groups ORDER BY id LOOP
    SELECT id INTO t1 FROM public.teams WHERE group_id = g.id ORDER BY name LIMIT 1 OFFSET 0;
    SELECT id INTO t2 FROM public.teams WHERE group_id = g.id ORDER BY name LIMIT 1 OFFSET 1;
    SELECT id INTO t3 FROM public.teams WHERE group_id = g.id ORDER BY name LIMIT 1 OFFSET 2;
    SELECT id INTO t4 FROM public.teams WHERE group_id = g.id ORDER BY name LIMIT 1 OFFSET 3;

    INSERT INTO public.matches (phase, round_label, match_number, group_id, home_team_id, away_team_id) VALUES
      ('group','Rodada 1', mn,     g.id, t1, t2),
      ('group','Rodada 1', mn + 1, g.id, t3, t4),
      ('group','Rodada 2', mn + 2, g.id, t1, t3),
      ('group','Rodada 2', mn + 3, g.id, t2, t4),
      ('group','Rodada 3', mn + 4, g.id, t1, t4),
      ('group','Rodada 3', mn + 5, g.id, t2, t3);
    mn := mn + 6;
  END LOOP;
END $$;
