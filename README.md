# Translator App

Cloudflare stack app (Workers, D1, R2, Queues) that translates novels into English chapter by chapter

## Todo

- use dropzone instead of file input - done
- update novel details design - done
- novel details: download raw file button (with file size/filename metadata)
- edit novel details (modal + update endpoint)
- delete novel (with confirm + R2 cleanup)
- implement recent activity by db trigger maybe - create ticket
- greetings message changing too frequently


## review notes (all addressed in this branch):

- names instructions camelCase output → aligned to D1 column names (`source_names`/`english_names`) across instructions, gateway schemas, ports, and tests.
- combine new-names + notes-diff: did it — single `model.getNotesDiff({ sourceText, filteredNotes })` call per chapter; new-name discovery folded into the notes instructions. Rationale: our pipeline feeds `newNames` nowhere but the notes diff, and runs sequentially (ADR-0001), so the extra round-trip only added latency. `NAME INSTRUCTIONS.md` removed.
- “core file”: replaced the ambiguous “core” label; `glossary.ts`/`service.ts` are the framework-agnostic domain logic, `gateway-model.ts` is the `model`-port adapter (does I/O to the gateway) — that's why it isn't grouped with the pure core.
- MODEL_ID: moved to `env.EXTRACTION_MODEL_ID`, wired via `createGatewayModel(modelId)` and declared in `wrangler.jsonc` `vars`; `cf:typegen` regenerated.
- applyGlossaryDiff `++` ids: kept, documented. The DB owns the *persisted* id (inserts omit `id`, D1 auto-increment assigns it); the in-memory ids exist only so a diff can be merged/addressable in the pure core (a later addition may merge into an earlier just-added addition).
