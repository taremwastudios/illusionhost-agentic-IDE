# API Error Contract

All endpoints should return a consistent error object.

## JSON shape

```json
{
  "error": {
    "code": "string_machine_code",
    "message": "Human-readable message",
    "retryable": false,
    "hint": "Optional next step for user/developer",
    "details": {}
  },
  "request_id": "uuid"
}