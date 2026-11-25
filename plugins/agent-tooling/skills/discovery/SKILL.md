---
name: discovery
description: "Use when about to recommend an approach, estimate or rule out an option, or start a change beyond a trivial edit that no approved plan covers, and when planning finds a gap. Establishes requirements, current behavior, runtime cost and options; changes no code."
disable-model-invocation: true
---

# Discovery

Discovery establishes what is needed, how the current code supports it and which
approach to take, at the depth the impact warrants. It runs whether or not a plan
follows; a plan follows when the user asks for a plan or for the discovery
handoff. The parent owns requirements, evidence reconciliation and the findings.
Discovery changes no code and produces no executable plan, task ownership lists or
plan todos.

## Guidance map

| When | Read |
|---|---|
| At start, for the domain map; when a plan follows, also the artifact layout | rule `plan-workflow` |
| Before scoped searches or writes | rule `read-before-write` |
| Before proposing scope changes | rule `scope-creep-gate` |
| Before dispatching a discovery worker | `{CURSOR}/agents/discovery-agent.md` |
| A plan follows: before deep research or worker dispatch (steps 1–2), and at the review (step 3) | [workspace-git-readiness.md](workspace-git-readiness.md) |
| A plan follows: when discovery is complete, for the artifacts, user flows and review | [plan-handoff.md](plan-handoff.md) |
| The user chooses planning at the review | skill `create-plan` |

Resolve path tokens before tool calls and preserve them in portable content.

## Discover

1. Establish the requested outcome, constraints, existing authorization and affected
   roles and repositories. Reuse context already supplied or researched and identify
   the consequential questions still open. When the request is product work that
   names no ticket and an issue-tracker connection is available, search it for an
   issue that already covers the work; record its key, or that none was found. When a
   plan follows, complete steps 1–2 of
   [workspace-git-readiness.md](workspace-git-readiness.md) before deep research or
   worker dispatch; otherwise record the repository refs you research.
2. Start with guidance descriptions. Select guidance through the domain maps, read
   selected procedures, and follow their routers only to relevant references. Follow
   useful source links into representative implementations, callers, contracts,
   wiring and tests, to the depth the impact warrants, not an exhaustive audit.
   Within each affected role cover at least: the schema source (`{SQL}`, or
   migrations in `{DOTNET}`): storage, nullability, auditing and deployment impact;
   `{DOTNET}`: contracts, tenant scoping, authorization, validation, consumers and
   caching; `{CLIENT}`: entry point, route guards, state, validation and user
   feedback. Skip untouched roles.
3. When the change adds work, data volume or a library call at runtime, cover its
   cost: time and memory at the largest supported size, and whether the work runs in
   the request or in the background. Find how the platform already handles that cost
   or the same workflow, such as an action on an existing queue, paging or streaming,
   and read each mechanism, or record that a search found none. Check what the
   installed libraries offer for that cost in the version the code references,
   from the package's own API docs or metadata rather than memory, even where nothing
   uses it yet. When the work mirrors another product or feature,
   read how that implementation delivers the result (in the request or in the
   background, limits, notification), not only what it produces.
4. Confirm historical explanations and old research against live code. Keep
   observations, the user's requirements, inferred explanations and open questions
   distinct. For consequential findings keep the exact file/symbol, commit, command
   or source URL, the repository/ref, and why it matters.
5. When more than one approach is viable or the change adds a cost, weigh the
   options. Give each one's trade-offs, whether the platform already uses it, and an
   effort read from the code it would extend; label an estimate made without that
   read as a guess. Present an option the platform doesn't use yet as a new pattern
   rather than dropping it. Rule an option out only with evidence, including one
   dismissed earlier in the conversation.
6. Teach back current versus desired behavior, behavior to preserve, meaningful
   examples, the recommended approach, the options weighed and consequential
   unknowns. Refine requirements and research when evidence exposes another consumer
   or constraint. Ask the user about unresolved product/design choices; never invent
   answers or re-ask settled decisions.

## Complete discovery

Discovery is complete when requirements and preservation constraints are settled,
current behavior and a feasible approach are supported by evidence, affected layers
and important consumers are identified, and no known open question changes scope,
feasibility, authorization, public/data contracts or user-visible behavior. Private
implementation details may stay open. Identify missing runtime capabilities; source
research does not prove runtime behavior or require running every future
verification command now.

A remaining consequential question: keep useful findings, identify the blocked
portion and investigate authoritative sources within permissions before asking the
user. Do not label the findings or dependent work ready.

When no plan follows, the teach-back is the output: findings go in the reply and
discovery writes no planning artifacts. When a plan follows,
[plan-handoff.md](plan-handoff.md) owns the artifacts, user flows and review.

## Discovery delegation

Delegate under the Delegation section of rule `plan-workflow`:
only a bounded question where isolation or independent source tracing helps. Dispatch
the discovery agent's resolved path as standing instructions with the inputs its
dispatch paragraph lists. Workers run on the parent's model unless the user
names another; set no other per-task model. Candidate plan design belongs to the
planning skill's helper, not discovery workers.

Reconcile every field of the agent's return contract; its `complete` answers only its
question, and partial or blocked results stay limitations. Check conflicting
findings against sources, combine the evidence with the user's intent, and decide
whether more focused investigation is needed. Never broaden
a worker's boundaries to get around a limitation. The parent writes durable notes.
Include its tooling recommendations in your findings.
