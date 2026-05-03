
-- 1) Fix permission denied for has_role
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;

-- 2) Rename 6 existing teams into playoff-winner placeholders
UPDATE public.teams SET name='Vencedor Repescagem Europa A', code='POA', flag='🇪🇺', is_top15=false WHERE code='CRC';
UPDATE public.teams SET name='Vencedor Repescagem Europa B', code='POB', flag='🇪🇺', is_top15=false WHERE code='NGA';
UPDATE public.teams SET name='Vencedor Repescagem Europa C', code='POC', flag='🇪🇺', is_top15=false WHERE code='ITA';
UPDATE public.teams SET name='Vencedor Repescagem Europa D', code='POD', flag='🇪🇺', is_top15=false WHERE code='JAM';
UPDATE public.teams SET name='Vencedor Repescagem FIFA 1',  code='FP1', flag='🌍', is_top15=false WHERE code='DEN';
UPDATE public.teams SET name='Vencedor Repescagem FIFA 2',  code='FP2', flag='🌍', is_top15=false WHERE code='TUR';

-- 3) Reassign every team to the official 2026 group
-- Group A: Mexico, África do Sul, Coreia do Sul, Repescagem Europa D
UPDATE public.teams SET group_id='A' WHERE code IN ('MEX','RSA','KOR','POD');
-- Group B: Canada, Repescagem Europa A, Qatar, Suíça
UPDATE public.teams SET group_id='B' WHERE code IN ('CAN','POA','QAT','SUI');
-- Group C: Brasil, Marrocos, Haiti, Escócia
UPDATE public.teams SET group_id='C' WHERE code IN ('BRA','MAR','HAI','SCO');
-- Group D: USA, Paraguai, Austrália, Repescagem Europa C
UPDATE public.teams SET group_id='D' WHERE code IN ('USA','PAR','AUS','POC');
-- Group E: Alemanha, Curaçao, Costa do Marfim, Equador
UPDATE public.teams SET group_id='E' WHERE code IN ('GER','CUW','CIV','ECU');
-- Group F: Holanda, Japão, Repescagem Europa B, Tunísia
UPDATE public.teams SET group_id='F' WHERE code IN ('NED','JPN','POB','TUN');
-- Group G: Bélgica, Egito, Irã, Nova Zelândia
UPDATE public.teams SET group_id='G' WHERE code IN ('BEL','EGY','IRN','NZL');
-- Group H: Espanha, Cabo Verde, Arábia Saudita, Uruguai
UPDATE public.teams SET group_id='H' WHERE code IN ('ESP','CPV','SAU','URU');
-- Group I: França, Senegal, Repescagem FIFA 2, Noruega
UPDATE public.teams SET group_id='I' WHERE code IN ('FRA','SEN','FP2','NOR');
-- Group J: Argentina, Argélia, Áustria, Jordânia
UPDATE public.teams SET group_id='J' WHERE code IN ('ARG','ALG','AUT','JOR');
-- Group K: Portugal, Repescagem FIFA 1, Uzbequistão, Colômbia
UPDATE public.teams SET group_id='K' WHERE code IN ('POR','FP1','UZB','COL');
-- Group L: Inglaterra, Croácia, Gana, Panamá
UPDATE public.teams SET group_id='L' WHERE code IN ('ENG','CRO','GHA','PAN');

-- 4) Regenerate group-stage matches based on new groupings
DELETE FROM public.matches WHERE phase = 'group';

DO $$
DECLARE
  g RECORD;
  ids uuid[];
  match_no INT := 1;
BEGIN
  FOR g IN SELECT id FROM public.groups ORDER BY id LOOP
    SELECT array_agg(id ORDER BY name) INTO ids FROM public.teams WHERE group_id = g.id;
    -- Round 1
    INSERT INTO public.matches (group_id, phase, round_label, match_number, home_team_id, away_team_id)
      VALUES (g.id, 'group', 'Rodada 1', match_no, ids[1], ids[2]);  match_no := match_no + 1;
    INSERT INTO public.matches (group_id, phase, round_label, match_number, home_team_id, away_team_id)
      VALUES (g.id, 'group', 'Rodada 1', match_no, ids[3], ids[4]);  match_no := match_no + 1;
    -- Round 2
    INSERT INTO public.matches (group_id, phase, round_label, match_number, home_team_id, away_team_id)
      VALUES (g.id, 'group', 'Rodada 2', match_no, ids[1], ids[3]);  match_no := match_no + 1;
    INSERT INTO public.matches (group_id, phase, round_label, match_number, home_team_id, away_team_id)
      VALUES (g.id, 'group', 'Rodada 2', match_no, ids[4], ids[2]);  match_no := match_no + 1;
    -- Round 3
    INSERT INTO public.matches (group_id, phase, round_label, match_number, home_team_id, away_team_id)
      VALUES (g.id, 'group', 'Rodada 3', match_no, ids[1], ids[4]);  match_no := match_no + 1;
    INSERT INTO public.matches (group_id, phase, round_label, match_number, home_team_id, away_team_id)
      VALUES (g.id, 'group', 'Rodada 3', match_no, ids[2], ids[3]);  match_no := match_no + 1;
  END LOOP;
END $$;
