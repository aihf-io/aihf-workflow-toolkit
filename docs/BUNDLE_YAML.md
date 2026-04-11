# Bundle.yaml Reference

The `bundle.yaml` file provides implementation details for each step defined in `workflow.yaml`. It maps step IDs to routes, domains, UI files, and API handlers.

## Relationship with workflow.yaml

| File | Purpose |
|------|---------|
| **workflow.yaml** | Defines step flow, conditions, permissions, routing logic |
| **bundle.yaml** | Defines implementation: routes, domains, UI files, API handlers |

Every step `id` in workflow.yaml must have a matching entry in bundle.yaml.

## WorkflowManifest Schema

```typescript
interface WorkflowManifest {
  workflowId: string;
  workflowVersion: number;
  name: string;
  version: number;
  steps: WorkflowManifestStepHandler[];
}

interface WorkflowManifestStepHandler {
  id: string;
  route: string;
  domain?: 'app' | 'work';   // Defaults to 'work' if not specified
  ui: {
    css: string;
    script: string;
    dynamic: string;
  };
  api: WorkflowManifestStepAPIHandler[];
}

interface WorkflowManifestStepAPIHandler {
  route_match: string;
  file: string;
  input: WorkflowManifestStepAPIHandlerParameter[];
  output: WorkflowManifestStepAPIHandlerParameter[];
}

interface WorkflowManifestStepAPIHandlerParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'Response';
  enum?: string[];
  default?: string | number | boolean;
}
```

> The `'Response'` type is exclusively the SSE opt-in marker — see
> [Streaming API Handlers (SSE)](#streaming-api-handlers-sse) below. It must
> appear only as the single `output[0]` with `name: 'SSE'`. Using it anywhere
> else is rejected by both `aihf validate` and the runtime dispatcher.

## File Structure

```yaml
workflowId: 'workflow-uuid'
workflowVersion: 1
name: my-workflow
version: 1

steps:
  - id: "step-id"
    route: '/path'
    domain: 'app'
    ui:
      css: 'static/styles.css'
      script: 'static/app.js'
      dynamic: 'ui/renderer.ts'
    api:
      - route_match: '/submit'
        file: 'api/handler.ts'
        input: []
        output: []
```

## Top-Level Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `workflowId` | string | Yes | The workflow definition ID (matches WorkflowDefinition.id) |
| `workflowVersion` | number | Yes | The workflow definition version (matches metadata.version) |
| `name` | string | Yes | Bundle name (typically matches workflow name) |
| `version` | number | Yes | Bundle version |
| `steps` | array | Yes | Step implementation definitions |

## Step Properties

Each step in the `steps` array:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Must match a step ID in workflow.yaml |
| `route` | string | Yes | URL path for this step |
| `domain` | string | No | `'app'` or `'work'` (defaults to `'work'`) |
| `ui` | object | Yes | UI configuration |
| `api` | array | Yes | API endpoint definitions |

### Domains

| Domain | Subdomain | Purpose |
|--------|-----------|---------|
| `app` | `workflow.tenant.aihf.app` | Customer-facing UI and APIs |
| `work` | `workflow.tenant.aihf.work` | AI processing, human review |

## UI Configuration

The `ui` object has three string properties for file paths:

```yaml
ui:
  css: 'static/styles.css'           # CSS file path
  script: 'static/app.js'            # JavaScript file path
  dynamic: 'ui/renderer.ts'          # Dynamic UI renderer (TypeScript)
```

| Property | Type | Description |
|----------|------|-------------|
| `css` | string | Path to CSS stylesheet |
| `script` | string | Path to client JavaScript |
| `dynamic` | string | TypeScript file that renders HTML dynamically |

### Dynamic UI Renderer

The `dynamic` file must export a `renderAIHFWorkflowStepUI` function:

```typescript
// src/ui/renderer.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const html = `<!DOCTYPE html>
<html>
<head><title>My Page</title></head>
<body>
  <h1>Welcome</h1>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

## API Configuration

```yaml
api:
  - route_match: '/submit'
    file: 'api/submit.ts'
    input:
      - name: 'email'
        type: 'string'
    output:
      - name: 'success'
        type: 'string'
      - name: 'userId'
        type: 'string'
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `route_match` | string | Yes | URL path suffix (e.g., `/submit`, `/`) |
| `file` | string | Yes | TypeScript handler file path |
| `input` | array | Yes | Expected input parameters |
| `output` | array | Yes | Expected output parameters |

### API Handler Implementation

The `file` must export an `invokedByAIHF` function:

```typescript
// src/api/handler.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const input = JSON.parse(sanitisedInput);

  // Your logic here

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Input/Output Parameter Definitions

Parameters have a constrained schema. The `type` field supports `'string'`,
`'number'`, `'boolean'`, or `'Response'`:

```yaml
input:
  - name: 'documentId'
    type: 'string'

  - name: 'priority'
    type: 'string'
    enum: ['low', 'medium', 'high']
    default: 'medium'

  - name: 'retryCount'
    type: 'number'
    default: 3
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Parameter name |
| `type` | `'string'` \| `'number'` \| `'boolean'` \| `'Response'` | Yes | Data type |
| `enum` | string[] | No | Allowed string values |
| `default` | string, number, or boolean | No | Default value |

**Note:** Input/output parameter types are `'string'`, `'number'`, `'boolean'`,
or `'Response'`. The `'Response'` type is **exclusively** the SSE opt-in
marker for streaming handlers — see
[Streaming API Handlers (SSE)](#streaming-api-handlers-sse) below. Complex
types (objects, arrays) should be serialized as strings (JSON).

### Streaming API Handlers (SSE)

> The SSE example below uses `sdk.containers.getOutput()` and
> `sdk.containers.status()` — these are methods on the **Containers API**
> (`sdk.containers`), which provides sandboxed Jupyter, Python, and Node.js
> compute environments launched from workflow handlers. See
> [Containers](./CONTAINERS.md) for the full API reference and lifecycle guide.

For long-running responses (live kernel output, chat streams, progress
tickers), declare the handler as SSE by setting its `output` to a single
`Response` parameter named `SSE`:

```yaml
api:
  - route_match: '/jupyter/output'
    file: 'api/jupyter-output.ts'
    input:
      - name: 'sessionId'
        type: 'string'
      - name: 'cursor'
        type: 'string'
        default: '0'
    output:
      - name: 'SSE'
        type: 'Response'
```

SSE handlers are invoked via the parallel URL
`/api/v1/sse/app/<workflow>/<version>/<step>/<route_match>`, **not** the
normal `/api/v1/app/...` URL. They are called with GET (not POST) and read
inputs from the query string. They export `invokedByAIHFSSE` instead of
`invokedByAIHF`:

```typescript
// src/api/jupyter-output.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHFSSE(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  inputs: Record<string, string>
): Promise<Response> {
  const sessionId = inputs.sessionId;
  const startCursor = parseInt(inputs.cursor ?? '0', 10);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  (async () => {
    let cursor = startCursor;
    try {
      while (true) {
        const batch = await sdk.containers.getOutput(sessionId, cursor);
        for (const msg of batch.messages) {
          await writer.write(enc.encode(
            `event: kernel_message\nid: ${batch.cursor}\ndata: ${JSON.stringify(msg)}\n\n`
          ));
        }
        cursor = batch.cursor;
        if (batch.messages.length === 0) {
          await new Promise(r => setTimeout(r, 250));
        }
        const status = await sdk.containers.status(sessionId);
        if (status.state === 'stopped' || status.state === 'error') break;
      }
    } catch (e) {
      await writer.write(enc.encode(
        `event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`
      ));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

**Key rules:**

- SSE handlers export `invokedByAIHFSSE`, not `invokedByAIHF`.
- They return a raw `Response` whose body is a `ReadableStream` of SSE frames.
- The platform's `AIHFSSEBridge` adds authorisation, the full SSE header
  set (`Cache-Control`, `Connection`, `X-Accel-Buffering`), CORS, rate
  limiting, and audit — your handler only emits frames.
- SSE handlers do NOT participate in workflow step transitions. Use a
  normal (non-SSE) API handler on the same step for any action that must
  advance the workflow or mutate task state.
- On reconnect, the browser's `EventSource` sends `Last-Event-ID`. Your
  handler receives it as `inputs.cursor` and should resume from there.
- SSE is always invoked via GET. Inputs come from the query string.
- `taskId` and `cursor` are always injected into `inputs` by the platform
  — you do not need to declare them in `input` (though declaring `cursor`
  lets you set a `default`).

## Complete Example

Given this `workflow.yaml`:

```yaml
id: "wf-doc-review-001"
name: "document-review"
metadata:
  title: "Document Review"
  version: 1
  description: "AI-powered document review"
  author: "Team"
  category: "documents"
  tags: ["review"]
  icon: "document"
  created: "2024-01-01"
  updated: "2024-01-01"

status:
  enabled: true
  visible: true

spec:
  services:
    notification_rules: []
    cost_limits:
      max: 0.50
      alertAt: 0.40

  groups:
    - id: "reviewers"
      name: "Document Reviewers"
      description: "Can review and approve documents"
      domain: "work"
      role_match: "reviewer"
      type: "custom"

  steps:
    - id: "upload"
      workflowId: "wf-doc-review-001"
      name: "Upload"
      type: 'workflow-entry'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "analyze"

    - id: "analyze"
      workflowId: "wf-doc-review-001"
      name: "AI Analysis"
      type: 'workflow-step'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "comparison"
          variable: "confidence"
          operator: "gte"
          constant: "0.95"
          target_true: "approved"
          target_false: "review"

    - id: "review"
      workflowId: "wf-doc-review-001"
      name: "Human Review"
      type: 'workflow-step'
      permissions:
        required_groups: ["reviewers"]
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "approved"

    - id: "approved"
      workflowId: "wf-doc-review-001"
      name: "Approved"
      type: 'workflow-terminator'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "upload"
```

The matching `bundle.yaml`:

```yaml
workflowId: 'wf-doc-review-001'
workflowVersion: 1
name: document-review
version: 1

steps:
  # Customer uploads document
  - id: "upload"
    route: '/upload'
    domain: 'app'
    ui:
      css: 'static/document-review.css'
      script: 'static/document-review.js'
      dynamic: 'ui/upload-form.ts'
    api:
      - route_match: '/submit'
        file: 'api/submit-document.ts'
        input:
          - name: 'title'
            type: 'string'
        output:
          - name: 'documentId'
            type: 'string'

  # AI analyzes document (work domain - any worker with group access can process)
  - id: "analyze"
    route: '/analyze'
    domain: 'work'
    ui:
      css: ''
      script: ''
      dynamic: 'ui/ai-context.ts'
    api:
      - route_match: '/'
        file: 'api/analyze-document.ts'
        input:
          - name: 'documentId'
            type: 'string'
        output:
          - name: 'confidence'
            type: 'number'

  # Human review queue
  - id: "review"
    route: '/review'
    domain: 'work'
    ui:
      css: 'static/document-review.css'
      script: 'static/document-review.js'
      dynamic: 'ui/review-queue.ts'
    api:
      - route_match: '/'
        file: 'api/get-review-item.ts'
        input: []
        output:
          - name: 'documentId'
            type: 'string'
      - route_match: '/approve'
        file: 'api/approve-document.ts'
        input:
          - name: 'documentId'
            type: 'string'
          - name: 'decision'
            type: 'string'
            enum: ['approve', 'reject']
          - name: 'notes'
            type: 'string'
        output:
          - name: 'documentId'
            type: 'string'

  # Results page
  - id: "approved"
    route: '/approved'
    domain: 'app'
    ui:
      css: 'static/document-review.css'
      script: ''
      dynamic: 'ui/approved.ts'
    api: []
```

## URL Structure

Full URLs are constructed as:

```
https://{workflow}.{tenant}.aihf.{domain}{route}{route_match}
```

**Example:**
- Workflow: `document-review`
- Tenant: `acme`
- Step route: `/upload`
- API route_match: `/submit`

Results in:
- UI: `https://document-review.acme.aihf.app/upload`
- API: `https://document-review.acme.aihf.app/upload/submit`

## Work Domain Steps

Work domain steps (`domain: 'work'`) are for internal processing -- analysis, review, background tasks. Any worker (AI or human) with the appropriate group membership can process these tasks.

```yaml
- id: "analyze"
  route: '/analyze'
  domain: 'work'
  ui:
    css: ''
    script: ''
    dynamic: 'ui/analysis-context.ts'
  api:
    - route_match: '/'
      file: 'api/analyze.ts'
      input: []
      output:
        - name: 'confidence'
          type: 'number'
```

**AI and Human Workers Are Equal**: AIHF treats AI entities and human entities identically. The AI Worker Service runs on a cron schedule and processes tasks in parallel, so AI workers naturally field work domain tasks faster. But a human worker with the right group membership can process the same tasks.

## Best Practices

1. **Match IDs exactly**: Step IDs must match between workflow.yaml and bundle.yaml
2. **Use consistent routes**: Route paths should be intuitive and RESTful
3. **Document inputs/outputs**: Always specify input/output parameter arrays (use empty arrays if none)
4. **Group shared assets**: Use common CSS/JS files across related steps
5. **Separate concerns**: API handlers do logic, UI files do rendering
6. **Remember type constraints**: Input/output types are `'string'`, `'number'`, `'boolean'`, or `'Response'` (SSE marker only)
7. **Use SSE handlers only for streaming output**: Declare `output: [{ name: 'SSE', type: 'Response' }]` only for live kernel feeds, chat streams, or progress tickers. Never use SSE handlers for step transitions or task-state mutations — keep those on a regular (non-SSE) handler on the same step.
8. **The `'Response'` type is the SSE opt-in marker**: It is only valid as the single `output[0]` entry with `name: 'SSE'`. Using it elsewhere (as an input, as a non-SSE output, or alongside other outputs) is rejected by `aihf validate` and by the runtime dispatcher.

## Related Documentation

- [Workflow.yaml Reference](./WORKFLOW_YAML.md) - Flow and routing logic
- [Config.json Guide](./CONFIG_JSON.md) - Workflow configuration
- [Workflow Initialization](./INIT_WORKFLOW.md) - Database setup and data migration
- [SDK Reference](./SDK_REFERENCE.md) - Handler implementation
- [AI Workers Guide](./AI_WORKERS.md) - Work domain automation
