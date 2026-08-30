# Translator

A Cloudflare-hosted web app that turns a raw source text file (Korean or Chinese) into English chapter by chapter, keeping character and place names consistent via a per-novel glossary.

## Language

**Novel**:
A single source work uploaded to be translated, carrying a declared total chapter count and its own glossary.
_Avoid_: book, document, project

**Chapter**:
One unit of the source text, split from the raw file during parsing and translated independently while sharing its novel's glossary.

**Source language**:
The language of the raw text (Korean or Chinese); it drives which chapter extractor runs and which the models receive.
_Avoid_: language, source

**NovelStatus**:
A novel's lifecycle: `draft → parsing → (ready | needs review | parsing failed) → extracting → (names extracted | extraction failed) → translating → completed`.
_Avoid_: state, progress, status

**Start parsing**:
The operator's explicit action to begin parsing a `draft`, `parsing failed`, or `needs review` novel; it enqueues the parse queue job and is never automatic.
_Avoid_: run, trigger

**Parsing failed**:
A novel whose parse queue consumer exhausted its retries; the app surfaces an alert with the failure reason, and the operator can re-trigger parsing from this state.
_Avoid_: error, broken

**Extraction failed**:
A novel whose extraction queue consumer exhausted its retries; the app surfaces an alert with the failure reason, and the operator can re-trigger extraction (resuming from the last completed chapter).
_Avoid_: error, broken

**Names extracted**:
A novel whose extraction pass completed, so its cumulative glossary is complete and translation can be started deliberately. The Start-translation guard for the next stage.
_Avoid_: done, glossary ready

**Needs review**:
A novel whose extracted chapters differ from its declared total; it holds while the operator manually reconciles the R2 chapters (e.g. adding missing ones) before any translation starts. The app surfaces an alert showing the mismatch; reconciliation is entirely the operator's manual responsibility, and once reconciled on R2, the operator can re-trigger parsing from this state.
_Avoid_: review needed, blocked, partial, paused

**Extracting**:
The first translation pass, in which a novel's chapters are walked sequentially to build its cumulative glossary.
_Avoid_: name detection, prepping

**Start extraction**:
The operator's explicit action to begin name extraction on a `ready` novel (re-run from `names extracted` / `extraction failed`); it enqueues the extraction queue job and is never automatic. It resumes from the last completed chapter.
_Avoid_: run, trigger

**Start translation**:
The operator's explicit action to begin one stage of a `ready` novel; it is never automatic.
_Avoid_: run, trigger

**Operator**:
The single person who operates the app and owns its shared workspace; there is no per-user ownership.
_Avoid_: user, account

**ChapterStatus**:
A single chapter's stage state within the translation pipeline (`queued | names extracted | translating | translated | failed`).
_Avoid_: progress

**Glossary**:
A novel's persistent store of entities organized into `characters | places | misc`. Each entry lists every source-name variation for that entity, a chosen English rendering, a category, and a one-line description; it is built up cumulatively across a novel's chapters before any translation begins.
_Avoid_: dict, namespace

**Name**:
A source-name → English-rendering pair taken from the glossary. It is the only glossary material handed to the translation model; descriptions and name variations are not.
_Avoid_: note

**Note**:
A glossary entry whose purpose is to help the name-extraction model recognize and merge the same entity's multiple source-name variations. It is never passed to the translation model.

**Name extraction**:
The sequential pass that reads a chapter, consults the cumulative glossary, and adds or merges entities via their name variations.
_Avoid_: prep, detect

**Translate**:
The parallel pass that renders a chapter into English from its text plus the name pairs for entities present in it; fully independent once the glossary is complete.

**Chapter rerun**:
Re-translating a single already-handled chapter; it overwrites that chapter's markdown while merging new names/notes into the glossary without duplicating entries.
_Avoid_: retranslate, reprocess

**Greeting**:
The text shown on the home page, stored in the `greetings` D1 table and read at request time, scoped by time-of-day (`night | morning | afternoon | evening`) and day-of-week (`mon`..`sun`) buckets; a greeting with no buckets is valid at any time on any day. The initial 26 live in the seed script (`scripts/seed-greetings.ts`); the Operator edits rows in the cloudflare D1 console (no deployment).
_Avoid_: message, greeting message

**Activity**:
A record that a novel-level lifecycle event happened: **novel created**, **parsing started**, **parsing ready**, **needs review**, **parsing failed**, **extraction started**, **names extracted**, or **extraction failed**. Each Activity snapshots the novel (id and name), the action, an optional detail, and a timestamp. Activities are appended at the service seam when a transition commits — never for pipeline-internal row churn (reparse/re-extraction) and never for rolled-back transitions — and the home page's Recent Activity feed shows the most recent ones. Rendered to the Operator as a human-readable sentence.
_Avoid_: notification, log, history, event, feed item
