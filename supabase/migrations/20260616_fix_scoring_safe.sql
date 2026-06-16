-- Safe scoring function that updates all predictions with correct points
-- This replaces the buggy recompute.ts function
-- Usage: SELECT update_prediction_points();

CREATE OR REPLACE FUNCTION public.update_prediction_points()
RETURNS TABLE(updated_count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH points_calc AS (
  SELECT
    p.id,
    CASE
      WHEN p.home_score = m.home_score AND p.away_score = m.away_score THEN 25
      WHEN (p.home_score > p.away_score AND m.home_score > m.away_score) OR
           (p.home_score < p.away_score AND m.home_score < m.away_score) OR
           (p.home_score = p.away_score AND m.home_score = m.away_score) THEN 10
      ELSE 0
    END AS calculated_points
  FROM predictions p
  JOIN matches m ON p.match_id = m.id
  WHERE m.is_finished = true
)
UPDATE predictions SET points_awarded = points_calc.calculated_points
FROM points_calc
WHERE predictions.id = points_calc.id
RETURNING (SELECT COUNT(*) FROM points_calc);
$$;

-- Test the function
-- SELECT update_prediction_points();
