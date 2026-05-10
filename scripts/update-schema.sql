-- ============================================================
-- SQL Script: Adicionar campos de Quem Avança e Zebra
-- Execute este script no Supabase SQL Editor do seu projeto
-- ============================================================

-- 1. Tabela matches: Adicionar advancing_team_id
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS advancing_team_id uuid REFERENCES public.teams(id);

-- 2. Tabela predictions: Adicionar advancing_team_id
ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS advancing_team_id uuid REFERENCES public.teams(id);

-- 3. Tabela special_predictions: Adicionar underdog_team_id
ALTER TABLE public.special_predictions
ADD COLUMN IF NOT EXISTS underdog_team_id uuid REFERENCES public.teams(id);

-- Opcional: Atualizar a visualização (view) das predictions caso você tenha alguma que dependa de colunas exatas
-- Não é necessário para este projeto, a alteração estrutural acima já é suficiente.
