# Change log

## 2026-10-12 - Phase 0: scaffold, contracts and reference data

**What Changed:**
- Scaffolded Next.js 16.4 with Tailwind v4 and shadcn/ui (Radix), installed every dependency, and set up Vitest with a node project and a jsdom project
- Wrote the frozen contracts: domain types, the Action union, the rules and state API interfaces with stub barrels, the rules config, routes, date and format helpers
- Wrote the reference data (spaces, streets, calendar, fees) and the Rime & Ink tokens, and pointed shadcn's variables at them
- Added lint guards (no real clock, no randomness, no browser dialogs, no direct localStorage) and guard tests (no raw colors, no imports between surfaces)
- Converted the PRD, flows document and scenarios sheet into `docs/spec/`
- Filled in `CLAUDE.md` with the project overview and build rules for agents; wrote `README.md` and `docs/readme.md`
- Recorded in the plan that the build runs through Phase 6 without visual checkpoints, with no deploy and with jsdom render tests instead of Playwright

**Why:**
- Phase 0 of the plan: every later workstream builds against these files in parallel

**Files Modified:**
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts`, `components.json`, `.gitignore`, `AGENTS.md`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `styles/tokens.css`, `components/ui/*` (shadcn)
- `lib/types.ts`, `lib/routes.ts`, `lib/format.ts`, `lib/dates.ts`, `lib/utils.ts`
- `lib/rules/{types,config,index}.ts`, `lib/state/{actions,types,index,storage}.ts`, `lib/state/seed/index.ts`
- `lib/data/{inventory,streets,calendar,fees}.ts`
- `tests/guards.test.ts`, `tests/render/{setup.ts,smoke.test.tsx}`, `lib/**/*.test.ts`
- `docs/spec/*`, `docs/readme.md`, `README.md`, `CLAUDE.md`, `docs/plans/2026-10-12-permitopolis-prototype.md`

---

## 2026-10-12 - Implementation plan for the Permitopolis prototype

**What Changed:**
- Created the phased, multi-agent implementation plan: seven phases, file ownership per workstream, shared contracts (types, rules and state signatures, action list), acceptance tables and the workflow shape for each phase
- Recorded the decisions that go beyond the PRD: public landing page at `/`, 25 background seed cases (38 in total), one workflow per phase, Rime & Ink replacing the PRD's look and feel, and ten seed-data fixes

**Why:**
- Requested plan for building the landing page and the applicant and city web app from the PRD, decision tree, design system and demo scenarios, structured so several agents can work in parallel

**Files Modified:**
- `docs/plans/2026-10-12-permitopolis-prototype.md` - new plan

---

## 2026-10-12 - Project scaffolded

**What Changed:**
- Created the project folder with CLAUDE.md, README.md, and the docs/ layout

**Why:**
- New project created from DashCode

**Files Modified:**
- `CLAUDE.md`
- `README.md`
- `docs/readme.md`
- `docs/log.md`

---
