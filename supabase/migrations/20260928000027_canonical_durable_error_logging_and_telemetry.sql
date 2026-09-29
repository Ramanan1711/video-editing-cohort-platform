-- ==============================================================================
-- Migration 32: Canonical Durable Error Logging, Telemetry & Sentry Alignment
-- File: supabase/migrations/20260928000027_canonical_durable_error_logging_and_telemetry.sql
--
-- Provides:
-- 1. Authoritative durable client error log table: public.app_error_logs
-- 2. Anti-tamper RLS: public write/ingest, strict admin-only read/resolve
-- 3. Stored procedures:
--    - log_client_error: resilient ingestion with spoofing protection
--    - get_durable_error_logs: filtered, paginated query for ops/admin monitoring
--    - get_error_telemetry_stats: aggregate analytics for telemetry dashboards
--    - resolve_error_log: resolution state tracking for admin ops
-- ==============================================================================

-- 1. Create public.app_error_logs
create table if not exists public.app_error_logs (
    id uuid primary key default gen_random_uuid(),
    error_id text not null,
    "timestamp" timestamptz not null default now(),
    title text not null,
    message text not null,
    stack text,
    level text not null default 'error' check (level in ('info', 'warning', 'error', 'fatal')),
    url text,
    user_id uuid references auth.users(id) on delete set null,
    user_email text,
    user_role text,
    handled boolean not null default true,
    breadcrumbs jsonb default '[]'::jsonb,
    tags jsonb default '{}'::jsonb,
    extra jsonb default '{}'::jsonb,
    source text not null default 'client',
    resolved boolean not null default false,
    resolved_at timestamptz,
    resolved_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 2. Indexes for efficient monitoring queries
create index if not exists idx_app_error_logs_created_at on public.app_error_logs (created_at desc);
create index if not exists idx_app_error_logs_level on public.app_error_logs (level);
create index if not exists idx_app_error_logs_user_id on public.app_error_logs (user_id);
create index if not exists idx_app_error_logs_handled on public.app_error_logs (handled);
create index if not exists idx_app_error_logs_resolved on public.app_error_logs (resolved);

-- 3. Row Level Security Policies
alter table public.app_error_logs enable row level security;

-- Ingestion: Anyone can log client errors (anon or authenticated)
drop policy if exists "allow_anon_and_auth_insert_errors" on public.app_error_logs;
create policy "allow_anon_and_auth_insert_errors"
    on public.app_error_logs
    for insert
    to authenticated, anon
    with check (
        length(title) > 0 and length(message) > 0
    );

-- Read: Only admins or users with view_audit_logs permission
drop policy if exists "allow_admin_read_error_logs" on public.app_error_logs;
create policy "allow_admin_read_error_logs"
    on public.app_error_logs
    for select
    to authenticated
    using (
        public.is_admin() or 
        public.has_admin_permission('view_audit_logs')
    );

-- Update: Only admins can mark errors resolved
drop policy if exists "allow_admin_update_error_logs" on public.app_error_logs;
create policy "allow_admin_update_error_logs"
    on public.app_error_logs
    for update
    to authenticated
    using (
        public.is_admin() or 
        public.has_admin_permission('view_audit_logs')
    )
    with check (
        public.is_admin() or 
        public.has_admin_permission('view_audit_logs')
    );

-- 4. Ingestion Procedure: log_client_error
create or replace function public.log_client_error(
    p_error_id text,
    p_title text,
    p_message text,
    p_level text default 'error',
    p_stack text default null,
    p_url text default null,
    p_handled boolean default true,
    p_breadcrumbs jsonb default '[]'::jsonb,
    p_tags jsonb default '{}'::jsonb,
    p_extra jsonb default '{}'::jsonb,
    p_user_id uuid default null,
    p_user_email text default null,
    p_user_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_actual_user_id uuid;
    v_user_email text := p_user_email;
    v_user_role text := p_user_role;
    v_new_id uuid;
    v_caller_is_admin boolean;
begin
    -- Check if authenticated caller is an admin
    v_caller_is_admin := public.is_admin();

    -- Anti-spoofing: if caller is authenticated and not admin, bind strictly to auth.uid()
    if auth.uid() is not null then
        v_actual_user_id := auth.uid();
        if not v_caller_is_admin or v_user_email is null then
            select email, coalesce(p.role, 'student')
            into v_user_email, v_user_role
            from auth.users u
            left join public.profiles p on p.id = u.id
            where u.id = auth.uid();
        end if;
    else
        -- Anonymous client session
        v_actual_user_id := null;
        if not v_caller_is_admin then
            v_user_email := null;
            v_user_role := 'anonymous';
        end if;
    end if;

    -- Normalize level
    if p_level not in ('info', 'warning', 'error', 'fatal') then
        p_level := 'error';
    end if;

    insert into public.app_error_logs (
        error_id,
        title,
        message,
        stack,
        level,
        url,
        user_id,
        user_email,
        user_role,
        handled,
        breadcrumbs,
        tags,
        extra,
        source
    ) values (
        coalesce(p_error_id, 'err_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6)),
        coalesce(nullif(trim(p_title), ''), 'Unknown Error'),
        coalesce(nullif(trim(p_message), ''), 'No error message provided'),
        p_stack,
        p_level,
        p_url,
        v_actual_user_id,
        v_user_email,
        v_user_role,
        coalesce(p_handled, true),
        coalesce(p_breadcrumbs, '[]'::jsonb),
        coalesce(p_tags, '{}'::jsonb),
        coalesce(p_extra, '{}'::jsonb),
        'client'
    )
    returning id into v_new_id;

    return jsonb_build_object(
        'success', true,
        'id', v_new_id,
        'error_id', p_error_id
    );
end;
$$;

grant execute on function public.log_client_error to authenticated, anon;

-- 5. Query Procedure: get_durable_error_logs
create or replace function public.get_durable_error_logs(
    p_limit int default 50,
    p_offset int default 0,
    p_level text default null,
    p_handled boolean default null,
    p_resolved boolean default null,
    p_search text default null
)
returns table (
    id uuid,
    error_id text,
    "timestamp" timestamptz,
    title text,
    message text,
    stack text,
    level text,
    url text,
    user_id uuid,
    user_email text,
    user_role text,
    handled boolean,
    breadcrumbs jsonb,
    tags jsonb,
    extra jsonb,
    source text,
    resolved boolean,
    resolved_at timestamptz,
    resolved_by uuid,
    resolver_email text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not (public.is_admin() or public.has_admin_permission('view_audit_logs')) then
        raise exception 'Access denied: view_audit_logs permission required';
    end if;

    return query
    select
        e.id,
        e.error_id,
        e."timestamp",
        e.title,
        e.message,
        e.stack,
        e.level,
        e.url,
        e.user_id,
        e.user_email,
        e.user_role,
        e.handled,
        e.breadcrumbs,
        e.tags,
        e.extra,
        e.source,
        e.resolved,
        e.resolved_at,
        e.resolved_by,
        u.email as resolver_email,
        e.created_at
    from public.app_error_logs e
    left join auth.users u on u.id = e.resolved_by
    where
        (p_level is null or e.level = p_level) and
        (p_handled is null or e.handled = p_handled) and
        (p_resolved is null or e.resolved = p_resolved) and
        (
            p_search is null or
            p_search = '' or
            e.title ilike '%' || p_search || '%' or
            e.message ilike '%' || p_search || '%' or
            e.error_id ilike '%' || p_search || '%' or
            coalesce(e.user_email, '') ilike '%' || p_search || '%'
        )
    order by e.created_at desc
    limit coalesce(p_limit, 50)
    offset coalesce(p_offset, 0);
end;
$$;

grant execute on function public.get_durable_error_logs to authenticated;

-- 6. Stats Aggregator: get_error_telemetry_stats
create or replace function public.get_error_telemetry_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total bigint;
    v_last_24h bigint;
    v_fatal_count bigint;
    v_unhandled_count bigint;
    v_resolved_count bigint;
    v_unresolved_count bigint;
begin
    if not (public.is_admin() or public.has_admin_permission('view_audit_logs')) then
        raise exception 'Access denied: view_audit_logs permission required';
    end if;

    select count(*) into v_total from public.app_error_logs;
    select count(*) into v_last_24h from public.app_error_logs where created_at >= (now() - interval '24 hours');
    select count(*) into v_fatal_count from public.app_error_logs where level = 'fatal';
    select count(*) into v_unhandled_count from public.app_error_logs where handled = false;
    select count(*) into v_resolved_count from public.app_error_logs where resolved = true;
    v_unresolved_count := v_total - v_resolved_count;

    return jsonb_build_object(
        'total', v_total,
        'last24Hours', v_last_24h,
        'fatalCount', v_fatal_count,
        'unhandledCount', v_unhandled_count,
        'resolvedCount', v_resolved_count,
        'unresolvedCount', v_unresolved_count
    );
end;
$$;

grant execute on function public.get_error_telemetry_stats to authenticated;

-- 7. Resolution Procedure: resolve_error_log
create or replace function public.resolve_error_log(
    p_id uuid,
    p_resolved boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not (public.is_admin() or public.has_admin_permission('view_audit_logs')) then
        raise exception 'Access denied: view_audit_logs permission required';
    end if;

    update public.app_error_logs
    set
        resolved = coalesce(p_resolved, true),
        resolved_at = case when coalesce(p_resolved, true) then now() else null end,
        resolved_by = case when coalesce(p_resolved, true) then auth.uid() else null end
    where id = p_id;

    return found;
end;
$$;

grant execute on function public.resolve_error_log to authenticated;
