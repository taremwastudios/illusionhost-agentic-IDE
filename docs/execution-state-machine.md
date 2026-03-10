# Execution State Machine

Defines lifecycle for AI runs and tool calls.

## Run states

`requested -> validated -> authorized -> queued -> running -> succeeded | failed | cancelled`

## State definitions

1. `requested`
- Run record created.
- Raw request captured with request_id.

2. `validated`
- JSON schema validation passed.
- Required fields (`project_id`, `mode`, `prompt`) confirmed.

3. `authorized`
- User auth passed.
- Project/repo access verified.
- Mode/tool policy approved.

4. `queued`
- Run handed off to worker/executor.
- Retry metadata initialized.

5. `running`
- Model + tools executing.
- Tool calls logged incrementally.

6. `succeeded`
- Final output persisted.
- Optional code changes completed.
- Checkpoint links attached.

7. `failed`
- Error envelope persisted (`code`, `message`, `retryable`, `hint`).

8. `cancelled`
- User/system cancelled run safely.

---

## Tool-call states

`requested -> running -> succeeded | failed`

Rules:
- Each tool call must persist `input_json` and output/error.
- For write tools in code mode:
  - Ensure checkpoint exists first.
  - Block mutation if checkpoint creation failed.

---

## Required transitions and guardrails

1. `requested -> validated`
- Only if request schema passes.

2. `validated -> authorized`
- Only if user has project permission and tool/mode policy passes.

3. `authorized -> queued`
- Assign job id and idempotency lock.

4. `queued -> running`
- Worker picks job.

5. `running -> succeeded`
- All required tasks complete.

6. `running -> failed`
- Any fatal error; include structured error.

---

## Idempotency

- If same `(project_id, idempotency_key)` arrives:
  - return existing run instead of re-executing.
- For restore:
  - dedupe on `(project_id, checkpoint_id, mode, requester, time_window)`.

---

## Observability

- Every transition emits event for UI timeline.
- Persist timestamps for all state changes.
- Include `request_id` and `run_id` in logs.