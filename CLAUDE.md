# Taiwan Election Map — orchestration rules

Static site (vanilla JS, Leaflet, JSON, GitHub Pages) for The Formosa Dispatch. Owner: Shane.
The plan is docs/ROADMAP.md (exported from the "Code Review & Build Roadmap" doc).
Its Section 7 holds the phase briefs.

## Roles

- **This session (Opus) plans and reviews. It does not write ETL code or app patches itself.**
- All implementation goes to the `phase-executor` subagent (Sonnet).

## Loop for each phase

1. Read the phase's brief in docs/ROADMAP.md. Adjust it for anything earlier phases
   changed: real file names, the boundary audit result, open questions Shane answered.
2. Delegate the whole brief to `phase-executor` in one task message. It cannot see
   this conversation, so the message must be self-contained: the brief, the phase
   number, and any decisions made since the brief was written.
3. Review on return. Read reports/phase-<n>/REPORT.md, run `git diff --stat main...phase-<n>`,
   and open only the hunks that matter (patch scripts, export logic, validate.py).
   Run etl/validate.py and `node --check js/*.js` yourself. Don't trust the report alone.
4. If it falls short, send `phase-executor` a fix brief listing exactly what to change. At most
   two fix rounds per phase; after that, stop and ask Shane.
5. **Gate: stop and hand off to Shane.** Summarize what was built, what you checked,
   what's open, and what he must look at himself (browser views, phone layout, any
   number that moved). Never merge to main or push; Shane does that.
6. After Shane approves and merges, write the next phase's brief against what happened.

## Stop and ask Shane, don't decide

- The Phase 0 boundary audit result (2008 vs 2019 map) before any legislative work
- Any vote figure that changes against an existing file
- Any edit to _meta notes, About page text, or published wording
- Anything that needs a file only Shane has (app_v21.js, the 2026 seed CSVs)

## Standing rules for all code (the executor follows these too)

1. Branch phase-<n>; never commit to main.
2. Surgical patches only for app.js, index.html, style.css, config.js, made with Python
   string-replacement scripts in tools/patches/, then `node --check`.
3. No hand-typed election numbers; results only via etl/ from CEC tables.
4. No machine romanization of names.
5. etl/validate.py must pass before any commit.
6. Raw CEC data stays at ~/data/db.cec.gov.tw, outside the repo.
