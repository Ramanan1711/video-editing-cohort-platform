-- ==============================================================================
-- Migration: 20261014000005_canonical_community_post_views_tracking.sql
-- Description: Dynamic Community Post Views Tracking:
--   1. Adds views_count integer column to public.community_posts
--   2. Atomic, security-definer RPC increment_community_post_views for view counting
-- ==============================================================================

-- 1. Ensure views_count column exists on community_posts
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

-- 2. Index on views_count for sorting/trending queries
CREATE INDEX IF NOT EXISTS idx_community_posts_views
  ON public.community_posts(views_count DESC);

-- 3. Security-definer RPC to atomically increment view counts
CREATE OR REPLACE FUNCTION public.increment_community_post_views(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_views integer;
BEGIN
  UPDATE public.community_posts
  SET views_count = coalesce(views_count, 0) + 1
  WHERE id = p_post_id
  RETURNING views_count INTO v_new_views;

  RETURN coalesce(v_new_views, 1);
END;
$$;

-- Grant execution to all active platform roles
GRANT EXECUTE ON FUNCTION public.increment_community_post_views(uuid) TO anon, authenticated;

