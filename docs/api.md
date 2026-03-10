# AI Backend API (MVP)

Base path suggestion: `/api/v1`

Authentication: Supabase JWT (Bearer token)

---

## 1) POST `/ai/run`

Create and execute an AI run.

### Request body

```json
{
  "project_id": "proj_123",
  "mode": "ask",
  "prompt": "Explain how auth works in this repo.",
  "context": {
    "paths": ["src/auth.ts"]
  },
  "idempotency_key": "optional-client-key"
}