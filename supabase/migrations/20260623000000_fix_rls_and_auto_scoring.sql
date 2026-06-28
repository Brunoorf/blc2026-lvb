-- =========================================================
-- Fix 1: Community view — allow all authenticated users to
-- SELECT predictions so the Comunidade page works for everyone.
-- Previously restricted to own rows, so users saw no one else.
-- Gating is handled at app level via community_predictions_visible.
-- =========================================================
DROP POLICY IF EXISTS "Users see own predictions" ON public.predictions;
CREATE POLICY "Authenticated see all predictions"
  ON public.predictions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users see own knockout" ON public.knockout_predictions;
CREATE POLICY "Authenticated see all knockout"
  ON public.knockout_predictions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users see own special" ON public.special_predictions;
CREATE POLICY "Authenticated see all special"
  ON public.special_predictions FOR SELECT TO authenticated USING (true);

-- =========================================================
-- Fix 2: SECURITY DEFINER scoring function — runs as postgres,
-- bypasses RLS, and only ever touches points_awarded.
-- The user's actual prediction (home_score, away_score) is
-- never modified. Called via supabase.rpc('score_all_predictions').
-- =========================================================
DROP FUNCTION IF EXISTS public.score_all_predictions();
CREATE OR REPLACE FUNCTION public.score_all_predictions()
RETURNS TABLE(updated_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exact_pts  INTEGER;
  result_pts INTEGER;
BEGIN
  SELECT points INTO exact_pts  FROM scoring_rules WHERE rule_key = 'exact_score'    LIMIT 1;
  SELECT points INTO result_pts FROM scoring_rules WHERE rule_key = 'correct_result' LIMIT 1;

  UPDATE predictions p
  SET points_awarded =
    CASE
      WHEN p.home_score = m.home_score AND p.away_score = m.away_score
        THEN exact_pts
      WHEN (p.home_score > p.away_score AND m.home_score > m.away_score)
        OR (p.home_score < p.away_score AND m.home_score < m.away_score)
        OR (p.home_score = p.away_score AND m.home_score = m.away_score)
        THEN result_pts
      ELSE 0
    END
  FROM matches m
  WHERE p.match_id = m.id
    AND m.is_finished = true
    AND m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL;

  RETURN QUERY SELECT COUNT(*)::BIGINT FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE m.is_finished = true;
END;
$$;

-- =========================================================
-- Fix 3: Auto-score trigger — fires server-side when admin
-- marks a match as finished. Calls the SECURITY DEFINER
-- function so RLS is never an issue. Also resets points to 0
-- if admin un-finishes a match to correct a mistake.
-- =========================================================
CREATE OR REPLACE FUNCTION public.auto_score_on_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exact_pts  INTEGER;
  result_pts INTEGER;
BEGIN
  SELECT points INTO exact_pts  FROM scoring_rules WHERE rule_key = 'exact_score'    LIMIT 1;
  SELECT points INTO result_pts FROM scoring_rules WHERE rule_key = 'correct_result' LIMIT 1;

  IF NEW.is_finished = true
     AND NEW.home_score IS NOT NULL
     AND NEW.away_score IS NOT NULL
  THEN
    UPDATE predictions
    SET points_awarded =
      CASE
        WHEN home_score = NEW.home_score AND away_score = NEW.away_score
          THEN exact_pts
        WHEN (home_score > away_score AND NEW.home_score > NEW.away_score)
          OR (home_score < away_score AND NEW.home_score < NEW.away_score)
          OR (home_score = away_score AND NEW.home_score = NEW.away_score)
          THEN result_pts
        ELSE 0
      END
    WHERE match_id = NEW.id;
  END IF;

  -- Admin corrected a mistake: un-finish resets points for this match
  IF NEW.is_finished = false AND OLD.is_finished = true THEN
    UPDATE predictions SET points_awarded = 0 WHERE match_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_score_on_finish ON public.matches;
CREATE TRIGGER trg_auto_score_on_finish
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_score_on_finish();
