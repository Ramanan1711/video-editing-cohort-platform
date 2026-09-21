-- ==============================================================================
-- CUT / CRAFT Video Editing Cohort Platform
-- Migration: Recommended Add-on Features
-- ==============================================================================

-- 1. Ensure feedback table has rubric, timestamped_notes, and private_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'rubric'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN rubric JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'timestamped_notes'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN timestamped_notes JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'private_notes'
  ) THEN
    ALTER TABLE public.feedback ADD COLUMN private_notes TEXT DEFAULT NULL;
  END IF;
END $$;

-- 2. Ensure lesson_progress table has watch_percentage and last_position_seconds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lesson_progress' AND column_name = 'watch_percentage'
  ) THEN
    ALTER TABLE public.lesson_progress ADD COLUMN watch_percentage INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lesson_progress' AND column_name = 'last_position_seconds'
  ) THEN
    ALTER TABLE public.lesson_progress ADD COLUMN last_position_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- 3. Ensure student_notifications has category and action_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'student_notifications' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.student_notifications ADD COLUMN category TEXT DEFAULT 'system';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'student_notifications' AND column_name = 'action_url'
  ) THEN
    ALTER TABLE public.student_notifications ADD COLUMN action_url TEXT DEFAULT NULL;
  END IF;
END $$;

-- 4. Create student_gamification table for XP, levels, and badges
CREATE TABLE IF NOT EXISTS public.student_gamification (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_points INTEGER DEFAULT 0 NOT NULL,
  editor_level INTEGER DEFAULT 1 NOT NULL,
  streak_freezes_remaining INTEGER DEFAULT 1 NOT NULL,
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.student_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gamification record"
  ON public.student_gamification
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own gamification record"
  ON public.student_gamification
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Enable Supabase Realtime for community and notifications
-- Wrapped in DO block to avoid breaking if tables are already published
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

