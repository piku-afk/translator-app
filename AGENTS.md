## Agent skills

### Issue tracker

Issues and specs live as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map to identically-named labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Database

The D1 schema is defined once in `migrations/*.ts` (Kysely) and compiled by `scripts/generate-migrations.ts` into `d1-migrations/*.sql`, which wrangler applies. See `docs/adr/0003-d1-schema-compiled-from-kysely.md` for the full rationale. The invariants:

- Migrations are **DDL-only** (no reads) and **`up`-only** (no `down()`); the generator's capturing driver throws on non-DDL queries.
- Applied migrations are **immutable** — never edit one; append a new `NNN_...` file.
- `d1-migrations/` is **gitignored build output**, regenerated fresh on each run; all DDL flows through a `.ts`.
- Apply only via `pnpm db:migrate` (`--local` / `--remote`); remote apply is an explicit, operator-initiated step separate from deploy.
- Typegen runs locally from the migration SQL, never from the live remote DB.
