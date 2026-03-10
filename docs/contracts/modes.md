# Modes Policy Matrix

## Principles
- Mode is enforced server-side, never frontend-only.
- Every tool call must validate `mode` + user authorization.
- `code` mode must auto-create checkpoint before first write operation in a run.

## Mode definitions

### ask
Purpose: explain, inspect, analyze (read-only)

Allowed tools:
- `list_files`
- `read_file`
- `list_checkpoints`
- `diff_from_checkpoint`

Denied tools:
- `write_file`
- `create_checkpoint` (manual)
- `return_state`

### code
Purpose: perform edits with safeguards

Allowed tools:
- `list_files`
- `read_file`
- `write_file`
- `create_checkpoint`
- `list_checkpoints`
- `diff_from_checkpoint`
- `return_state`

Required safeguards:
1. Auto `create_checkpoint(label=pre_run_<run_id>)` before first mutation.
2. Require explicit confirmation for `return_state(mode=hard)`.
3. Persist all tool call logs and outputs.

## Enforcement order
1. Validate request schema.
2. Authenticate user/session.
3. Authorize project/repo access.
4. Validate tool allowed in current mode.
5. Execute tool with timeout/retry policy.
6. Persist audit record.