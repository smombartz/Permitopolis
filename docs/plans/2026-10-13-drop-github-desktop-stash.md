# Drop the GitHub Desktop stash and reclaim its space

## Context

The repo has one stash, `stash@{0}` (commit `ae4e6384`), labelled `!!GitHub_Desktop<master>`.
GitHub Desktop made it on Oct 13 at 10:42, when the working tree was switched from `build` to
`master` and back. At that moment `master` was still the bare "Scaffold App" commit with no
`.gitignore`, so everything untracked on disk looked like new work and was stashed.

It holds 57,035 files, all additions and all regenerable:

| Folder | Files |
|---|---|
| `node_modules/` | 55,404 |
| `.next/` | 1,629 |
| `next-env.d.ts`, `tsconfig.tsbuildinfo` | 2 |

There is no source code in it. It keeps 769 MB of the 780 MB in `.git` alive (everything
`master` needs is 6.3 MB), and `.git` sits inside Dropbox, so that space syncs too. You chose to
drop it and reclaim the space.

It cannot happen again the same way: `master` now carries the `.gitignore`, so GitHub Desktop no
longer sees these folders as changes.

## Steps

1. **Save this plan** to `docs/plans/2026-10-13-drop-github-desktop-stash.md` (the project's rule
   for every plan).
2. **Re-check before deleting** (read-only). Stop and report if any of these is not true:
   - `git stash list` shows exactly one entry, `stash@{0}`, labelled `!!GitHub_Desktop<master>`,
     at commit `ae4e6384`.
   - Every path in it is under `node_modules/` or `.next/`, or is `next-env.d.ts` or
     `tsconfig.tsbuildinfo`
     (`git diff --name-only 'stash@{0}^1' 'stash@{0}' | grep -v -E '^(node_modules|\.next)/'`
     prints only those two files).
   - `git status` is clean, and `master` and `build` are the same commit (`fe99068b`).
3. **Drop the stash**: `git stash drop 'stash@{0}'`.
4. **Reclaim the space**: `git gc --prune=now`. This removes every object nothing refers to any
   more. Besides the stash, that covers a few leftovers from the build (commits an integrator
   re-created with attribution lines, and tips of merged worktree branches); none is needed.
   After this the stash cannot be recovered.
5. **Record it**: a short entry at the top of `docs/log.md` (the plan file is a new file), then
   commit the plan and the log on `master` and move `build` to the same commit. The live site
   needs no redeploy; only docs change.

Nothing in the working tree is touched: the `node_modules` and `.next` folders on disk are
separate from the stash and stay as they are.

## Verification

- `git stash list` prints nothing.
- `du -sh .git` is about 10 MB (it was 780 MB); `git count-objects -vH` shows the pack shrunk.
- `git fsck` reports no errors.
- `git log --oneline -1` on `master` is the new docs commit on top of `fe99068b`; `master` and
  `build` are the same commit; `git status` is clean.
- `node_modules` and `.next` are still on disk and still carry the `com.dropbox.ignored`
  attribute.
- `pnpm check` passes (type-check, lint, 3,197 tests, production build), which shows the working
  tree is intact.

## Changes

- 2026-10-13: Done as planned. The re-check passed, the stash was dropped and its objects pruned;
  `.git` went from 780 MB to 3.1 MB. `git fsck` reports no errors, no stash is left, and the working
  tree's `node_modules` and `.next` were not touched.
