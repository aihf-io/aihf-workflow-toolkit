# AI Workers Guide

Build automated workflows using the AIHF.io AI Worker Service.

## The AIHF Equality Model

**AI and human workers are treated identically in AIHF.** Both are entities (`AIHFEntity`) with a `profile.type` of either `'ai'` or `'human'`. Group membership determines which steps a worker can access — not their type.

This means:
- A human can process an "AI task" if they have the right group membership
- An AI can process a "human review task" if configured to do so
- The same workflow step can be processed by either AI or human workers
- Developers use judgment on which steps each is cognitively suited for

The **AI Worker Service** runs on a cron schedule and processes tasks in parallel, so AI workers naturally field work domain tasks faster than humans can manually. But it's the same task queue — AI workers are simply faster.

```
┌─────────────────────────────────────────────────────────────┐
│                    AIHF Worker Equality Model                │
│                                                              │
│     ┌─────────────────────────────────────────────────┐     │
│     │              Work Domain Tasks                   │     │
│     │         (same queue for all workers)            │     │
│     └──────────────────────┬──────────────────────────┘     │
│                            │                                 │
│            ┌───────────────┼───────────────┐                │
│            ▼               ▼               ▼                │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│     │ AI Worker│    │ AI Worker│    │  Human   │           │
│     │ (fast,   │    │ (fast,   │    │  Worker  │           │
│     │ parallel)│    │ parallel)│    │ (manual) │           │
│     └──────────┘    └──────────┘    └──────────┘           │
│                                                              │
│     AI workers process tasks faster due to:                 │
│     • Cron-scheduled polling (every 5 minutes)              │
│     • Parallel execution (up to 5 tasks per cycle)          │
│     • Instant availability                                  │
└─────────────────────────────────────────────────────────────┘
```

## Overview

The AIHF.io platform separates workflows into two domains:

| Domain | URL Pattern | Purpose |
|--------|-------------|---------|
| `app` | `workflow.tenant.aihf.app` | Customer-facing (users likely are human, but could be AI) |
| `work` | `workflow.tenant.aihf.work` | Internal processing (workers can be AI or human) |

The **AI Worker Service** is a Cloudflare Worker that runs **two independent scheduled workflows**:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| **CampaignInitiatorWorkflow** | 2x daily (6 AM & 6 PM UTC) | Creates tasks for `worker-initiate` steps |
| **AIWorkerWorkflow** | Every 5 minutes | Polls for and executes queued tasks |

These are intentionally separate — campaign creation (infrequent) and task execution (frequent) need different schedules.

## Two Workflow Initiation Models

AIHF supports two ways to start a workflow:

### Customer-Initiated (`workflow-entry`)

A customer interacts with an app domain step, which creates a task that flows through work domain steps. The customer starts the workflow.

```
Customer → [app: upload] → [work: process] → [work: review] → [app: results]
                ↑                                                     ↑
          workflow-entry                                    workflow-terminator
```

### Worker-Initiated (`worker-initiate`)

The AI Worker Service's **Campaign Initiator** creates tasks that begin at `worker-initiate` steps. No customer triggers these — they run on a schedule. Use this for background automation, scheduled maintenance, data syncing, and recurring jobs.

```
Campaign Initiator → [work: sync-data] → [work: validate] → [work: notify]
                          ↑
                    worker-initiate
```

A single workflow can have **multiple** `worker-initiate` steps — each gets its own independent task:

```yaml
# workflow.yaml
spec:
  steps:
    - id: "pull-whatsapp"
      name: "WhatsApp Sync"
      type: 'worker-initiate'        # Task 1 created by campaign
      permissions:
        required_groups: ["ai-workers"]
      conditions:
        - type: "default"
          target_true: "process-messages"

    - id: "pull-email"
      name: "Email Sync"
      type: 'worker-initiate'        # Task 2 created by campaign (separate)
      permissions:
        required_groups: ["ai-workers"]
      conditions:
        - type: "default"
          target_true: "process-messages"

    - id: "process-messages"
      name: "Process Messages"
      type: 'workflow-step'
      conditions:
        - type: "default"
          target_true: "done"

    - id: "done"
      type: 'workflow-terminator'
```

## The Campaign Initiator

The Campaign Initiator runs 2x daily and handles task creation for worker-initiated workflows:

```
┌─────────────────────────────────────────────────────────────┐
│ Campaign Initiator (6 AM & 6 PM UTC)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. Authenticate all tenants                                 │
│ 2. GET /api/v1/work/workflows/initiatable                   │
│    → Returns workflows with worker-initiate steps           │
│ 3. For EACH worker-initiate step:                           │
│    ├─ Check: task already pending/in_progress? → SKIP       │
│    ├─ GET /api/v1/work/campaigns/targets                    │
│    │  → Returns entities with group access                  │
│    ├─ AI entity in targets? → YES:                          │
│    │  POST /api/v1/work/campaigns/create                    │
│    │  → Creates task starting at that step                  │
│    └─ AI entity NOT in targets? → SKIP                      │
│ 4. Report: campaigns created, skipped, errors               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Deduplication

The Campaign Initiator checks for existing `pending` or `in_progress` tasks before creating new ones. If a task already exists for a given `workflowName:stepId`, creation is skipped. This means:

- A task that completed since the last campaign run gets recreated (next execution cycle)
- A task that's still deferred (waiting for its timing window) is **not** duplicated
- Running the Campaign Initiator multiple times is safe

### Authorization

For the Campaign Initiator to create tasks, the AI entity needs:
1. The `worker-campaign` role (grants `tasks.initiate_for` permission)
2. Membership in the `required_groups` defined on the `worker-initiate` step
3. The workflow must have `workerVisible: true` (the default)

## How Customer-Initiated Work Steps Flow

### 1. Define Steps in workflow.yaml and bundle.yaml

**workflow.yaml** — flow and routing logic:
```yaml
name: "document-processor"
metadata:
  title: "Document Processor"
  version: 1

spec:
  steps:
    - id: "upload"
      name: "Upload Document"
      type: 'workflow-entry'
      permissions:
        required_groups: []
        allow_virtual_group: true     # aihf-customer can access
      conditions:
        - type: "default"
          target_true: "process"

    - id: "process"
      name: "AI Processing"
      type: 'workflow-step'
      timeout_minutes: 5
      permissions:
        required_groups: []
        allow_virtual_group: true     # aihf-worker can access
      conditions:
        - type: "comparison"
          variable: "confidence"
          operator: "gte"
          constant: 0.9
          target_true: "results"
          target_false: "review"

    - id: "review"
      name: "Human Review"
      type: 'workflow-step'
      permissions:
        required_groups: ["reviewers"]
        allow_virtual_group: false    # Only explicit group members
      conditions:
        - type: "default"
          target_true: "results"

    - id: "results"
      name: "View Results"
      type: 'workflow-terminator'
```

**bundle.yaml** — implementation:
```yaml
name: document-processor
version: 1

steps:
  - id: "upload"
    route: '/upload'
    domain: 'app'
    ui:
      dynamic: 'ui/upload.ts'
    api:
      - route_match: '/submit'
        file: 'api/submit-document.ts'
        input:
          - name: 'document'
            type: 'string'

  - id: "process"
    route: '/process'
    domain: 'work'
    api:
      - route_match: '/'
        file: 'api/process-document.ts'
        input:
          - name: 'documentId'
            type: 'string'
        output:
          - name: 'confidence'
            type: 'number'

  - id: "review"
    route: '/review'
    domain: 'work'
    ui:
      dynamic: 'ui/review.ts'
    api:
      - route_match: '/approve'
        file: 'api/approve.ts'

  - id: "results"
    route: '/results'
    domain: 'app'
    ui:
      dynamic: 'ui/results.ts'
```

**Key points:**
- `workflow.yaml` defines conditional routing based on output variables (e.g., `confidence`)
- `bundle.yaml` defines `domain: 'work'` for steps that workers process
- Group membership (not worker type) determines who can access each step
- Output variables in bundle.yaml must match condition variables in workflow.yaml

### 2. Pass Data Between Steps

From your app domain handler, store step data for the work step to consume:

```typescript
// src/api/submit-document.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { document, filename } = JSON.parse(sanitisedInput);
  const entity = await sdk.entities.getCurrentEntity();

  const documentId = crypto.randomUUID();
  await sdk.files.upload(`documents/${documentId}/${filename}`, document);

  // Store step data — the AI Worker Service will pick this up
  // when it executes the next work domain step
  sdk.tasks.setStepData(JSON.stringify({
    documentId,
    filename,
    uploadedBy: entity?.entity_id
  }));

  return new Response(JSON.stringify({
    success: true,
    message: 'Document submitted for processing'
  }));
}
```

### 3. Implement Your Work Step Handler

```typescript
// src/api/process-document.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { documentId } = JSON.parse(sanitisedInput);

  // Get document from storage
  const stream = await sdk.files.download(`documents/${documentId}`);
  const buffer = await new Response(stream).arrayBuffer();
  const parsed = await sdk.utilities.documents.parse(buffer, 'docx');

  // Your business logic
  const analysis = analyzeDocument(parsed.text);

  // Store results in database
  await sdk.database.update(workflowName, 'documents',
    {
      status: 'processed',
      analysis: JSON.stringify(analysis),
      processed_at: new Date().toISOString()
    },
    'id = ?', [documentId]
  );

  // Store step data for the next step
  sdk.tasks.setStepData(JSON.stringify({ documentId, analysis, confidence: analysis.confidence }));

  // Return output variables — routing is defined in workflow.yaml conditions
  // 'confidence' is evaluated by the comparison condition to route the task
  return new Response(JSON.stringify({
    hasWork: true,
    confidence: analysis.confidence
  }));
}
```

## Task Execution Results

When the AI Worker Service executes a work domain handler, it interprets the HTTP response to determine what happens next:

| HTTP Status | Response | Action | Task State |
|-------------|----------|--------|------------|
| 200 | `hasWork: true` (or absent) | Task completes, routes to next step via workflow.yaml conditions | `completed` |
| 200 | `hasWork: false` | Task deferred, retried after calculated interval | `deferred` |
| 202 | Any | Escalate to human review | `completed` (escalated) |
| 500+ | Error | Task marked failed | `failed` |

### hasWork: true — Task Completion

Return `hasWork: true` when the handler has done its work. The platform evaluates the workflow.yaml conditions on the output variables and routes the task to the next step.

```typescript
return new Response(JSON.stringify({
  hasWork: true,
  confidence: 0.92,         // Output variable used by conditions
  summary: 'Processed OK'
}));
```

### hasWork: false — Deferral (Scheduled Tasks)

Return `hasWork: false` when timing conditions aren't met yet. This is **not** a failure — it's a signal that the task should be retried later. The task stays in the queue.

```typescript
return new Response(JSON.stringify({
  hasWork: false,
  message: `Last run was ${minutesAgo} minutes ago (interval: 60m)`
}));
```

The AI Worker Service parses the `message` field to calculate how long to defer:

| Message Format | Deferral Calculation |
|----------------|---------------------|
| `"Last run was 35 minutes ago (interval: 60m)"` | `60 - 35 + 1 = 26 minutes` |
| Contains `"hour"` | 30 minutes |
| Contains `"daily"` | 60 minutes |
| Contains `"weekly"` | 120 minutes |
| No recognizable pattern | 5 minutes (default) |

After the deferral period, the next poll cycle re-executes the handler.

### HTTP 202 — Escalation to Human

Return HTTP 202 to escalate the task to human review. The AI Worker Service marks the task as completed with an escalation flag. Use this when the AI determines it cannot handle the task confidently.

```typescript
if (analysis.confidence < 0.5) {
  sdk.tasks.setStepData(JSON.stringify({
    reason: 'Low confidence — requires human judgment',
    analysis
  }));

  return new Response(JSON.stringify({
    escalated: true,
    confidence: analysis.confidence
  }), { status: 202 });
}
```

## Worker-Initiated Scheduled Tasks

For background automation that runs without customer interaction, combine `worker-initiate` steps with the `hasWork` timing pattern.

### workflow.yaml

```yaml
name: "scheduled-maintenance"
metadata:
  title: "Scheduled Maintenance"
  version: 1

status:
  enabled: true
  visible: false            # Not shown to customers
  workerVisible: true       # Visible to AI workers (default)

spec:
  groups:
    - id: "ai-workers"
      name: "AI Workers"
      domain: "work"
      role_match: "ai-worker"
      type: "custom"

  steps:
    - id: "expire-proposals"
      name: "Expire Old Proposals"
      type: 'worker-initiate'
      permissions:
        required_groups: ["ai-workers"]
      conditions:
        - type: "default"
          target_true: "expire-proposals"    # Loop: task stays alive

    - id: "cleanup-temp-files"
      name: "Cleanup Temp Files"
      type: 'worker-initiate'
      permissions:
        required_groups: ["ai-workers"]
      conditions:
        - type: "default"
          target_true: "cleanup-temp-files"  # Loop: separate task
```

### Handler with Timing Logic

```typescript
// src/api/expire-proposals.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Check when we last ran
  const lastRun = await sdk.database.query(workflowName,
    'SELECT value FROM workflow_state WHERE key = ?',
    ['expire_proposals_last_run']
  );

  const minutesSinceLastRun = lastRun.length > 0
    ? (Date.now() - new Date(lastRun[0].value).getTime()) / (1000 * 60)
    : 999;

  const INTERVAL_MINUTES = 60;

  if (minutesSinceLastRun < INTERVAL_MINUTES) {
    // Not time yet — defer with message for optimal retry timing
    return new Response(JSON.stringify({
      hasWork: false,
      message: `Last run was ${Math.round(minutesSinceLastRun)} minutes ago (interval: ${INTERVAL_MINUTES}m)`
    }));
  }

  // Time to run — do the work
  const expired = await sdk.database.execute(workflowName,
    `UPDATE proposals SET status = 'expired' WHERE status = 'pending' AND expires_at < ?`,
    [new Date().toISOString()]
  );

  // Record last run time
  await sdk.database.upsert(workflowName, 'workflow_state', {
    key: 'expire_proposals_last_run',
    value: new Date().toISOString()
  });

  return new Response(JSON.stringify({
    hasWork: true,
    message: `Expired ${expired.changes} proposals`
  }));
}
```

### How the Lifecycle Works

```
Day 1, 6:00 AM  — Campaign Initiator creates Task A for "expire-proposals"
Day 1, 6:05 AM  — Poll: handler runs (first time, minutesSinceLastRun=999)
                   → hasWork: true, task completes, loops back to same step
Day 1, 6:10 AM  — Poll: handler checks timing (5 min ago, interval 60m)
                   → hasWork: false, deferred for 56 min
Day 1, 7:06 AM  — Poll: deferral expired, handler runs again (61 min)
                   → hasWork: true, completes, loops
Day 1, 7:11 AM  — Poll: too soon again → deferred
...continues cycling...
Day 1, 6:00 PM  — Campaign Initiator: task exists (pending/deferred) → SKIP
Day 2, 6:00 AM  — Campaign Initiator: task still exists → SKIP
```

One task persists indefinitely, executing on its schedule via the deferral loop.

## When Claude AI is Invoked

Not all work domain tasks use Claude. The AI Worker Service only calls the Anthropic API when the step's context includes `instructions`. This happens when the work step is designed for AI cognitive processing.

| Scenario | Claude Called? | Example |
|----------|--------------|---------|
| Step has `instructions` in context | Yes | Document analysis with business rules |
| Step has no `instructions` | No | Scheduled data sync, cleanup, expiry |
| Direct handler logic | No | Any handler that uses SDK methods only |

For cognitive AI tasks, the AI Worker Service:
1. Fetches the step context (which may include instructions)
2. Builds a prompt including the instructions and task data
3. Calls the Anthropic API (Claude)
4. Passes Claude's response as input to your handler

For direct automation tasks (no instructions), the handler executes immediately with just the step data.

## Visibility and Access Control

### workerVisible Flag

The `workerVisible` flag in workflow.yaml controls whether AI workers can see and process a workflow:

```yaml
status:
  enabled: true
  visible: true             # Customers can see it in app portal
  workerVisible: true       # Workers can see it in work portal (default: true)
```

| Flag | Default | Effect |
|------|---------|--------|
| `visible` | `true` | Controls customer visibility in the app portal |
| `workerVisible` | `true` | Controls worker visibility in the work portal |

Set `visible: false` + `workerVisible: true` for background-only workflows that customers never see but workers process.

### Virtual Groups

Steps can use virtual groups to simplify access control:

```yaml
permissions:
  required_groups: []
  allow_virtual_group: true
```

| Virtual Group | Mapped To | Domain |
|---------------|-----------|--------|
| `aihf-customer` | All entities with `customer` role | `app` |
| `aihf-worker` | All entities with `worker` role | `work` |

When `allow_virtual_group: true`:
- App domain steps are accessible to all customers (no explicit group needed)
- Work domain steps are accessible to all workers (no explicit group needed)

When `allow_virtual_group: false`:
- Only entities in `required_groups` can access the step

## Domain Transitions

When a workflow transitions between domains (app → work, or work → app), the platform:

1. **Creates a notification** for the target domain's entities
2. **Generates transition UI** (or calls your custom `renderAIHFWorkflowStepUITransition` handler)

### Cross-Domain (app → work)

Customer submits form → task transitions to work domain → workers in the step's `required_groups` are notified.

### Cross-Domain (work → app)

AI worker completes processing → task transitions to app domain → original customer is notified that results are ready.

### Same-Domain with Auto-Transition

When the `aihfControlApp2AppTransitions` feature is enabled, same-domain transitions (app → app or work → work) happen automatically without requiring a page reload:

```yaml
spec:
  services:
    features:
      - 'aihfControlApp2AppTransitions'
```

## Human Review Steps

Work domain steps can include UI for human reviewers:

```typescript
// src/ui/review.ts
export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const stepDataStr = sdk.tasks.getStepData();
  const { documentId, analysis } = stepDataStr ? JSON.parse(stepDataStr) : {};

  const html = `
<!DOCTYPE html>
<html>
<head><title>Review Document</title></head>
<body>
  <h1>Document Review</h1>

  <div class="analysis">
    <h2>AI Analysis</h2>
    <p>Confidence: ${Math.round(analysis.confidence * 100)}%</p>
    <p>Summary: ${analysis.summary}</p>
  </div>

  <div class="actions">
    <button onclick="approve()">Approve</button>
    <button onclick="reject()">Reject</button>
  </div>

  <script>
    async function approve() {
      await fetch('/review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: '${taskId}', approved: true })
      });
      location.reload();
    }

    async function reject() {
      const reason = prompt('Rejection reason:');
      await fetch('/review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: '${taskId}', approved: false, reason })
      });
      location.reload();
    }
  </script>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

## AI Worker Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              AI Worker Service (Cloudflare Worker)            │
│                    Multi-Tenant, Multi-Entity                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CampaignInitiatorWorkflow (2x daily: 6 AM, 6 PM UTC) │  │
│  │                                                        │  │
│  │  1. Authenticate all tenants                           │  │
│  │  2. Get initiatable workflows (worker-initiate steps)  │  │
│  │  3. Deduplicate (skip if task exists)                  │  │
│  │  4. Check targets (entity in required groups?)         │  │
│  │  5. Create campaigns → tasks                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ AIWorkerWorkflow (every 5 minutes)                     │  │
│  │                                                        │  │
│  │  1. Load AI entity configs from KV                     │  │
│  │  2. Authenticate all tenants in parallel                │  │
│  │  3. Fetch Anthropic API keys from gateway              │  │
│  │  4. Poll for tasks: GET /api/v1/work/tasks             │  │
│  │  5. Filter: pending + retryable (deferral expired?)    │  │
│  │  6. Execute in batches (max 5 parallel per tenant)     │  │
│  │     ├─ Acquire lock (300s TTL)                         │  │
│  │     ├─ Get step context (instructions, task data)      │  │
│  │     ├─ Call Claude API (only if instructions exist)    │  │
│  │     ├─ POST to handler endpoint                        │  │
│  │     └─ Handle result (complete/defer/escalate/fail)    │  │
│  │  7. Report execution stats to gateway                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Execution Summary (per cycle):                              │
│  ✅ Successful | ⏸️ Deferred | ⬆️ Escalated | ❌ Failed      │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **Zero-Config Provisioning**: Admin provisions AI entity in admin.aihf.io, worker auto-discovers via KV config
- **Multi-Tenant**: One service serves all tenants with full tenant isolation
- **Smart Deferral**: Tasks with `hasWork: false` are retried at calculated optimal intervals
- **Campaign Deduplication**: Existing pending/in_progress tasks are not recreated
- **Escalation**: HTTP 202 responses route tasks to human review
- **Cost Tracking**: Per-tenant Anthropic API usage tracking
- **Lock-Based Concurrency**: 300-second TTL locks prevent duplicate execution across poll cycles

### Task State Machine (AI Worker Service)

```
pending ──► claimed ──► in_progress ──┬──► completed (hasWork: true or HTTP 202)
                                      ├──► deferred  (hasWork: false) ──► pending (after deferral)
                                      └──► failed    (HTTP 500+)
```

| State | Description | Lock |
|-------|-------------|------|
| `pending` | Ready for execution | None |
| `claimed` | Locked by a worker (300s TTL) | Held |
| `in_progress` | Handler executing | Held |
| `deferred` | Waiting for deferral period to expire | Released |
| `completed` | Terminal — task done | Released |
| `failed` | Terminal — handler error | Released |

### Provisioning AI Workers

To add an AI worker to your workflow:

1. Log into **admin.aihf.io**
2. Navigate to **Entities > Create Entity** and set `profile.type` to `ai`
3. Assign the entity to the appropriate groups (matching your `required_groups` in workflow.yaml)
4. Under **AI Worker Service**, provision the entity to enable automated task execution

## Complete Example: Invoice Processing

### workflow.yaml

```yaml
name: "invoice-processor"
metadata:
  title: "Invoice Processing"
  version: 1
  description: "AI-powered invoice validation with human review"

status:
  enabled: true
  visible: true
  workerVisible: true

spec:
  services:
    notification_rules: ["APP_2_WORK", "WORK_2_APP"]
    cost_limits:
      max: 0.25
      alertAt: 0.20

  groups:
    - id: "finance-reviewers"
      name: "Finance Reviewers"
      description: "Can review flagged invoices"
      domain: "work"
      role_match: "finance-reviewer"
      type: "custom"

  steps:
    - id: "upload"
      name: "Upload Invoice"
      type: 'workflow-entry'
      permissions:
        required_groups: []
        allow_virtual_group: true
      conditions:
        - type: "default"
          target_true: "validate"

    - id: "validate"
      name: "AI Validation"
      type: 'workflow-step'
      timeout_minutes: 5
      conditions:
        - type: "comparison"
          variable: "confidence"
          operator: "gte"
          constant: "0.95"
          target_true: "complete"
          target_false: "review"

    - id: "review"
      name: "Human Review"
      type: 'workflow-step'
      permissions:
        required_groups: ["finance-reviewers"]
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "complete"

    - id: "complete"
      name: "Complete"
      type: 'workflow-terminator'
```

### bundle.yaml

```yaml
name: invoice-processor
version: 1

steps:
  - id: "upload"
    route: '/upload'
    domain: 'app'
    ui:
      css: 'static/invoice.css'
      script: 'static/invoice.js'
      dynamic: 'ui/upload.ts'
    api:
      - route_match: '/submit'
        file: 'api/submit-invoice.ts'
        input:
          - name: 'title'
            type: 'string'
        output:
          - name: 'invoiceId'
            type: 'string'

  - id: "validate"
    route: '/validate'
    domain: 'work'
    ui:
      css: ''
      script: ''
      dynamic: ''
    api:
      - route_match: '/'
        file: 'api/validate-invoice.ts'
        input: []
        output:
          - name: 'confidence'
            type: 'number'

  - id: "review"
    route: '/review'
    domain: 'work'
    ui:
      css: 'static/invoice.css'
      script: 'static/invoice.js'
      dynamic: 'ui/review-invoice.ts'
    api:
      - route_match: '/approve'
        file: 'api/approve-invoice.ts'
        input:
          - name: 'decision'
            type: 'string'
        output: []

  - id: "complete"
    route: '/complete'
    domain: 'app'
    ui:
      css: 'static/invoice.css'
      script: ''
      dynamic: 'ui/invoice-complete.ts'
    api: []
```

### Validation Handler

```typescript
// src/api/validate-invoice.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Get step data from the previous step
  const stepDataStr = sdk.tasks.getStepData();
  const { invoiceId } = stepDataStr ? JSON.parse(stepDataStr) : {};

  // Get invoice from storage
  const stream = await sdk.files.download(`invoices/${invoiceId}/invoice.xlsx`);
  const buffer = await new Response(stream).arrayBuffer();
  const parsed = await sdk.utilities.spreadsheets.parse(buffer, 'xlsx');

  // Validate
  const validation = validateInvoice(parsed.sheets[0]);

  // Store results
  await sdk.database.update(workflowName, 'invoices',
    { validation: JSON.stringify(validation), validated_at: new Date().toISOString() },
    'id = ?', [invoiceId]
  );

  // Pass data to next step
  sdk.tasks.setStepData(JSON.stringify({ invoiceId, validation }));

  // 'confidence' output variable drives workflow.yaml condition routing
  return new Response(JSON.stringify({
    hasWork: true,
    confidence: validation.confidence,
    validation
  }));
}
```

## Best Practices

1. **Always return hasWork**: Work domain handlers must indicate whether work was done
2. **Use confidence thresholds**: Auto-approve high-confidence results in workflow.yaml conditions, route lower ones to human review
3. **Store intermediate results**: Save analysis to database before returning — if the handler fails on the response, results are preserved
4. **Use `setStepData` for inter-step data**: Don't rely on database queries to pass data between steps when step data works
5. **Handle errors gracefully**: Return `hasWork: false` for recoverable/timing errors, HTTP 202 to escalate to humans
6. **Keep handlers focused**: One task per handler. Let workflow.yaml conditions handle routing, not imperative code
7. **Design for idempotency**: Worker-initiated tasks may re-execute if a poll cycle overlaps. Use timestamps and `INSERT OR IGNORE` patterns
8. **Use `workerVisible: false`** only for workflows that should never appear in the work portal (rare — default is `true`)

## Testing AI Instructions Before Deployment

Before deploying a workflow with AI-powered steps, use the `aihf eval` command to test
your instruction prompts against real data without deploying to production.

### How It Works

The eval command replicates exactly what the AI Worker Service does in production:
it assembles prompts from your instruction YAML, calls the Claude API with the same
system prompt and structure used at runtime, and validates the outputs against your
`expected_output_schema`.

```
┌─────────────────────────────────────────────────────────────────┐
│                   aihf eval — Local Test Loop                   │
│                                                                 │
│  instruction.yaml  +  test-data.json                           │
│         │                  │                                    │
│         └────────┬─────────┘                                   │
│                  ▼                                              │
│         Assemble prompt (same as production)                    │
│                  │                                              │
│                  ▼                                              │
│         Claude API  (your ANTHROPIC_API_KEY)                    │
│                  │                                              │
│                  ▼                                              │
│         Validate JSON output against expected_output_schema     │
│         Check assertions (expected field values)               │
│         Measure: confidence · consistency · latency · cost      │
│                  │                                              │
│                  └──── Repeat N runs per test case ─────────── │
└─────────────────────────────────────────────────────────────────┘
```

This means: **if your instruction passes eval, it will behave identically when deployed.**
Eval is not a simulation — it's the same prompt structure hitting the same API.

### When to Use Eval

Use `aihf eval` when:
- Writing a new instruction YAML for the first time
- Changing `task_instructions` or `business_rules` in an existing instruction
- Tuning `confidence_threshold` — run eval to see what confidence scores your
  test cases actually produce before choosing a threshold
- Comparing model performance: run eval twice with `-m claude-sonnet-4-5-20250929`
  and `-m claude-haiku-4-5-20251001` to see if the cheaper model is sufficient
- Verifying output consistency — multiple runs (`--runs 5`) reveals whether Claude
  returns consistent field values or produces variable outputs for the same input

### Quick Example

```bash
# Test an instruction with 3 runs per test case (default)
aihf eval . \
  --instructions src/instructions/invoice-check.instruction.yaml \
  --dataset test-data/invoice-scenarios.json

# Compare two models
aihf eval . -i src/instructions/invoice-check.instruction.yaml \
  -d test-data/invoice-scenarios.json \
  -m claude-haiku-4-5-20251001

# Enable LLM-as-judge grading for subjective quality scoring
aihf eval . -i src/instructions/invoice-check.instruction.yaml \
  -d test-data/invoice-scenarios.json \
  --grade

# Save a JSON report for later comparison
aihf eval . -i src/instructions/invoice-check.instruction.yaml \
  -d test-data/invoice-scenarios.json \
  -o reports/sonnet-baseline.json
```

### What the Report Shows

After each eval run, you receive a report covering:

| Metric | What It Tells You |
|--------|------------------|
| **Schema Compliance** | Whether Claude's JSON output matched your `expected_output_schema` on each run |
| **Assertion Pass Rate** | Whether specific field values matched your `expected` values in the dataset |
| **Avg Confidence** | The mean `confidence` value Claude returned — tune `confidence_threshold` against this |
| **Confidence Std Dev** | How consistent confidence scores are across runs — high variance means the instruction is ambiguous |
| **Consistency** | For each output field: how often Claude returned the same value across runs |
| **Token Usage + Cost** | Input/output tokens and estimated API cost for the eval run |

### Test Dataset Format

Create a JSON file alongside your instruction:

```json
{
  "description": "Invoice validation test cases",
  "test_cases": [
    {
      "name": "valid-invoice-standard",
      "inputs": {
        "invoice_number": "INV-2024-001",
        "amount": 1500.00,
        "vendor": "Acme Corp",
        "line_items": [...]
      },
      "expected": {
        "approved": true,
        "confidence": 0.9
      }
    },
    {
      "name": "missing-line-items",
      "inputs": {
        "invoice_number": "INV-2024-002",
        "amount": 500.00,
        "vendor": "Unknown Vendor",
        "line_items": []
      },
      "expected": {
        "approved": false
      }
    }
  ]
}
```

### API Key Requirement

The eval command calls the Anthropic API directly using your own API key — not the
platform's. You are billed for these eval calls at standard Anthropic rates.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
aihf eval . --instructions src/instructions/my-task.instruction.yaml \
             --dataset test-data/cases.json
```

See [Prompt Evaluation Guide](./PROMPT_EVAL.md) for the complete command reference and
advanced options including model-based grading.

## Related Documentation

- [Prompt Evaluation](./PROMPT_EVAL.md) - Test and tune AI instruction prompts before deployment
- [Workflow.yaml Reference](./WORKFLOW_YAML.md) - Steps, conditions, and routing logic
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Routes, domains, UI, and API handlers
- [Workflow Concepts](./WORKFLOW_CONCEPTS.md) - Task lifecycle, step navigation, and multi-part suites
- [Workflow Initialization](./INIT_WORKFLOW.md) - Database setup and data migration
- [SDK Reference](./SDK_REFERENCE.md) - Full API documentation
