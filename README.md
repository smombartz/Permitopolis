# Permitopolis Events Permitting

A clickable, front-end-only prototype of a city clerk's event permitting site: a public landing page,
an applicant wizard and to-do board, and queue, pipeline and case views for three city roles (City
Clerk, Public Works & Safety, Health & Legal). All state lives in the browser and resets to a seed of
38 cases on a fixed demo date, Mon, May 3, 2027.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm check      # type-check, lint, 3,197 tests, production build
```

Start at `/` (the public landing page) or `/demo` (the presenter's guide with the seven demo paths).
The top bar switches between the Applicant and the three city roles; the Demo menu resets the data,
moves the demo date and jumps to each scenario. `Cmd+K` opens the command palette.

## Where things are

- `docs/readme.md`: start with "Presenting it", then the architecture and every screen
- `docs/plans/2026-10-12-permitopolis-prototype.md`: the build plan; section 12 lists what to look at
- `docs/spec/prd.md`: the product requirements
- `docs/log.md`: change log
- `/dev/kit` and `/dev/map`: every shared component and map mode on one page (not linked from the app)
