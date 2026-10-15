-- Migration: Add WhatsApp Group URL and Mentor Phone to cohorts table
-- Author: Antigravity Assistant
-- Date: 2026-10-15

alter table public.cohorts add column if not exists mentor_phone text default '919080995108';
alter table public.cohorts add column if not exists whatsapp_group_url text default 'https://chat.whatsapp.com/G7tEsqF5Mq1FzLzZHlpHjz?mode=gi_t';

comment on column public.cohorts.mentor_phone is 'Direct WhatsApp phone number for assigned mentor or academy support contact with country code.';
comment on column public.cohorts.whatsapp_group_url is 'Direct invite link to official private WhatsApp batch community group.';

