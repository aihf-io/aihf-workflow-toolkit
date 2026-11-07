# Single-Page-App (SPA) Patterns

AIHF gives you **two distinct ways** to build a single-page experience on top of workflow steps.
They solve different problems — pick by *what the page is*:

| | **Pattern 1 — Landing-page SPA** | **Pattern 2 — Workflow-UI SPA** |
|---|---|---|
| The page is… | a tenant **custom landing page** (app-portal root) | the UI of **one workflow step** |
| Each action calls… | a **separate `workflow-entry` step** (one per atomic function) | a **`route_match` sub-route of the same step** |
| URL per action | `/api/v1/app/{wf}/l/{entry-step}/{route}` | `/api/v1/app/{wf}/l/{step}/{route}` |
| Task model | one task **parked** per entry call (independent operations) | one task threaded through the step (shared `AIHF_TASK_ID`) |
| Use when | a dashboard/hub of many **independent** operations (CRUD over different entities) | a single **rich step** needs several server actions (load + validate + save) |
| Foundation doc | [Custom Landing Pages](./CUSTOM_LANDING_PAGES.md) | [Bundle.yaml → API Configuration](./BUNDLE_YAML.md) |

Both patterns share the same client rules (body fragments, scoped CSS, IIFE JS, version aliases) — see
[Shared rules](#shared-rules--gotchas) at the end.

---

## Pattern 1 — Custom landing page as a SPA (atomic `workflow-entry` steps)

Your **custom landing page** (a single `renderAIHFCustomerLanding(...)` module — see
[Custom Landing Pages](./CUSTOM_LANDING_PAGES.md)) is the SPA shell. Each atomic operation it offers —
"list events", "add event", "delete event" — is modelled as its **own `workflow-entry` step** in a
workflow, and **all entries share one `workflow-terminator`** so the workflow graph is valid.

Because entry steps are independent, the page can call any of them directly:

```
POST /api/v1/app/kidweeks-calendar/l/add-event/run
POST /api/v1/app/kidweeks-calendar/l/list-events/run
```

> **Platform requirement (delivered 2026-11-07):** for a **non-magic** (logged-in) call, the gateway
> honors the URL step as the task's entry **only when that step is a `workflow-entry`** — it creates/
> resolves the task *at that step* and runs *that step's* handler. (Before this, every non-magic call ran
> `entryPoints[0]`'s handler regardless of the URL.) Non-entry steps still default to `entryPoints[0]`, so
> the change is backward-compatible.

### workflow.yaml — one entry step per atomic function + a shared terminator

```yaml
steps:
  # Each atomic function is its OWN workflow-entry.
  - id: "list-events"
    type: "workflow-entry"
    permissions: { required_level: 1 }     # logged-in customer
    conditions:
      - type: "options"                     # only transitions on an explicit action…
        variable: "action"
        options:
          - option: "done"
            target: "complete"              # …otherwise the handler returns data and the task PARKS here

  - id: "add-event"
    type: "workflow-entry"
    permissions: { required_level: 1 }
    conditions:
      - type: "options"
        variable: "action"
        options:
          - option: "done"
            target: "complete"

  # Shared terminator every entry can route to.
  - id: "complete"
    type: "workflow-terminator"
    permissions: { required_level: 1 }
```

The key move: the step's conditions key off an `action` variable, so a **plain data return** (no
`action`) matches **no** condition → **no transition** → the platform returns your handler's response
**as-is** and the task stays parked at that entry. Return `action: "done"` only when you actually want to
finish the task (routes to the shared terminator). See [Workflow.yaml → Conditions](./WORKFLOW_YAML.md).

### bundle.yaml — each entry step gets its handler

```yaml
steps:
  - id: "list-events"
    route: "/list-events"
    domain: "app"
    handlers:
      api:
        - route_match: "/run"
          file: "api/list-events.ts"
          input: []
          output: [ { name: "events", type: "string" } ]

  - id: "add-event"
    route: "/add-event"
    domain: "app"
    handlers:
      api:
        - route_match: "/run"
          file: "api/add-event.ts"
          input:  [ { name: "title", type: "string" }, { name: "date", type: "string" } ]
          output: [ { name: "eventId", type: "string" } ]
```

### api/list-events.ts — a handler that returns raw data (task parks)

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform, workflowName: string, workflowVersion: number,
  workflowStepId: string, taskId: string, sanitisedInput: string
): Promise<Response | null> {
  const rows = await sdk.database.query(workflowName, 'SELECT id, title, date FROM events ORDER BY date');
  // Plain data, no `action` → no transition → returned as-is; the task stays parked at `list-events`.
  return new Response(JSON.stringify({ events: rows }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### The landing page JS — call each entry step

```javascript
// Inside your renderAIHFCustomerLanding(...) HTML fragment, in an IIFE:
async function callStep(entryStep, route, body) {
  const res = await fetch('/api/v1/app/kidweeks-calendar/l/' + entryStep + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body || {})
  });
  return res.json();
}

const { events } = await callStep('list-events', '/run', {});
await callStep('add-event', '/run', { title: 'Soccer', date: '2026-05-01' });
```

- `l` = latest enabled version (also `n1`/`n2` — see [Version aliases](#version-aliases)). Don't hard-pin.
- Each call targets its **own entry step**, so operations are independent — no shared "current step".
- Omit `taskId` to run against a fresh parked task; pass a `taskId` only if you want repeated calls to
  reuse the same parked task.

---

## Pattern 2 — Workflow-UI step as a SPA (multiple `route_match` sub-routes)

Here the SPA is the **UI of a single workflow step** (its `ui.dynamic` renderer). That one page calls
several **API `route_match` routes defined on the same step** — e.g. load data, validate, save — without
leaving the step. This is the right shape when a step in a workflow journey is itself rich and
interactive.

### bundle.yaml — one step, multiple API routes

```yaml
steps:
  - id: "editor"
    route: "/editor"
    domain: "app"
    ui:
      dynamic: "ui/editor.ts"       # renders the SPA page (HTML fragment)
    handlers:
      api:
        - route_match: "/fetch"     # GET-style load
          file: "api/fetch.ts"
          input: []
          output: [ { name: "doc", type: "string" } ]
        - route_match: "/save"      # persist, stay on the step (data-only)
          file: "api/save.ts"
          input:  [ { name: "body", type: "string" } ]
          output: [ { name: "success", type: "string" } ]
        - route_match: "/navigate"  # transition to the next step when done
          file: "api/navigate.ts"
          input:  [ { name: "action", type: "string" } ]
          output: [ { name: "action", type: "string" } ]
```

### ui/editor.ts — the SPA page calls its own sub-routes

```javascript
// The platform injects window.AIHF_TASK_ID into the page. ALWAYS include it in POST bodies so every
// call routes to THIS task/step (omitting it spawns a new task at the entry step → route mismatches).
(function () {
  const taskId = window.AIHF_TASK_ID;
  const base = '/api/v1/app/my-workflow/l/editor';

  async function call(route, body) {
    const res = await fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...body, taskId })
    });
    return res.json();
  }

  // Load → render → save (stays on step) → navigate (transition)
  const { doc } = await call('/fetch', {});
  // … on save button …
  await call('/save', { body: editorValue });                 // data-only: no transition
  // … on finish button: save returns data, then trigger the transition, then reload …
  await call('/navigate', { action: 'next' });
  window.location.reload();
})();
```

- **Save-then-navigate:** save handlers return data only (`{ success: true }`) and do **not** transition;
  a separate `/navigate` route returns an `action` that a `workflow.yaml` condition routes on. Don't put
  `action` in save responses — it causes premature transitions.
- **Don't cross-step fetch.** If several steps need the same helper (e.g. `/fetch`), add it as a
  `route_match` on **each** step rather than calling another step's route (which breaks when `taskId`
  routes to the wrong step).

See [Bundle.yaml → API Configuration](./BUNDLE_YAML.md) for the full `route_match` schema and the SSE
variant.

---

## Shared rules & gotchas

These apply to **both** patterns:

- **Return body fragments, not full HTML documents.** The platform extracts `<body>` content via regex,
  so a `<head><style>` gets stripped — put `<style>` inline inside the fragment.
- **Scope your CSS** with a unique prefix (e.g. `.kw-cal-…`) to avoid clashing with the portal shell, and
  **wrap client JS in an IIFE** `(function(){ … })()` to avoid polluting globals.
- **Data-only vs transition** is the core lever in both patterns: a handler that returns plain data and
  matches **no** forward condition is returned **as-is** (task parks); a handler whose output matches a
  condition **transitions**. Use `options` conditions keyed on an `action` to make the choice explicit.
- <a id="version-aliases"></a>**Use version aliases in URLs, not pinned numbers.** `l` = latest enabled,
  `n1` = previous, `n2` = two back. The app-router 307-redirects the alias to the concrete version at
  request time, so your SPA keeps working across deploys (`/api/v1/app/{wf}/l/{step}/{route}`).
- **Scanning & limits still apply** — all input is security-scanned and handlers run under the tenant's
  level/permissions just like any workflow step.

## Related documentation

- [Custom Landing Pages](./CUSTOM_LANDING_PAGES.md) — the landing-module contract Pattern 1 builds on
- [Bundle.yaml Reference](./BUNDLE_YAML.md) — `route_match`, `ui.dynamic`, SSE (Pattern 2 foundation)
- [Workflow.yaml Reference](./WORKFLOW_YAML.md) — step types (`workflow-entry`/`workflow-terminator`),
  conditions, transitions
- [Workflow Concepts](./WORKFLOW_CONCEPTS.md) — how steps, tasks, and domains fit together
- [SDK Reference](./SDK_REFERENCE.md) — `sdk.database`, `sdk.auth.createMagicLink`, etc.
