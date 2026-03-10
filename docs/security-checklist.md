# Security Checklist (MVP)

Use this before production rollout.

## Authentication & Authorization
- [ ] Supabase JWT required for all API routes.
- [ ] Server verifies workspace/project membership for each request.
- [ ] Repo owner/name requests are validated against linked project record (no free-form escalation).
- [ ] Mode enforcement is server-side (not frontend-only).

## RLS
- [ ] RLS enabled on `projects`, `ai_runs`, `ai_tool_calls`, `repo_checkpoints`, `rollback_events`.
- [ ] Policies restrict reads/writes to authorized workspace users.
- [ ] Service-role key never exposed to frontend.

## Tool Safety
- [ ] Tool allowlist per mode implemented.
- [ ] Write tools require prior checkpoint.
- [ ] Hard rollback requires explicit confirmation.
- [ ] Path validation prevents traversal (`../`) and forbidden roots.

## Git Safety
- [ ] No direct writes to protected `main`.
- [ ] Branch-per-run or protected integration strategy enabled.
- [ ] Checkpoint stores git commit SHA for deterministic restore.
- [ ] Restore operations are fully audit-logged.

## API Hardening
- [ ] Request schema validation on all routes.
- [ ] Standard error envelope returned on failures.
- [ ] Rate limits per user/project.
- [ ] Idempotency keys supported for `/ai/run`.

## Secrets & Integrations
- [ ] GitHub App private key stored in secure environment variables.
- [ ] OpenRouter/Groq keys stored server-side only.
- [ ] GitHub webhook signatures verified (`X-Hub-Signature-256`).
- [ ] Rotate secrets and define incident rotation procedure.

## Observability & Auditing
- [ ] Every run has `request_id` and `run_id`.
- [ ] Tool calls and rollback events logged with actor and timestamp.
- [ ] Alerting for repeated failed restores / authz failures.
- [ ] Retention policy defined for logs and tool payloads.

## Data Protection
- [ ] Never log secret tokens or private key contents.
- [ ] Redact sensitive data in error `details`.
- [ ] Define retention windows for prompts/output per workspace policy.