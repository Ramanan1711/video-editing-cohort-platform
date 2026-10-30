-- Migration: 20261030000001_add_thumbnail_url_to_lessons.sql
-- Description: Adds thumbnail_url column to public.lessons table to allow custom video cover thumbnails
-- with fallback to auto-detected video provider thumbnails (YouTube/Vimeo).

alter table public.lessons
  add column if not exists thumbnail_url text;

comment on column public.lessons.thumbnail_url is
  'Custom or auto-detected thumbnail image URL for the lesson video content.';

