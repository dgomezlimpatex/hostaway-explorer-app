# Historical migration archive

This directory is an audit archive of the migration files that existed before
the production migration history was reconciled on 2026-08-31.

These files are intentionally outside `supabase/migrations` and must not be
treated as pending migrations. The canonical schema snapshot is
`supabase/migrations/20260831093730_remote_schema.sql`; future migrations must
be created after that snapshot with `supabase migration new`.
