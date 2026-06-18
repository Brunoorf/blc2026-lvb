
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS advancing_team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS advancing_team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.special_predictions ADD COLUMN IF NOT EXISTS underdog_team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.tournament_settings ADD COLUMN IF NOT EXISTS special_picks_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.tournament_settings ADD COLUMN IF NOT EXISTS community_predictions_visible boolean NOT NULL DEFAULT false;
