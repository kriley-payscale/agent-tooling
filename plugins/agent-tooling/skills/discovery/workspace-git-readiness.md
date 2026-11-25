# Workspace Git readiness

Only the parent performs this procedure and any authorized Git mutation; workers
stay read-only.

## 1. Inventory

Include only explicitly known workspace-owned repository roots relevant to the
request; do not hunt recursively or include external dependencies. Per repository,
record identity, current branch, full HEAD, configured upstream, dirty
worktree/index/untracked state, and any sequencer or other writer. Exclude
user-excluded, read-only, human-only and non-Git paths, recording why. Never expose
credentials in remote identities or evidence. If every path is excluded, record that
and skip step 2.

## 2. Freshness choice

Show the repositories, current branches and upstreams, then ask once: "Get latest on
the current branches before discovery, or continue with the current checkouts?" The
user may select a subset or update themselves. Reuse an explicit choice already
recorded for this run; silence is not consent. Fetch nothing before authorization.

| Choice | Action |
|---|---|
| Continue as-is | Record the exact researched refs and "freshness not verified". Cached tracking refs do not prove remote freshness. |
| User-managed update | Wait for completion, then re-inventory before research. |
| Agent-assisted update (never in read-only discovery) | Run the update below for the selected repositories only. |

Agent-assisted update, with no worker or other Git operation running:

1. Require a clean attached checkout, no sequencer/other writer, and an unambiguous
   configured upstream for the current branch. Never substitute the integration
   branch (the default branch unless the task names another) or a guessed
   remote/branch.
2. Record the branch/upstream pair and before HEAD. Fetch only that upstream branch
   from its configured remote.
3. Recheck branch, upstream, HEAD and clean state, then fast-forward only to the
   fetched ref. Preserve local commits and normal hooks.
4. Record fetch time, outcome and after HEAD. An ahead-only checkout stays honestly
   ahead.

Never switch branches, merge the integration branch into a feature branch, rebase,
reset, stash or force-update to obtain freshness. Dirty, detached, divergent,
missing/ambiguous upstream, authentication, hook, lock and permission cases go back
to the user for user-managed preparation or an explicit continue; a failed update
never silently continues into research. Multi-repo updates are not atomic: keep partial results
without automatic rollback.

## 3. Feature-branch map

Once research identifies the implementation repositories, present at the discovery
review: repository, exact proposed name (following and validated against
repository/host naming conventions), base branch and full base SHA. The base is the
actual researched branch/HEAD; never silently refresh it or substitute the
integration branch. One branch per implementation repository is shared by every task
in that repository; never branch untouched, non-Git or excluded repositories, or per
agent.

Ask to create the mapped branches, reuse explicitly confirmed suitable existing
branches, or defer.

- Authorization for the exact map persists unless evidence changes.
- Branch consent authorizes no implementation, task commit, push or PR, and never
  replaces discovery's stage choice.
- Read-only discovery proposes the map in chat, records nothing, and may offer user-managed setup,
  confirmed reuse of the current branch, or deferral. It cannot create or switch
  branches, fetch or update, and a stage choice alone does not lift that boundary.

Creating an approved absent branch (parent only, clean state, no worker running):

- Check other worktrees, then create it non-forcing at the reviewed current HEAD and
  verify the resulting branch, base, source and index.
- Never overwrite, implicitly reuse or switch to a name collision, change the
  researched base, or clean up dirty state.
- Confirmed reuse must match the reviewed map and a safe current state. Dirty,
  different-base, other-worktree or failed cases need user-managed preparation or a
  reviewed evidence change.
- Keep partial multi-repository outcomes.

Deferred creation permits discovery and planning but leaves a mandatory pre-dispatch
gate: the Lead creates the exact approved name/base under this procedure before any
worker starts. It never grants workers branch permissions.

## 4. Record

Under the handoff's `Workspace Git readiness` heading, with no other file or task
field, record per repository: inventory/exclusions, freshness choice/result/time,
before/after refs, researched HEAD, proposed/approved branch and base, and the actual
created/reused/deferred outcome. If a refresh or different base changes source after
research, revalidate affected evidence, flows and contracts before readiness,
preserving the original refs and provenance.
