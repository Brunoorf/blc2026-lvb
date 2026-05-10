-- ============================================================
-- FIX: Definir admin manualmente + corrigir trigger
-- Execute este script no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/uhdcdyfpowspufttkofl/sql/new
-- ============================================================

-- 1) Garantir que as permissões da função has_role estão corretas
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 2) Limpar todas as roles existentes e recriar
DELETE FROM public.user_roles;

-- 3) Definir brunof.fatec@gmail.com como admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'brunof.fatec@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Dar role 'user' a todos os demais
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role
FROM auth.users
WHERE email != 'brunof.fatec@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 5) Corrigir trigger para novos usuários (todos entram como 'user')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Criar perfil automaticamente
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Todos os novos usuários entram como 'user'
  -- Admin é promovido manualmente pelo painel
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 6) Verificar resultado
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY u.email;
