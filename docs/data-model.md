# Data Model (Supabase / Postgres)

This model keeps Git as source-of-truth for code, while Supabase stores metadata, run history, and auditability.

## 1) `projects`

Represents a connected repository in Illusionhost.

Columns:
- `id` (uuid, pk)
- `workspace_id` (uuid, not null)
- `name` (text, not null)
- `repo_owner` (text, not null)
- `repo_name` (text, not null)
- `default_branch` (text, default `main`)
- `created_by` (uuid, not null)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

Indexes:
- unique(`workspace_id`, `repo_owner`, `repo_name`)

---

## 2) `ai_runs`

One record per user AI request.

Columns:
- `id` (uuid, pk)
- `project_id` (uuid, fk -> projects.id, not null)
- `user_id` (uuid, not null)
- `mode` (text, check in `('ask','code','plan')`)
- `status` (text, check in `('requested','validated','authorized','queued','running','succeeded','failed','cancelled')`)
- `prompt` (text, not null)
- `provider` (text, null)
- `idempotency_key` (text, null)
- `error_code` (text, null)
- `error_message` (text, null)
- `started_at` (timestamptz, null)
- `finished_at` (timestamptz, null)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

Indexes:
- index(`project_id`, `created_at desc`)
- unique nullable index on (`project_id`, `idempotency_key`) where `idempotency_key is not null`

---

## 3) `ai_tool_calls`

Structured tool invocation logs per run.

Columns:
- `id` (uuid, pk)
- `run_id` (uuid, fk -> ai_runs.id, not null)
- `project_id` (uuid, fk -> projects.id, not null)
- `tool_name` (text, not null)
- `status` (text, check in `('requested','running','succeeded','failed')`)
- `input_json` (jsonb, not null)
- `output_json` (jsonb, null)
- `error_code` (text, null)
- `error_message` (text, null)
- `started_at` (timestamptz, null)
- `finished_at` (timestamptz, null)
- `created_at` (timestamptz, default now())

Indexes:
- index(`run_id`, `created_at`)
- index(`project_id`, `created_at desc`)

---

## 4) `repo_checkpoints`

Checkpoint metadata mapped to Git commit references.

Columns:
- `id` (uuid, pk)
- `project_id` (uuid, fk -> projects.id, not null)
- `run_id` (uuid, fk -> ai_runs.id, null) -- null for manual checkpoints
- `label` (text, not null) -- e.g. `pre_run_<run_id>`
- `scope` (text, check in `('run','manual')`, default `run`)
- `git_commit_sha` (text, not null)
- `git_ref` (text, null) -- optional tag/branch pointer
- `created_by` (uuid, not null)
- `created_at` (timestamptz, default now())

Indexes:
- index(`project_id`, `created_at desc`)
- index(`run_id`)

---

## 5) `rollback_events`

Audit trail for every restore operation.

Columns:
- `id` (uuid, pk)
- `project_id` (uuid, fk -> projects.id, not null)
- `run_id` (uuid, fk -> ai_runs.id, null)
- `checkpoint_id` (uuid, fk -> repo_checkpoints.id, not null)
- `requested_by` (uuid, not null)
- `mode` (text, check in `('soft','hard')`, not null)
- `reason` (text, null)
- `from_commit_sha` (text, null)
- `to_commit_sha` (text, not null)
- `status` (text, check in `('requested','succeeded','failed')`, not null)
- `error_code` (text, null)
- `error_message` (text, null)
- `created_at` (timestamptz, default now())

Indexes:
- index(`project_id`, `created_at desc`)
- index(`checkpoint_id`)

---

## RLS Notes (high level)

Apply RLS on all tables:
- User must belong to project workspace.
- User can only read/write rows for authorized projects.
- Service role only for backend worker operations (never exposed in browser).