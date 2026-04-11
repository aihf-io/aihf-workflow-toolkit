# Workflow Concepts

Understanding the core concepts of AIHF.io workflows.

## The AIHF.io Model

AIHF.io workflows combine AI automation with human oversight:

```
┌─────────────────────────────────────────────────────────────┐
│                     AIHF.io Platform                         │
│                                                              │
│   ┌─────────────────┐       ┌─────────────────┐             │
│   │   App Domain    │       │   Work Domain   │             │
│   │                 │       │                 │             │
│   │  Customer UI    │──────▶│  AI Processing  │             │
│   │  Public APIs    │       │  Human Review   │             │
│   │                 │◀──────│  Background     │             │
│   └─────────────────┘       └─────────────────┘             │
│                                     │                        │
│                            ┌────────▼────────┐              │
│                            │ AI Worker       │              │
│                            │ Service         │              │
│                            │ (Claude AI)     │              │
│                            └─────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Domains

Every workflow step belongs to a domain:

| Domain | Subdomain | Purpose | Who Accesses |
|--------|-----------|---------|--------------|
| `app` | `workflow.tenant.aihf.app` | Customer-facing | End users |
| `work` | `workflow.tenant.aihf.work` | Internal processing | AI workers, human reviewers |

### App Domain (`domain: 'app'`)

- Public-facing UI and APIs
- Customer forms, dashboards, results pages
- Authentication optional (configurable)
- Accessed by your end users

### Work Domain (`domain: 'work'`)

- Internal processing and review
- AI Worker Service polls and executes these steps
- Human review interfaces for staff
- Requires authentication (always)
- Not accessible to end users

## Step Types

Every step in workflow.yaml has a `type` that defines its role in the flow:

| Type | Purpose |
|------|---------|
| `workflow-entry` | Customer-initiated entry point. Workflows begin here when a customer visits the app domain. |
| `workflow-step` | Standard processing step. Can be in app or work domain. |
| `workflow-terminator` | Completion point. No further transitions — the workflow ends here. |
| `worker-initiate` | Worker-initiated entry point. The Campaign Initiator creates tasks starting at these steps on a schedule. Used for background automation. |
| `sub-workflow-entry` | Entry point for a nested sub-workflow. |
| `sub-workflow-invoke` | Invokes a sub-workflow. Acts as a terminator for the current workflow. |

**Entry points:** Every workflow must have at least one entry point (`workflow-entry`, `worker-initiate`, or `sub-workflow-entry`). A workflow can have multiple entry points of different types — for example, a customer-facing `workflow-entry` **and** several `worker-initiate` steps for scheduled automation.

See [AI Workers Guide](./AI_WORKERS.md) for full details on `worker-initiate` and the Campaign Initiator.

## Tasks

A **task** represents a unit of work moving through your workflow.

### Task Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique task identifier |
| `workflowName` | string | The workflow this task belongs to |
| `workflowVersion` | number | Version of the workflow |
| `workflowStepCurrent` | string | Current step ID |
| `status` | string | Current task status |
| `priority` | string | `'low'`, `'medium'`, `'high'`, or `'urgent'` |
| `visited_steps` | string[] | Steps already visited (prevents loops) |

### Task Lifecycle

```
┌───────────────────────────────────────────────────────────────────┐
│                        Task Lifecycle                              │
│                                                                    │
│  Gateway (platform-level):                                        │
│                                                                    │
│  pending ──▶ assigned ──▶ in_progress ──▶ completed               │
│                                  │                                │
│                                  └──▶ cancelled                   │
│                                                                    │
│  AI Worker Service (execution-level):                              │
│                                                                    │
│  pending ──▶ claimed ──▶ in_progress ──┬──▶ completed             │
│                                        ├──▶ deferred ──▶ pending  │
│                                        └──▶ failed                │
└───────────────────────────────────────────────────────────────────┘
```

### Task Status Values

**Gateway task statuses** (stored in the platform):

| Status | Description | Next Action |
|--------|-------------|-------------|
| `pending` | Waiting to be processed | Worker picks it up |
| `assigned` | Assigned to an entity | Entity begins work |
| `in_progress` | Currently being processed | Handler executing |
| `completed` | Successfully finished | Moves to next step or ends |
| `cancelled` | Cancelled (error, manual, or retry limit) | Terminal state |

**AI Worker Service execution statuses** (stored in KV, per-execution):

| Status | Description | Lock |
|--------|-------------|------|
| `claimed` | Locked by a worker (300s TTL) | Held |
| `in_progress` | Handler executing | Held |
| `deferred` | Timing not met (`hasWork: false`), retried after interval | Released |
| `completed` | Handler returned `hasWork: true` or HTTP 202 | Released |
| `failed` | Handler returned HTTP 500+ | Released |

## Step Navigation

How tasks move between steps:

### Passing Data Between Steps

Use `setStepData` to pass data to the next step in the workflow:

```typescript
// Store data for the next step to consume
sdk.tasks.setStepData(JSON.stringify({
  documentId: 'doc_123',
  priority: 'high'
}));
```

### Retrieving Step Data

Get data passed from the previous step:

```typescript
const stepDataStr = sdk.tasks.getStepData();
const stepData = stepDataStr ? JSON.parse(stepDataStr) : {};
// stepData.documentId - from previous step
```

### Getting Task Details

Retrieve task information by ID:

```typescript
const task = await sdk.tasks.getTask(taskId);
// task contains the task record from the platform
```

### Step Routing

Step navigation is defined declaratively in `workflow.yaml` conditions, not imperatively in code. The platform routes tasks to the next step based on:
- **Default conditions**: Always route to `target_true`
- **Comparison conditions**: Compare output variables to constants using operators (`eq`, `gte`, `lt`, `contains`, `matches`, etc.)
- **Options conditions**: Match a variable against a list of option → target mappings
- **Dynamic conditions**: When `target_dynamic: true`, the platform calls `getNextAIHFStepId` for custom routing logic

See [Workflow.yaml Reference](./WORKFLOW_YAML.md) for the full condition schema and operator list.

## Handler Parameters Explained

Every handler receives these parameters:

```typescript
export async function invokedByAIHF(
  sdk: AIHFPlatform,        // Platform SDK instance
  workflowName: string,     // e.g., "my-workflow"
  workflowVersion: number,  // e.g., 1
  workflowStepId: string,   // e.g., "upload" (current step id)
  taskId: string,           // Unique task identifier
  sanitisedInput: string    // JSON string of validated input
): Promise<Response | null>
```

### `sdk: AIHFPlatform`

The Platform SDK with access to all services:
- `sdk.entities` - User management
- `sdk.database` - D1 database
- `sdk.files` - R2 storage
- `sdk.tasks` - Task management
- `sdk.billing` - Stripe payments
- And more...

### `workflowName: string`

The name from your `workflow.yaml`:

```yaml
# workflow.yaml
name: "my-workflow"  # <-- This value
metadata:
  version: 1
```

### `workflowVersion: number`

The version from your `workflow.yaml`:

```yaml
# workflow.yaml
metadata:
  version: 1  # <-- This value
```

### `workflowStepId: string`

The `id` of the current step (defined in both files):

```yaml
# workflow.yaml - defines the step and its flow
spec:
  steps:
    - id: "upload"  # <-- workflowStepId will be "upload"
      name: "Upload Document"
      type: 'workflow-entry'

# bundle.yaml - defines its implementation
steps:
  - id: "upload"    # <-- Must match workflow.yaml
    route: '/upload'
    domain: 'app'
```

### `taskId: string`

Unique identifier for this specific task execution. Use it to:
- Track this task in your database
- Reference it in API responses
- Pass it in URLs for continuation

### `sanitisedInput: string`

JSON string containing the validated input. Parse it:

```typescript
const input = JSON.parse(sanitisedInput);
// input contains fields defined in bundle.yaml api.input
```

## Handler Return Values

Handlers return `Response | null`:

### Return a Response

```typescript
// Return JSON data
return new Response(JSON.stringify({ success: true }), {
  headers: { 'Content-Type': 'application/json' }
});

// Redirect user
return Response.redirect('/next-step', 302);
```

### Return null

Return `null` to let the platform render the step's UI:

```typescript
// Handler does some processing, then lets UI render
await sdk.database.insert(...);
return null;  // Platform renders ui.dynamic or ui.static
```

## Full URL Structure

How URLs are constructed:

```
https://{workflowName}.{tenantId}.aihf.{domain}/{stepRoute}{apiRouteMatch}
```

### Examples

```yaml
# bundle.yaml
name: my-workflow

steps:
  - id: "upload"
    route: '/upload'
    domain: 'app'
    api:
      - route_match: '/submit'
        file: 'api/upload.ts'
```

For tenant `acme`:

| Component | URL |
|-----------|-----|
| UI | `https://my-workflow.acme.aihf.app/upload` |
| API | `https://my-workflow.acme.aihf.app/upload/submit` |

For work domain:

| Component | URL |
|-----------|-----|
| Work UI | `https://my-workflow.acme.aihf.work/review` |
| Work API | `https://my-workflow.acme.aihf.work/review/approve` |

## Typical Workflow Patterns

### Customer Form → AI Processing → Results

**workflow.yaml** (flow logic):
```yaml
spec:
  steps:
    - id: "form"
      type: 'workflow-entry'
      conditions:
        - type: "default"
          target_true: "process"

    - id: "process"
      type: 'workflow-step'
      conditions:
        - type: "default"
          target_true: "results"

    - id: "results"
      type: 'workflow-terminator'
```

**bundle.yaml** (implementation):
```yaml
steps:
  - id: "form"
    route: '/'
    domain: 'app'
    ui: { dynamic: 'ui/form.ts' }
    api: [{ route_match: '/submit', file: 'api/submit.ts' }]

  - id: "process"
    route: '/process'
    domain: 'work'
    api: [{ route_match: '/', file: 'api/process.ts' }]

  - id: "results"
    route: '/results'
    domain: 'app'
    ui: { dynamic: 'ui/results.ts' }
```

### Multi-Step with Human Review

**workflow.yaml** (conditional routing):
```yaml
spec:
  steps:
    - id: "upload"
      type: 'workflow-entry'
      conditions:
        - type: "default"
          target_true: "ai-analyze"

    - id: "ai-analyze"
      type: 'workflow-step'
      conditions:
        - type: "comparison"
          variable: "confidence"
          operator: "gte"
          constant: 0.95
          target_true: "approved"
          target_false: "human-review"

    - id: "human-review"
      type: 'workflow-step'
      permissions:
        required_groups: ["reviewers"]
      conditions:
        - type: "default"
          target_true: "approved"

    - id: "approved"
      type: 'workflow-terminator'
```

### Scheduled Background Tasks (Worker-Initiated)

Use `worker-initiate` steps for tasks that run on a schedule without customer interaction. The Campaign Initiator creates tasks automatically.

**workflow.yaml**:
```yaml
status:
  visible: false            # Not shown to customers
  workerVisible: true       # Visible to AI workers

spec:
  groups:
    - id: "ai-workers"
      name: "AI Workers"
      domain: "work"
      role_match: "ai-worker"
      type: "custom"

  steps:
    - id: "daily-sync"
      type: 'worker-initiate'      # Campaign Initiator creates tasks here
      permissions:
        required_groups: ["ai-workers"]
      conditions:
        - type: "default"
          target_true: "daily-sync"  # Loops: task stays alive via deferral
```

**bundle.yaml**:
```yaml
steps:
  - id: "daily-sync"
    route: '/sync'
    domain: 'work'
    api: [{ route_match: '/', file: 'api/daily-sync.ts' }]
```

Handler checks timing and returns `hasWork: false` to defer until the next interval:

```typescript
if (minutesSinceLastRun < 60) {
  return new Response(JSON.stringify({
    hasWork: false,
    message: `Last run was ${Math.round(minutesSinceLastRun)} minutes ago (interval: 60m)`
  }));
}
```

See [AI Workers Guide](./AI_WORKERS.md#worker-initiated-scheduled-tasks) for the complete lifecycle including the Campaign Initiator, deferral calculation, and deduplication.

## Domain Transitions

When a task moves from one step to the next, the platform checks if the domain changes:

### Cross-Domain Transitions (app ↔ work)

When transitioning between domains, the platform:

1. Creates a **system notification** to the target domain's entities
2. Generates a **transition UI** (or calls your custom handler)

| Transition | What Happens |
|------------|-------------|
| app → work | Workers in the step's `required_groups` are notified. AI Worker Service picks up the task on its next poll. |
| work → app | Original customer entity is notified that results are ready. Customer navigates to the results page. |

You can provide a custom transition UI by exporting `renderAIHFWorkflowStepUITransition` from your UI file:

```typescript
export async function renderAIHFWorkflowStepUITransition(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  return new Response('<html><body>Processing your request...</body></html>', {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### Same-Domain Transitions

When both steps are in the same domain (app → app or work → work), the default behavior returns the JSON response from the handler.

Enable **auto-transition** to automatically load the next step's UI without a page reload:

```yaml
spec:
  services:
    features:
      - 'aihfControlApp2AppTransitions'
```

## Virtual Groups and Permissions

### Virtual Groups

AIHF provides two virtual groups that simplify access control:

| Virtual Group | Mapped To | Domain |
|---------------|-----------|--------|
| `aihf-customer` | All entities with `customer` role | `app` |
| `aihf-worker` | All entities with `worker` role | `work` |

Use `allow_virtual_group: true` to grant access to all entities of the appropriate role:

```yaml
# App domain step — accessible to all customers
- id: "form"
  type: 'workflow-entry'
  permissions:
    required_groups: []           # No specific groups required
    allow_virtual_group: true     # aihf-customer group auto-applies

# Work domain step — accessible to all workers
- id: "process"
  type: 'workflow-step'
  permissions:
    required_groups: []
    allow_virtual_group: true     # aihf-worker group auto-applies
```

Set `allow_virtual_group: false` when only explicitly assigned group members should access a step:

```yaml
# Only finance reviewers can access
- id: "review"
  type: 'workflow-step'
  permissions:
    required_groups: ["finance-reviewers"]
    allow_virtual_group: false
```

### Security Levels

Steps can require a minimum security level for step-up authentication:

```yaml
permissions:
  required_groups: ["managers"]
  allow_virtual_group: false
  required_level: 2              # Requires TOTP or equivalent
```

## Workflow Visibility

The `status` section controls who can see the workflow:

```yaml
status:
  enabled: true             # Workflow is active
  visible: true             # Customers see it in the app portal
  workerVisible: true       # Workers see it in the work portal (default: true)
```

| Combination | Use Case |
|-------------|----------|
| `visible: true`, `workerVisible: true` | Standard workflow — customers interact, workers process |
| `visible: false`, `workerVisible: true` | Background-only — worker-initiated tasks, customers never see it |
| `visible: true`, `workerVisible: false` | Customer-only — no work domain steps or worker processing |

## Workflow Initialization

Every workflow bundle can include an `src/initWorkflow.ts` file. The gateway runs this function automatically during deployment (Step 9 of the deployment pipeline). Use it to:

- Create D1 database tables and indexes
- Seed reference data or default configuration rows
- Upload initial files to R2 storage (templates, default assets)
- Migrate data when deploying a new version

```typescript
export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  await sdk.database.execute(workflowName, `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return 'success';
}
```

Init failure does **not** fail the deployment. The admin can re-run init from admin.aihf.io at any time. Design init scripts to be **idempotent**. See [Workflow Initialization](./INIT_WORKFLOW.md) for full details.

## Multi-Part Workflow Suites

For products with multiple related workflows (e.g., signup + dashboard + reports), AIHF supports **multi-part suites** — a collection of workflow bundles that share code.

### Suite Structure

```
my-product/
├── aihf-suite.yaml            # Suite manifest
├── shared/
│   ├── types/                  # Shared TypeScript types
│   │   └── index.ts
│   └── utils/                  # Shared utility functions
│       └── index.ts
└── workflows/
    ├── signup/                 # Standard workflow bundle
    │   ├── workflow.yaml
    │   ├── bundle.yaml
    │   └── src/
    └── dashboard/              # Another workflow bundle
        ├── workflow.yaml
        ├── bundle.yaml
        └── src/
```

### Creating a Suite

```bash
# Create the suite root
aihf init my-product --type multi-part

# Add workflow bundles
cd my-product
aihf init signup --suite .
aihf init dashboard --suite .
```

### Sharing Code

Workflows in a suite import shared code via the `@suite/shared/*` path alias:

```typescript
// In workflows/signup/src/api/submit.ts
import { Customer } from '@suite/shared/types';
import { formatDate } from '@suite/shared/utils';
```

The CLI resolves this at compile time. The compiled bundle includes everything it needs — no runtime dependency on the suite structure.

### Compiling a Suite

```bash
# Compile a single bundle within the suite
aihf compile workflows/signup

# Compile all bundles at once
aihf compile-suite .

# Validate all bundles
aihf validate --suite .
```

## Error Handling

### In App Domain Handlers

Return error responses directly:

```typescript
if (!input.email) {
  return new Response(JSON.stringify({
    error: 'Email is required'
  }), { status: 400 });
}
```

### In Work Domain Handlers

For recoverable errors, defer:

```typescript
try {
  await externalApi.call();
} catch (error) {
  // Will retry later
  return new Response(JSON.stringify({
    hasWork: false,
    message: `API unavailable: ${error.message}`
  }));
}
```

For permanent failures, escalate to human review with HTTP 202:

```typescript
if (document.corrupted) {
  // Store escalation data for the review step
  sdk.tasks.setStepData(JSON.stringify({
    reason: 'Document corrupted, needs manual handling',
    escalated: true
  }));
  // HTTP 202 signals escalation to the AI Worker Service
  return new Response(JSON.stringify({
    escalated: true,
    reason: 'Document corrupted'
  }), { status: 202 });
}
```

## Related Documentation

- [Getting Started](./GETTING_STARTED.md) - Build your first workflow
- [Workflow.yaml Reference](./WORKFLOW_YAML.md) - Steps, conditions, and routing logic
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Routes, UI files, and API handlers
- [Config.json Guide](./CONFIG_JSON.md) - Tenant-configurable settings
- [Workflow Initialization](./INIT_WORKFLOW.md) - Database setup and data migration
- [SDK Reference](./SDK_REFERENCE.md) - Full API documentation
- [AI Workers Guide](./AI_WORKERS.md) - Work domain and automation
