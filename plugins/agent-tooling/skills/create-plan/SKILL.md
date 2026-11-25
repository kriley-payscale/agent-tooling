---
name: create-plan
description: Use when turning discovery context into a plan (the plan file and task artifacts), or revising a plan's artifacts while no Build is running. Consequential gaps route to discovery; not Build or discovery-only requests.
disable-model-invocation: true
---

# Create a plan

The parent converts discovery context into the executable plan: design, Decisions,
task breakdown and readiness. Planning starts no implementation.

## Guidance map

| When | Read |
|---|---|
| At start: domain map, artifact layout | rule `plan-workflow` |
| Writing or revising task artifacts | rule `plan-task-schema` |
| Before scoped searches or writes | rule `read-before-write` |
| Before planning changes | rule `scope-creep-gate` |
| Context is insufficient or contradicted, for that gap only | skill `discovery` |
| Workspace Git readiness is missing | `{CURSOR}/skills/discovery/workspace-git-readiness.md` |
| Selecting domain guidance, for each chosen domain agent's guidance map; again at step 4 | the selected `{CURSOR}/agents/<Agent>.md` files |
| A task changes behavior that has tests | skill `unit-test-guidance` |
| The plan proposes a new or converted provider fixture | `{CURSOR}/skills/unit-test-guidance/dotnet-domain-repository-fixtures.md` |
| Delegating a candidate design | `{CURSOR}/agents/planning-agent.md` |
| Step 4 readiness | [readiness-checks.md](readiness-checks.md), `{CURSOR}/skills/implement-plan/implementation-contract.md` |

Resolve path tokens before tool calls and preserve them in portable content.

## 1. Consume discovery context

Enter planning only after the user chose it at discovery's review checkpoint (run
that checkpoint if the choice is missing), or directly when the user supplied
sufficient context. Reuse explicit choices already made for this run and honor an
explicit read-only planning discussion without writes.

Use the agreed requirements, preservation constraints, approach, code references,
affected repositories/consumers/wiring, selected guidance, runtime prerequisites,
decisions and limitations from the conversation or the discovery handoff, under the
run root `{ARTIFACTS}/planning/<plan-slug>/`. If sufficient context came from the
conversation, materialize it in `discovery/discovery.md` and `discovery/user-flows.md`
with explicit provenance before task emission; no new research is needed. Carry the
Workspace Git readiness map into Decisions. Do not load every note or repeat settled
research.

If the context does not support design without guessing about scope, feasibility,
authorization, public/data contracts or user-visible behavior, resolve only that
question through discovery and return. Do not emit a ready plan while it remains.

## 2. Design the implementation

Select existing patterns, assign responsibilities and settle boundary contracts.
Express the scaffold in the plan: reuse choices, data flow, important signatures and
shapes, and behavior examples. Settle public contracts, data shapes, shared names,
user-visible behavior and ownership before dispatch; leave private details to the
implementer. Evidence that contradicts a requirement or the approach returns to
bounded discovery.

Select guidance through the domain maps and read selected procedures and their
applicable references before writing the plan, as design constraints. Carry the selected
paths into task Read first.

Choose the smallest verification that covers the changed behavior.

- For each proposed automated test, state the regression it catches, the existing
  fixture/helper it extends, and why current checks are insufficient, in the existing
  task detail and Verification fields. Acceptance coverage does not need a new test
  per flow, property or layer.
- For behavior a task changes, list its existing tests and mark each keep,
  strengthen, replace or delete under skill `unit-test-guidance`. Tests to change
  or delete go in that task's `Owns`.
- Distinguish retained automated tests from local runtime verification; prefer
  focused regressions in established fixtures and existing runtime procedures for
  deployment or provider behavior.
- A new or converted provider fixture meets the bar in
  `{CURSOR}/skills/unit-test-guidance/dotnet-domain-repository-fixtures.md`.
- Required acceptance checks and fixture safety/cleanup stay regardless of evidence
  form.

### Optional bounded planning delegation

Once context is sufficient, the parent may delegate one cohesive area's candidate
design or task breakdown to the planning agent, under the shared rule's Delegation
principles. Supply the inputs its dispatch paragraph lists, linking authoritative
artifacts with relevant excerpts rather than replaying the chat. It is not an
implementation-task Agent and adds no scheduling policy.

Reconcile every field of its return contract without repeating every search. Keep unsettled proposed
contracts and dependent sections provisional until centrally resolved; route missing
evidence to discovery and product choices to the user. Never vote among conflicting
reports or silently adapt a shared contract. The parent keeps global Decisions,
shared names/contracts, cross-domain reconciliation, ownership, dependencies,
acceptance coverage, emission and readiness. List its tooling-friction in
your planning reply, including from partial/blocked work.

## 3. Break the plan into tasks

Create `NN-task-<plan-slug>.md` files under `tasks/` in plan order using the
shared Task schema. Keep substantive task instructions there once and reference them
from the plan. Distinguish true start prerequisites from completion gates, and
settle contracts so work in different repositories can run concurrently.
Same-repository tasks run one at a time, so split them for clear ownership and
verification, not parallelism. A shared barrel is updated once by its owner.

Trace callers, fixtures, tests and registration surfaces so every required edit has
one owner. Keep coupled work within one domain together until its contract is
settled; unsettled cross-domain contracts block readiness. Identify runtime
prerequisites and measurements the Lead must capture before the earliest affecting
dispatch. Never delegate product or cross-layer decisions to an implementer.

The final numbered artifact is the schema rule's Final verification task. For plans
that add or change UI behavior, add its `Browser verification: verification-agent`
section covering every UF ID with a UI step; evidence goes under `{ARTIFACTS}/planning/<plan-slug>/verification/<attempt>/<UF-ID>/`.

## 4. Check plan readiness

Read the implementation contract and each selected domain agent file, then run every
applicable section of `readiness-checks.md`. `generalPurpose` uses the contract
directly; orchestrator is the parent's final verification. Neither has an agent file.

## 5. Write the plan

Reconcile changed discovery inputs or concurrent writers before claiming readiness.
Write `<plan-slug>.plan.md` at the run root as "Planning artifact layout" in rule
`plan-workflow` defines it, with the todo content from rule `plan-task-schema`.
Display/dataflow diagrams distinguish their relationships from dispatch
prerequisites. Present the plan with its Decisions and Escalation boundary, and list
the tooling friction you and the planning agent hit so it is visible in the
conversation.

Stop at the requested planning boundary. Dispatch no workers, modify no application
files, and create no stubs, projects, folders or scripts to demonstrate the design;
discovery/task artifacts are planning outputs, not scaffolding. Before Build, revise
the plan as needed and tell the user what changed; Build starts only when the user
asks for it.
