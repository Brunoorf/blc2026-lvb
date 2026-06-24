-- =========================================================
-- BACKUP ANTES DAS MUDANÇAS SQL
-- Data: $(date)
-- =========================================================
-- PRESERVE TODAS AS PREDICTIONS (pontos atuais)
-- PRESERVE TODAS AS POLICIES E FUNCTIONS ANTIGAS
-- =========================================================

-- Dump predictions
-- SELECT * FROM predictions;

-- Dump knockout_predictions
-- SELECT * FROM knockout_predictions;

-- Dump special_predictions
-- SELECT * FROM special_predictions;

-- Dump matches (com is_finished, scores, advancing_team)
-- SELECT * FROM matches;

-- Dump scoring_rules (valores de pontuação)
-- SELECT * FROM scoring_rules;

-- Dump tournament_settings
-- SELECT * FROM tournament_settings;

-- Dump team_official_results
-- SELECT * FROM team_official_results;

-- Dump profiles (usuários)
-- SELECT id, display_name, avatar_url FROM profiles;

-- =========================================================
-- REVERT PLAN (se algo der errado):
-- 
-- 1. Dropa as novas policies:
--    DROP POLICY "Authenticated see all predictions" ON public.predictions;
--    DROP POLICY "Authenticated see all knockout" ON public.knockout_predictions;
--    DROP POLICY "Authenticated see all special" ON public.special_predictions;
--
-- 2. Recoloca as antigas:
--    CREATE POLICY "Users see own predictions" ...
--    CREATE POLICY "Users see own knockout" ...
--    CREATE POLICY "Users see own special" ...
--
-- 3. Dropa os triggers e functions novas:
--    DROP TRIGGER trg_auto_score_on_finish ON public.matches;
--    DROP FUNCTION public.auto_score_on_finish();
--    DROP FUNCTION public.score_all_predictions();
--
-- =========================================================
