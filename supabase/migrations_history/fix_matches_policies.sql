-- Migration: Fix matches RLS policies and add reset function
-- Run this in Supabase SQL Editor (Production)

-- ============================================
-- 1. FIX MATCHES POLICIES
-- ============================================

-- Drop old policies if they exist
DROP POLICY IF EXISTS "System can insert matches" ON matches;
DROP POLICY IF EXISTS "Admin can insert matches" ON matches;
DROP POLICY IF EXISTS "Admin can delete matches" ON matches;

-- Create correct policies
CREATE POLICY "Admin can insert matches" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = matches.group_id
      AND groups.admin_id = auth.uid()
    )
  );

CREATE POLICY "Admin can delete matches" ON matches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = matches.group_id
      AND groups.admin_id = auth.uid()
    )
  );

-- ============================================
-- 2. FIX MEMBERS RECURSION
-- ============================================

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view members of their groups" ON members;
DROP POLICY IF EXISTS "Users can view members in their groups" ON members;

-- Create security definer function to avoid recursion
CREATE OR REPLACE FUNCTION user_is_member_of_group(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

-- Create non-recursive policy
CREATE POLICY "Users can view members in their groups" ON members
  FOR SELECT USING (user_is_member_of_group(group_id));

-- ============================================
-- 3. CREATE RESET DRAW FUNCTION
-- ============================================

-- This function bypasses RLS to properly delete all matches
CREATE OR REPLACE FUNCTION reset_group_draw(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_status TEXT;
BEGIN
  -- Get group info
  SELECT admin_id, status INTO v_admin_id, v_status
  FROM groups WHERE id = p_group_id;

  -- Verify caller is admin
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  IF v_admin_id != auth.uid() THEN
    RAISE EXCEPTION 'Solo el administrador puede reiniciar el sorteo';
  END IF;

  IF v_status != 'DRAWN' THEN
    RAISE EXCEPTION 'El grupo no ha sido sorteado aún';
  END IF;

  -- Delete all matches (bypasses RLS)
  DELETE FROM matches WHERE group_id = p_group_id;

  -- Update group status
  UPDATE groups SET status = 'PLANNING' WHERE id = p_group_id;

  RETURN TRUE;
END;
$$;
