---
name: create-discovery-prompt
description: "Use when turning a feature idea, ticket or vertical-slice brief into a ready-to-paste prompt for a later discovery run. Prompt preparation only; does not start discovery, planning or Build."
disable-model-invocation: true
---

# Create a discovery prompt

Produce one short brief that a fresh chat hands to skill `discovery`. The brief
carries only what discovery cannot get on its own: what the user said, decisions
already made, and pointers to sources. Discovery researches code, identifies layers,
refines acceptance and asks product questions; do not do that work here. Return the
brief in chat. Do not research application code, create artifacts, or start discovery.

## Steps

1. **Gather inputs.** Use the conversation. Fetch any ticket or wiki page the user
   referenced, when an issue-tracker or wiki connection (such as Atlassian MCP) is
   available, and read files they pointed to. That is reading input, not research.

2. **Ask only if the goal is unclear.** Ask one question, wait for the reply, then
   write the brief.

3. **Fill the template.** Omit any line with nothing to put on it. Link sources
   instead of restating them; carry only what the user added beyond them. Tentative
   ideas ("maybe it should…") go under Questions, not Acceptance. Keep
   `{CURSOR}`, `{WORKSPACE}` and role tokens. Never include machine-absolute paths,
   credentials or cookies.

4. **Self-check before returning:**
   - Every line traces to the user or a fetched source. No acceptance, layer, schema,
     endpoint, permission or question was added to fill the template.
   - Nothing restates what a listed source already says.

## Template

```text
Discovery request: <feature>. Read {CURSOR}/skills/discovery/SKILL.md and run discovery toward a plan, stopping at the stage choice.

Goal: <outcome, for whom>
Sources: <ticket, page or file: what it shows>
Acceptance: <criteria the user stated beyond the sources>
Decisions: <choice: who made it>
Preserve / out of scope:
Reported, unverified: <claims about current behavior>
Questions: <raised by the user, or contradictions between sources>
Boundary: <read-only, or stop after discovery>
```

## Examples

Input: "Managers should be able to export their team roster to CSV."

```text
Discovery request: Team roster CSV export. Read {CURSOR}/skills/discovery/SKILL.md and run discovery toward a plan, stopping at the stage choice.

Goal: Managers can export their team roster to CSV.
```

Input: ticket ABC-123 (reminder emails for overdue reviews), plus conversation. The
user settled on a weekly cadence, wants the manual "Send reminder" button kept,
suspects reminders currently reach deactivated users, and asked whether managers
should be copied.

```text
Discovery request: Automatic overdue-review reminders. Read {CURSOR}/skills/discovery/SKILL.md and run discovery toward a plan, stopping at the stage choice.

Goal: Reviewers with overdue reviews get automatic reminder emails.
Sources: ABC-123: requirements and acceptance criteria.
Decisions: Weekly cadence, not daily (user).
Preserve / out of scope: Manual "Send reminder" button keeps working.
Reported, unverified: Reminders may currently reach deactivated users.
Questions: Should managers be copied on reminders?
```
