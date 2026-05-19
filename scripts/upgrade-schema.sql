-- ============================================================
-- SQL Script: Melhorias do Bolão Copa 2026
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar campo is_champion em team_official_results
-- Resolve o hack de usar group_position=1 para identificar campeão
ALTER TABLE public.team_official_results
ADD COLUMN IF NOT EXISTS is_champion boolean DEFAULT false;

-- 2. Adicionar campos oficiais de premiação individual em tournament_settings
-- Permite ao admin definir artilheiro, goleiro e jogador oficial
ALTER TABLE public.tournament_settings
ADD COLUMN IF NOT EXISTS official_top_scorer text DEFAULT NULL;

ALTER TABLE public.tournament_settings
ADD COLUMN IF NOT EXISTS official_best_goalkeeper text DEFAULT NULL;

ALTER TABLE public.tournament_settings
ADD COLUMN IF NOT EXISTS official_best_player text DEFAULT NULL;

-- 3. Garantir que só um time pode ser campeão
-- (constraint funcional via trigger ou lógica de app, não via unique constraint pois boolean nulls)

-- 4. Verificar que o schema está atualizado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'team_official_results'
ORDER BY ordinal_position;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tournament_settings'
ORDER BY ordinal_position;
