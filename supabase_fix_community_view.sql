-- =========================================================
-- FIX: COMMUNITY PREDICTIONS VIEW
-- Date: 2026-06-22
--
-- PROBLEMA: knockout_predictions e special_predictions
-- só permitem usuarios verem suas PRÓPRIAS predictions.
-- Isso faz a aba Comunidade ficar vazia.
--
-- SOLUÇÃO: Adicionar 2 policies de SELECT que permitem
-- authenticated users lerem TODAS as predictions.
--
-- SEGURO: Não dropa nada. Só adiciona leitura.
-- UPDATE/INSERT/DELETE continuam restritivos.
-- =========================================================

-- ==========================================
-- ADD: Read permission for knockout_predictions
-- ==========================================
CREATE POLICY "Authenticated read all knockout"
  ON public.knockout_predictions
  FOR SELECT
  TO authenticated
  USING (true);

-- ==========================================
-- ADD: Read permission for special_predictions
-- ==========================================
CREATE POLICY "Authenticated read all special"
  ON public.special_predictions
  FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- VERIFY: Teste esses queries no SQL Editor
-- (Devem retornar todas as predictions, não só suas)
-- =========================================================
-- SELECT * FROM knockout_predictions LIMIT 5;
-- SELECT * FROM special_predictions LIMIT 5;

-- =========================================================
-- ROLLBACK (se algo der errado, rode isso):
-- =========================================================
-- DROP POLICY IF EXISTS "Authenticated read all knockout" ON public.knockout_predictions;
-- DROP POLICY IF EXISTS "Authenticated read all special" ON public.special_predictions;
