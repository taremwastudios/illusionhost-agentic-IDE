-- Core tables for Illusionhost lightweight IDE assistant
-- Safe to run in Supabase SQL editor or migration pipeline.

create extension if not exists pgcrypto;

-- 1) projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null,
      name text not null,
        repo_owner text not null,
          repo_name text not null,
            default_branch text not null default 'main',
              created_by uuid not null,
                created_at timestamptz not null default now(),
                  updated_at timestamptz not null default now(),
                    unique (workspace_id, repo_owner, repo_name)
                    );

                    create index if not exists idx_projects_workspace on public.projects (workspace_id);

                    -- 2) ai_runs
                    create table if not exists public.ai_runs (
                      id uuid primary key default gen_random_uuid(),
                        project_id uuid not null references public.projects(id) on delete cascade,
                          user_id uuid not null,
                            mode text not null check (mode in ('ask', 'code', 'plan')),
                              status text not null check (status in ('requested','validated','authorized','queued','running','succeeded','failed','cancelled')),
                                prompt text not null,
                                  provider text,
                                    idempotency_key text,
                                      error_code text,
                                        error_message text,
                                          started_at timestamptz,
                                            finished_at timestamptz,
                                              created_at timestamptz not null default now(),
                                                updated_at timestamptz not null default now()
                                                );

                                                create index if not exists idx_ai_runs_project_created on public.ai_runs (project_id, created_at desc);
                                                create unique index if not exists idx_ai_runs_idempotency
                                                  on public.ai_runs (project_id, idempotency_key)
                                                    where idempotency_key is not null;

                                                    -- 3) ai_tool_calls
                                                    create table if not exists public.ai_tool_calls (
                                                      id uuid primary key default gen_random_uuid(),
                                                        run_id uuid not null references public.ai_runs(id) on delete cascade,
                                                          project_id uuid not null references public.projects(id) on delete cascade,
                                                            tool_name text not null,
                                                              status text not null check (status in ('requested','running','succeeded','failed')),
                                                                input_json jsonb not null,
                                                                  output_json jsonb,
                                                                    error_code text,
                                                                      error_message text,
                                                                        started_at timestamptz,
                                                                          finished_at timestamptz,
                                                                            created_at timestamptz not null default now()
                                                                            );

                                                                            create index if not exists idx_tool_calls_run_created on public.ai_tool_calls (run_id, created_at);
                                                                            create index if not exists idx_tool_calls_project_created on public.ai_tool_calls (project_id, created_at desc);

                                                                            -- 4) repo_checkpoints
                                                                            create table if not exists public.repo_checkpoints (
                                                                              id uuid primary key default gen_random_uuid(),
                                                                                project_id uuid not null references public.projects(id) on delete cascade,
                                                                                  run_id uuid references public.ai_runs(id) on delete set null,
                                                                                    label text not null,
                                                                                      scope text not null default 'run' check (scope in ('run','manual')),
                                                                                        git_commit_sha text not null,
                                                                                          git_ref text,
                                                                                            created_by uuid not null,
                                                                                              created_at timestamptz not null default now()
                                                                                              );

                                                                                              create index if not exists idx_checkpoints_project_created on public.repo_checkpoints (project_id, created_at desc);
                                                                                              create index if not exists idx_checkpoints_run on public.repo_checkpoints (run_id);

                                                                                              -- 5) rollback_events
                                                                                              create table if not exists public.rollback_events (
                                                                                                id uuid primary key default gen_random_uuid(),
                                                                                                  project_id uuid not null references public.projects(id) on delete cascade,
                                                                                                    run_id uuid references public.ai_runs(id) on delete set null,
                                                                                                      checkpoint_id uuid not null references public.repo_checkpoints(id) on delete restrict,
                                                                                                        requested_by uuid not null,
                                                                                                          mode text not null check (mode in ('soft','hard')),
                                                                                                            reason text,
                                                                                                              from_commit_sha text,
                                                                                                                to_commit_sha text not null,
                                                                                                                  status text not null check (status in ('requested','succeeded','failed')),
                                                                                                                    error_code text,
                                                                                                                      error_message text,
                                                                                                                        created_at timestamptz not null default now()
                                                                                                                        );

                                                                                                                        create index if not exists idx_rollbacks_project_created on public.rollback_events (project_id, created_at desc);
                                                                                                                        create index if not exists idx_rollbacks_checkpoint on public.rollback_events (checkpoint_id);

                                                                                                                        -- Enable RLS
                                                                                                                        alter table public.projects enable row level security;
                                                                                                                        alter table public.ai_runs enable row level security;
                                                                                                                        alter table public.ai_tool_calls enable row level security;
                                                                                                                        alter table public.repo_checkpoints enable row level security;
                                                                                                                        alter table public.rollback_events enable row level security;

                                                                                                                        -- Minimal starter policies. Replace with workspace membership joins when membership table is available.
                                                                                                                        -- For now: user can access rows where they are the creator/requester.

                                                                                                                        drop policy if exists projects_owner_select on public.projects;
                                                                                                                        create policy projects_owner_select on public.projects
                                                                                                                        for select using (created_by = auth.uid());

                                                                                                                        drop policy if exists projects_owner_insert on public.projects;
                                                                                                                        create policy projects_owner_insert on public.projects
                                                                                                                        for insert with check (created_by = auth.uid());

                                                                                                                        drop policy if exists projects_owner_update on public.projects;
                                                                                                                        create policy projects_owner_update on public.projects
                                                                                                                        for update using (created_by = auth.uid()) with check (created_by = auth.uid());

                                                                                                                        drop policy if exists ai_runs_owner_access on public.ai_runs;
                                                                                                                        create policy ai_runs_owner_access on public.ai_runs
                                                                                                                        for all using (user_id = auth.uid()) with check (user_id = auth.uid());

                                                                                                                        drop policy if exists ai_tool_calls_owner_access on public.ai_tool_calls;
                                                                                                                        create policy ai_tool_calls_owner_access on public.ai_tool_calls
                                                                                                                        for all using (
                                                                                                                          exists (
                                                                                                                              select 1 from public.ai_runs r
                                                                                                                                  where r.id = ai_tool_calls.run_id and r.user_id = auth.uid()
                                                                                                                                    )
                                                                                                                                    ) with check (
                                                                                                                                      exists (
                                                                                                                                          select 1 from public.ai_runs r
                                                                                                                                              where r.id = ai_tool_calls.run_id and r.user_id = auth.uid()
                                                                                                                                                )
                                                                                                                                                );

                                                                                                                                                drop policy if exists checkpoints_owner_access on public.repo_checkpoints;
                                                                                                                                                create policy checkpoints_owner_access on public.repo_checkpoints
                                                                                                                                                for all using (created_by = auth.uid()) with check (created_by = auth.uid());

                                                                                                                                                drop policy if exists rollback_owner_access on public.rollback_events;
                                                                                                                                                create policy rollback_owner_access on public.rollback_events
                                                                                                                                                for all using (requested_by = auth.uid()) with check (requested_by = auth.uid());

                                                                                                                                                -- Helpful trigger to keep updated_at fresh
                                                                                                                                                create or replace function public.set_updated_at()
                                                                                                                                                returns trigger
                                                                                                                                                language plpgsql
                                                                                                                                                as $$
                                                                                                                                                begin
                                                                                                                                                  new.updated_at = now();
                                                                                                                                                    return new;
                                                                                                                                                    end;
                                                                                                                                                    $$;

                                                                                                                                                    drop trigger if exists trg_projects_updated_at on public.projects;
                                                                                                                                                    create trigger trg_projects_updated_at
                                                                                                                                                    before update on public.projects
                                                                                                                                                    for each row
                                                                                                                                                    execute procedure public.set_updated_at();

                                                                                                                                                    drop trigger if exists trg_ai_runs_updated_at on public.ai_runs;
                                                                                                                                                    create trigger trg_ai_runs_updated_at
                                                                                                                                                    before update on public.ai_runs
                                                                                                                                                    for each row
                                                                                                                                                    execute procedure public.set_updated_at();
