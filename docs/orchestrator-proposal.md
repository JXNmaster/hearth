# Personal AI Chief-of-Staff: A Coordinator for Claude Code, Claude Chat, and Your Reminders

**A design proposal**
Author: prepared for bjackson35773@gmail.com
Date: 2026-06-27
Status: Draft for discussion

---

## 1. What you actually asked for

Stripped to its core, your idea is:

> A single system that knows everything on my plate — pulled from my own reminders (iCloud / Google) and project tracking — decides what I should work on next, routes each piece of work to the right AI model, and lets me actually *do* that work inside Claude Code or Claude chat sessions. Eventually sellable as SaaS where customers bring their own Claude/Gemini/ChatGPT accounts and we only charge for a thin "router" layer.

The mental model you landed on is the sharp one: **a to-do list where every item is a live AI project.** A task isn't a checkbox — it's a handle to a Claude Code workspace, a chat thread, or an autonomous agent run, with state that persists between sittings.

This document proposes what that looks like as a *personal* build first (the thing that works for you), then sketches the SaaS evolution. I've grounded the genuinely uncertain technical decisions — reminder sync, model routing, the agent runtime — in current (mid-2026) facts, with sources at the end.

A working name is used throughout: **Hearth Orchestrator** (or just *the Orchestrator*). Rename freely.

---

## 2. The one hard constraint that shapes everything: reminder sync

Before architecture, the binding reality. You named iCloud *and* Google. They are not symmetric:

| Source | How you reach it programmatically | Verdict |
|---|---|---|
| **Apple Reminders / iCloud** | **No public REST API.** Apple exposes reminders only two ways: **EventKit** (native Swift/Obj-C framework, on-device, macOS/iOS only) and **CalDAV** (reminders are `VTODO` items in CalDAV calendars, reachable with your Apple ID + a 16-char app-specific password). | Two-tier: a tiny **macOS helper** via EventKit for the richest access, or **CalDAV** for a server-side daemon. No clean cloud API. |
| **Google Tasks** | **Official REST API** (`developers.google.com/tasks`), OAuth 2.0, full CRUD on task lists and tasks. Caveat: **no recurring-task support** in the API, and notifications only fire in Google's own apps. | Clean integration. Google is consolidating Keep reminders → Tasks (2025), so Tasks is the future-proof target. |
| **Google Calendar** | Official REST API, supports recurrence (RRULE). | Use for time-blocked events; complements Tasks. |

**Design consequence:** the Orchestrator must treat "reminders" as an abstraction with **pluggable providers**, because the two ecosystems behave nothing alike. Concretely:

- A `ReminderProvider` interface with `list()`, `get()`, `create()`, `update()`, `complete()`.
- **GoogleTasksProvider** — straightforward OAuth + REST.
- **AppleRemindersProvider** with two backends:
  - *CalDAV backend* (server-friendly): connects to `caldav.icloud.com` with an app-specific password, reads/writes `VTODO`. Works headless, in the cloud. This is what makes the "agent runs while you sleep" story possible for Apple users.
  - *EventKit helper* (optional, macOS only): a small menu-bar companion app that mirrors the local Reminders DB for instant, permission-clean read/write and push-style change notifications. Best UX, but only on your Mac.

For *your personal* build, I recommend starting with **Google Tasks (primary) + iCloud CalDAV (secondary)**. It gives you a fully cloud-hosted daemon with no Mac-tethering, and you can add the EventKit helper later if you want the nicer Apple integration.

> ⚠️ Honest caveat to keep front-of-mind for the SaaS dream: "internalize my iCloud reminders" for *arbitrary customers* means asking each of them for an Apple ID app-specific password (fragile, scary to users) or shipping a Mac app (platform-limited). This is a real friction point, not a footnote — see §9.

---

## 3. System overview

```
                         ┌───────────────────────────────────────────────┐
                         │                  YOU                           │
                         │   Web dashboard · CLI · mobile push · chat     │
                         └───────────────┬───────────────────────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │        ORCHESTRATOR CORE        │
                         │  (the brain — always running)   │
                         │                                 │
                         │  • Unified Task Graph (DB)      │
                         │  • Planner / "what's next"      │
                         │  • Model Router (Haiku-class)   │
                         │  • Scheduler & triggers         │
                         │  • Session Manager              │
                         └───┬─────────┬─────────┬─────────┘
                             │         │         │
            ┌────────────────┘         │         └─────────────────┐
            ▼                          ▼                           ▼
  ┌───────────────────┐    ┌────────────────────┐     ┌──────────────────────┐
  │  INTEGRATION LAYER │    │  EXECUTION LAYER    │     │   ROUTING TARGETS     │
  │  (sources of truth)│    │  (where work runs)  │     │  (the models)         │
  │                    │    │                     │     │                       │
  │ • Google Tasks     │    │ • Claude Agent SDK  │     │ • Claude (Opus 4.8 /  │
  │ • iCloud CalDAV    │    │   (headless Claude  │     │   Sonnet 4.6 / Haiku) │
  │ • Google Calendar  │    │    Code sessions)   │     │ • Claude Managed      │
  │ • GitHub           │    │ • Managed Agents    │     │   Agents              │
  │ • Email/Slack(opt) │    │ • Chat threads      │     │ • Gemini / GPT (opt)  │
  └───────────────────┘    └────────────────────┘     └──────────────────────┘
```

Five layers. The **Core** is the only thing that's always on; everything else it calls into.

---

## 4. Component-by-component

### 4.1 The Unified Task Graph (the heart)

Everything reduces to one data model: a **task** that is simultaneously a to-do item *and* a project handle.

```
Task {
  id
  title, description
  status            // inbox | todo | in_progress | blocked | waiting | done
  source            // google_tasks | icloud | manual | derived
  source_id         // external ID for two-way sync
  due, scheduled    // time fields
  priority          // explicit or router-inferred
  project_id        // groups related tasks
  parent_id         // sub-tasks
  depends_on[]      // DAG edges — "can't start X until Y done"

  // The part that makes it more than a to-do list:
  work_kind         // code | research | writing | planning | chore | decision
  preferred_model   // router suggestion, overridable
  session_ref       // → live Claude Code workspace / chat thread / agent run
  artifacts[]       // outputs: PRs, files, docs, links
  progress_log[]    // append-only: what the agent/you did, when
  context_refs[]    // repos, files, URLs, prior sessions
}
```

Two non-obvious design choices that matter:

1. **`depends_on[]` makes it a graph, not a list.** This is what lets the Planner say "work on X" intelligently — it knows what's unblocked, what's waiting on you vs. on an agent, and what's on the critical path. A flat list can't do that.
2. **`session_ref` + `progress_log[]` make a task *resumable*.** You can close your laptop mid-task and reopen the *same* Claude Code session days later with full context — across machines, because the state lives in the Orchestrator, not in a local terminal. This directly answers "allows me to do that work in various Claude sessions."

Sync is **two-way and idempotent**: changes you make in Apple Reminders flow in; tasks the Orchestrator creates flow back out so they appear on your phone. Conflict resolution is last-writer-wins with a per-field `updated_at`, plus a small reconciliation pass on each sync tick.

### 4.2 The Planner ("what should I work on?")

This is the daily-driver feature — the thing that makes it feel like a chief of staff rather than a database.

On a schedule (morning, or on-demand) and on every meaningful change, the Planner produces a **ranked, reasoned agenda**:

- Pulls the current task graph + calendar (free/busy) + due dates + dependencies.
- Buckets work: *"Do now"* (unblocked, high-leverage), *"Waiting on an agent"* (a Claude run is in flight), *"Waiting on someone else"*, *"Scheduled / not yet"*, *"Blocked"*.
- For each "do now" item, attaches: estimated effort, which model it'll route to, and a one-tap **"Start session"** action.
- Writes a short narrative briefing ("Here's your day: the migration PR came back green overnight, 2 review comments to address; the investor memo is unblocked now that you approved the outline; 3 reminders are overdue").

Mechanism: this is itself an LLM call — but a *cheap* one. The Planner doesn't need Opus to rank a to-do list and write three paragraphs. It runs on **Haiku 4.5** (or Sonnet for the weekly deep review). This is the same economic insight behind your "thin router" SaaS idea, applied internally.

### 4.3 The Model Router

Your instinct — "our portion was just a Haiku router" — is exactly right and is a recognized pattern. The 2025–26 landscape (RouteLLM, OpenRouter's Auto Router powered by NotDiamond, Martian, LiteLLM, Portkey) converged on: **a small, fast classifier decides which model handles a request, trading cost against quality on a tunable dial.** Published results: routing can cut cost ~50–85% while preserving ~95% of top-model quality on the right workloads.

The Orchestrator's router is a **layered** decision, cheapest-first:

1. **Rules (sub-millisecond).** Deterministic overrides: `work_kind == code` → Claude Code session on Opus 4.8 / Sonnet 4.6; `work_kind == chore` (sort reminders, draft a reply) → Haiku; explicit user pin always wins.
2. **Embedding/heuristic match (~5ms).** Similarity to past tasks with known-good model outcomes.
3. **Haiku classifier (~50–100ms, one cheap call).** For ambiguous tasks: read the task + context, output `{model, effort, reasoning}`. This is the "Haiku router" — the only part you'd ever charge for in the SaaS version, and it costs fractions of a cent per decision.

Router overhead is negligible against multi-second model responses, so layering is free. The dial (`cost ⟷ quality`, à la OpenRouter's 0–10 parameter) is exposed in settings.

Model targets and when each wins (current pricing per Mtok, input/output):

| Tier | Model | $/Mtok (in/out) | Routed for |
|---|---|---|---|
| Frontier / long-horizon | **Claude Opus 4.8** | $5 / $25 | Hard coding, multi-step agentic work, anything where correctness > cost |
| Balanced | **Claude Sonnet 4.6** | $3 / $15 | Most coding, default agent work, good speed/intelligence |
| Cheap / high-volume | **Claude Haiku 4.5** | $1 / $5 | The router itself, the Planner, chores, classification, summarization |
| Most capable | Claude Fable 5 | $10 / $50 | Reserved for genuinely hard reasoning; opt-in only |
| Cross-provider (opt) | Gemini / GPT | (their pricing) | Only if you want multi-vendor; adds complexity — see below |

> A deliberate recommendation: **start Claude-only.** A genuinely model-agnostic router (Gemini + GPT + Claude) is appealing for the SaaS pitch but multiplies prompt-format quirks, tool-calling dialects, and failure modes. For the personal build, Claude's own tiers (Haiku → Sonnet → Opus → Fable) already give you 90% of the routing value with one SDK and one billing relationship. Add other providers later behind the same `ModelTarget` interface.

> Watch the documented failure mode: **silent quality regression.** Routing a task to a cheaper model can degrade output in ways that surface days later, not on a dashboard. Mitigation: log every routing decision + outcome, let yourself thumbs-down a result to feed the router, and keep a "promote to Opus and retry" button one tap away.

### 4.4 The Execution Layer — where a task becomes a live session

This is the bridge from "to-do item" to "Claude Code/coworker project." Three execution modes, chosen by `work_kind` and how autonomous the task should be:

**(a) Interactive Claude Code session (you in the loop).**
The Orchestrator drives the **Claude Agent SDK** (the renamed Claude Code SDK, GA since 2025; TS `query()` / Python `ClaudeSDKClient`). It can spin up a headless Claude Code session bound to a repo, seed it with the task's context (`context_refs`, prior `progress_log`), and hand you a live thread. `--resume` / `--continue` give you cross-session continuity — this is the mechanism behind "do the work in various Claude sessions" without losing state. The session's transcript and artifacts flow back into the task.

**(b) Autonomous agent run (you out of the loop).**
For well-specified, gradeable work ("update all the deps and get CI green", "draft the weekly status from these notes"), use **Claude Managed Agents** (Anthropic-hosted: you define an Agent once, start a Session per task; it provisions a container, runs the loop, streams events back). Pair it with an **Outcome** (`user.define_outcome` + a rubric) so the agent iterates until "done" is objectively met. The Orchestrator's **Scheduler** can fire these on cron via Managed-Agent **Deployments** ("every weeknight at 8pm, triage my inbox tasks"). Results land as `artifacts[]` and a push notification.

**(c) Chat thread (lightweight thinking).**
For decisions, planning, and writing, a plain Claude chat thread, tracked as the task's `session_ref`, so a "decision" task carries its own conversation.

All three write back to the **same task**: status transitions, a `progress_log` entry per meaningful step, and artifacts. The task is the unit of memory.

> **Memory across sessions** is worth calling out as its own mechanism. Use a **Managed-Agent Memory Store** (or a plain per-project `.md` memory file for Agent-SDK sessions) so the system accumulates "what I learned about this project" across runs — which is exactly what makes day-2 work feel like a continuation rather than a cold start.

### 4.5 The Scheduler & Triggers

The "always-on chief of staff" feeling comes from things happening *without you asking*:

- **Time triggers:** morning briefing, end-of-day rollup, weekly review (cron).
- **Source triggers:** a new iCloud/Google reminder appears → auto-classify, route, and (if low-stakes) auto-start an agent. A GitHub PR comment arrives → reopen the relevant task and optionally dispatch an autofix agent.
- **Dependency triggers:** task Y completes → its dependents become "do now" → you get a nudge.
- **Agent-completion triggers:** an overnight Managed-Agent run finishes → push notification with the result and a one-tap "review / merge / discard."

Mechanically this is a small event bus + a durable job queue. Webhooks where available (GitHub, Managed-Agent session webhooks); polling where not (CalDAV, Google Tasks have no push to third parties — poll on a sane interval).

### 4.6 The Interfaces

- **Web dashboard** (primary): the agenda view, the task graph, live session windows, the routing/quality controls. Your existing Next.js stack here is a fine starting point.
- **CLI:** `orch next`, `orch start <task>`, `orch sync` — for when you live in the terminal.
- **Mobile:** push notifications + a thin view to approve/redirect agent work from your phone. (No need to build a full native app early; a PWA + web push covers it.)
- **Conversational:** "what should I do next?" / "start the migration" as a chat surface over the Planner.

---

## 5. The end-to-end flow (a day in the life)

1. **8:00am** — Scheduler fires the Planner. It syncs Google Tasks + iCloud CalDAV + Calendar, rebuilds the task graph, and (Haiku) writes your briefing. Push: *"3 things ready, 1 agent finished overnight."*
2. You open the dashboard. The overnight **Managed-Agent** run (dependency bump) is green; 2 review comments remain. One tap → **Claude Code session** opens on that repo, pre-loaded with the diff and the comments.
3. You finish, the PR updates, the task flips to `waiting` (CI). A reminder you'd dictated into your iPhone last night ("draft Q3 board update") has synced in; the **Router** tags it `work_kind: writing → Sonnet`, and offers a chat thread seeded with last quarter's update.
4. **Noon** — CI passes (source trigger). The two downstream tasks that depended on the merge unblock; the Planner re-ranks and nudges you.
5. **8:00pm** — End-of-day rollup writes progress back to your reminders (so your phone shows the truth), and queues tomorrow's autonomous runs.

Nothing here required you to remember what to do, choose a model, or rebuild context. That's the product.

---

## 6. Build plan (personal first)

**Phase 0 — Spike (a weekend).** Google Tasks OAuth + read tasks; one Haiku call that ranks them and writes a briefing; print to terminal. Proves the loop end-to-end with ~no infrastructure.

**Phase 1 — Core + one execution mode (1–2 weeks).** Task Graph in a real DB (Postgres/SQLite + the schema in §4.1). Two-way Google Tasks sync. The Planner as a scheduled job. Execution = interactive Claude Code via the Agent SDK with resume. Minimal web dashboard (reuse the Next.js app).

**Phase 2 — Autonomy + Apple (2–3 weeks).** iCloud CalDAV provider. Managed-Agent autonomous runs + Outcomes + a nightly Deployment. Push notifications. The layered Router (rules + Haiku classifier) with a quality-feedback button.

**Phase 3 — Polish.** Memory stores, dependency-aware ranking, CLI, mobile PWA, the cost/quality dial, routing-decision analytics.

Each phase is independently useful — Phase 0 alone already tells you what to work on every morning.

---

## 7. Tech stack recommendation

- **Core service:** TypeScript (matches your Next.js repo) or Python (richer Anthropic SDK examples). Either is fine; pick what you'll move fastest in. A single long-running service + a job queue (e.g. BullMQ/Redis or a managed queue).
- **DB:** Postgres (the task graph + logs). You already have Drizzle in the repo.
- **AI runtime:** Anthropic SDK for direct model calls (Planner, Router); **Claude Agent SDK** for Claude Code sessions; **Managed Agents** (`client.beta.agents/sessions/environments`) for autonomous + scheduled runs. Define agents as version-controlled YAML via the `ant` CLI; drive sessions from app code.
- **Integrations:** `googleapis` (Tasks + Calendar); a CalDAV client for iCloud; GitHub via its API/MCP.
- **Hosting:** any always-on host (Fly/Render/Railway/a VPS). The point is "always running," so serverless-only is a poor fit for the Core.

---

## 8. What's genuinely hard (so you go in clear-eyed)

1. **iCloud at scale.** Fine for you (one app-specific password). A real friction for SaaS — see §9.
2. **Silent routing regressions.** Cheaper-model degradation is invisible until it bites. The feedback loop in §4.3 is not optional.
3. **Two-way sync conflicts.** Idempotency + per-field timestamps handle the common cases; expect to iterate on edge cases (a task edited on three surfaces at once).
4. **Autonomous-agent trust.** Start agents in "propose, don't apply" mode for anything irreversible; graduate specific task types to full autonomy as you build confidence.
5. **Scope discipline.** This design can balloon. Phase 0 → 1 is the whole product in miniature; resist building Phase 3 features before Phase 1 earns its keep.

---

## 9. The SaaS evolution (your "eventually")

Your positioning instinct is sound and increasingly validated by the market (Clave, Clideck, Agent Teams, etc. all orbit "manage many AI sessions" — but none combine *your reminders + a planner + cross-model routing + resumable projects* the way this does). Key decisions if you go there:

- **BYO-accounts, thin-router pricing.** Customers connect their own Claude/Gemini/ChatGPT keys (or OAuth); you charge a flat subscription for the Orchestrator + the Haiku router. This keeps *your* COGS tiny (a Haiku classification is a fraction of a cent) and sidesteps reselling model capacity. This is the right call and matches "keep cost as low as possible."
- **The iCloud problem is the moat-or-millstone.** Decide early: lead with **Google** (clean API, huge base) and treat Apple as a "power-user, bring-a-Mac-helper or app-specific-password" tier. Don't let the iCloud dream block shipping.
- **Multi-model becomes a real feature** here (vs. Claude-only personally), because "use *your existing* Gemini/GPT accounts" is the pitch. Build it behind the `ModelTarget` interface from day one so it's a config change, not a rewrite.
- **Trust & data.** You're touching customers' tasks, calendars, repos, and model keys. Security posture (encryption at rest, scoped tokens, never logging secrets, clear data retention) is a feature, not overhead.

A reasonable SaaS sequencing: personal build → 2 (your own) → small private beta (Google-only) → add routing dial + multi-model → add Apple tier. Sell the *outcome* ("an AI chief of staff that runs your day across the models you already pay for"), not the plumbing.

---

## 10. Recommendation

Build the **personal** Orchestrator, Claude-only, Google-first, in the phases above. It will be genuinely useful by the end of Phase 1 and will *teach you* — through real routing logs and real daily use — exactly which parts deserve to become a product. The SaaS is a fork of a tool you're already living in, which is the best possible starting point.

The single most important architectural commitment: **the Task is the unit of everything** — to-do item, project, session handle, and memory, all one object. Get that model right (§4.1) and the rest is integration work.

---

## Appendix: sources

Reminder/calendar integration:
- [EventKit — Apple Developer](https://developer.apple.com/documentation/eventkit) and [Creating events and reminders](https://developer.apple.com/documentation/eventkit/creating-events-and-reminders)
- [How to integrate iCloud Calendar API (CalDAV) — OneCal](https://www.onecal.io/blog/how-to-integrate-icloud-calendar-api-into-your-app)
- [mcp-server-apple-events (EventKit MCP)](https://github.com/FradSer/mcp-server-apple-events)
- [Google Tasks API — Google for Developers](https://developers.google.com/tasks)
- [Google Keep reminders now saved to Tasks (2025) — Workspace Updates](https://workspaceupdates.googleblog.com/2025/10/google-keep-reminders-now-saved-to-tasks.html)

Model routing:
- [RouteLLM — lm-sys (GitHub)](https://github.com/lm-sys/routellm)
- [OpenRouter Auto Router (powered by NotDiamond)](https://openrouter.ai/docs/guides/routing/routers/auto-router)
- [RouterArena: comparing LLM routers (arXiv)](https://arxiv.org/html/2510.00202v1)
- [awesome-ai-model-routing — Not-Diamond](https://github.com/Not-Diamond/awesome-ai-model-routing)
- [LLM Model Routing in 2026 — DigitalApplied](https://www.digitalapplied.com/blog/llm-model-routing-2026-cost-quality-optimization-engineering-guide)

Agent runtime & orchestration:
- [Claude Agent SDK overview — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/overview)
- [Use the Claude Agent SDK with your Claude plan — Help Center](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- [Multi-agent orchestrators (landscape) — awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)

Model IDs/pricing referenced from the current Anthropic model catalog (Opus 4.8 $5/$25, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5, Fable 5 $10/$50 per Mtok), 2026-06.
