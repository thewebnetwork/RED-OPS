# Quarantined Files — 2026-04-16

These files were removed from the active codebase because they pose security
or onboarding risks while being completely unused by the running application.

| File | Reason |
|---|---|
| `server_legacy.py` | 4255-line monolith; hardcoded JWT fallback secret (line 38), hardcoded staging URL (line 47), OTP logged to stdout (line 1144). Unimported since `server.py` re-exports `server_v2.py`. |
| `supabase_schema.sql` | PostgreSQL schema for Supabase; backend uses MongoDB. Contains `INSERT INTO users` with bcrypt hash for known password `Admin123!` (lines 201-210). |
| `QUICK_DEPLOY.md` | Deployment guide that instructs operators to deploy with Supabase and includes a sample anon key. Backend has zero Supabase code — following this guide produces a non-functional app. |
| `backups/` | 10 snapshot JSON files from 2026-01-27, previously committed to repo root. Data backups belong in external storage, not version control. |

**DO NOT re-import any of these files.** See `docs/audits/AUDIT_2026-04-16.md` sections 0 and 1.1 for full analysis.
