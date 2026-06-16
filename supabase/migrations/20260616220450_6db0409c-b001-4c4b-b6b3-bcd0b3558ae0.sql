
CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(id uuid, display_name text, avatar_url text, total_pts bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    COALESCE(NULLIF(p.display_name, ''), 'Participante') AS display_name,
    p.avatar_url,
    COALESCE((SELECT SUM(points_awarded) FROM public.predictions WHERE user_id = p.id), 0)
    + COALESCE((SELECT SUM(points_awarded) FROM public.knockout_predictions WHERE user_id = p.id), 0)
    + COALESCE((SELECT SUM(points_awarded) FROM public.special_predictions WHERE user_id = p.id), 0)
    AS total_pts
  FROM public.profiles p
  ORDER BY total_pts DESC, display_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking() TO anon, authenticated, service_role;
