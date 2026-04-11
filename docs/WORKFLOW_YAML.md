# Workflow.yaml Reference

The `workflow.yaml` file defines your workflow's identity, metadata, authorization groups, steps, and routing logic.

## WorkflowDefinition Schema

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  internal?: boolean;
  metadata: {
    title: string;
    version: number;
    description: string;
    author: string;
    category: string;
    tags: string[];
    icon: string;
    created: string;
    updated: string;
  };
  status: {
    enabled: boolean;
    visible: boolean;
    workerVisible?: boolean;
  };
  spec: {
    services: {
      notification_rules: string[];
      cost_limits: { max: number; alertAt: number };
      features?: string[];
    };
    groups: WorkflowGroup[];
    steps: WorkflowStep[];
  };
}
```

## File Structure

```yaml
# Identity
id: "unique-workflow-id"
name: "my-workflow"

# Metadata
metadata:
  title: "My Workflow"
  version: 1
  description: "What this workflow does"
  author: "Your Name"
  category: "category-name"
  tags: ["tag1", "tag2"]
  icon: "icon-name"
  created: "2024-01-01"
  updated: "2024-01-01"

# Status Control
status:
  enabled: true
  visible: true
  workerVisible: false

# Specification
spec:
  services:
    notification_rules: []
    cost_limits:
      max: 0.50
      alertAt: 0.40
    features: []

  groups: []

  steps: []
```

## Sections

### Top-Level Identity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique workflow identifier (UUID or custom ID) |
| `name` | string | Yes | Workflow name (lowercase, hyphens) |
| `internal` | boolean | No | Whether this is an internal/system workflow |

### Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata.title` | string | Yes | Human-readable workflow title |
| `metadata.version` | number | Yes | Workflow version number |
| `metadata.description` | string | Yes | Detailed description |
| `metadata.author` | string | Yes | Author name or team |
| `metadata.category` | string | Yes | Workflow category |
| `metadata.tags` | string[] | Yes | Searchable tags |
| `metadata.icon` | string | Yes | Icon identifier |
| `metadata.created` | string | Yes | Creation date (YYYY-MM-DD) |
| `metadata.updated` | string | Yes | Last update date (YYYY-MM-DD) |

### Status

Controls workflow visibility and availability:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | true | Whether workflow is active |
| `visible` | boolean | true | Visible in customer portal |
| `workerVisible` | boolean | true | Visible in worker portal (defaults to true if undefined) |

### Spec: Services

Platform service configuration:

```yaml
spec:
  services:
    notification_rules:
      - "APP_2_APP"     # Between users
      - "APP_2_WORK"    # User to worker
      - "WORK_2_APP"    # Worker to user

    cost_limits:
      max: 0.50         # Maximum cost per execution
      alertAt: 0.40     # Alert threshold

    features:
      - 'aihfControlApp2AppTransitions'
      - 'aihfControlWorkAssignment'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notification_rules` | string[] | Yes | Notification routing rules |
| `cost_limits.max` | number | Yes | Maximum cost per execution |
| `cost_limits.alertAt` | number | Yes | Cost alert threshold |
| `features` | string[] | No | AIHF platform features to enable |

### Spec: Groups

Define authorization groups for step permissions. Each group has an `id`, `name`, `description`, `domain`, `role_match`, and `type`:

```typescript
interface WorkflowGroup {
  id: string;
  name: string;
  description: string;
  domain: string;
  role_match: string;    // Can also be applied to saml_attribute_match
  type: 'custom' | 'virtual' | 'built-in';
}
```

```yaml
spec:
  groups:
    - id: "reviewers"
      name: "Document Reviewers"
      description: "Can review and approve documents"
      domain: "work"
      role_match: "reviewer"
      type: "custom"

    - id: "managers"
      name: "Finance Managers"
      description: "Final approval authority"
      domain: "work"
      role_match: "manager"
      type: "custom"

    - id: "customers"
      name: "Customers"
      description: "End-user customers"
      domain: "app"
      role_match: "customer"
      type: "built-in"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique group identifier |
| `name` | string | Yes | Human-readable group name |
| `description` | string | Yes | Group purpose description |
| `domain` | string | Yes | Domain scope (`'app'` or `'work'`) |
| `role_match` | string | Yes | Role name to match (also used for SAML attribute matching) |
| `type` | string | Yes | `'custom'`, `'virtual'`, or `'built-in'` |

### Spec: Steps

Define workflow steps with their routing logic:

```typescript
interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  description?: string;
  type: 'workflow-entry' | 'workflow-step' | 'workflow-terminator'
      | 'sub-workflow-entry' | 'sub-workflow-invoke' | 'worker-initiate';
  permissions: {
    required_groups: string[];
    allow_virtual_group: boolean;
    required_level?: number;
  };
  timeout_minutes?: number;
  retry_policy?: {
    max_attempts: number;
    backoff_strategy: 'linear' | 'exponential' | 'fixed';
    backoff_seconds: number;
    retry_on?: string[];
  };
  condition?: WorkflowStepCondition[];
  conditions?: WorkflowStepCondition[];   // Plural form (workflow.yaml compatibility)
}
```

```yaml
spec:
  steps:
    - id: "step-id"
      workflowId: "workflow-id"
      name: "Step Name"
      description: "What this step does"
      type: 'workflow-step'
      permissions:
        required_groups: []
        allow_virtual_group: false
        required_level: 1
      timeout_minutes: 30
      retry_policy:
        max_attempts: 3
        backoff_strategy: 'exponential'
        backoff_seconds: 10
        retry_on: ['timeout', 'rate_limit']
      conditions:
        - type: "default"
          target_true: "next-step"
```

## Step Configuration

### Step Types

| Type | Description |
|------|-------------|
| `workflow-entry` | Customer-initiated entry point -- where the workflow begins when a customer visits the app domain |
| `workflow-step` | Standard processing step (app or work domain) |
| `workflow-terminator` | End point -- workflow completes here (no further transitions) |
| `worker-initiate` | Worker-initiated entry point -- the Campaign Initiator creates tasks starting here on a schedule (see [AI Workers Guide](./AI_WORKERS.md)) |
| `sub-workflow-entry` | Entry point for a nested sub-workflow |
| `sub-workflow-invoke` | Invokes a sub-workflow (acts as terminator for current workflow) |

Every workflow must have at least one entry point (`workflow-entry`, `worker-initiate`, or `sub-workflow-entry`). A workflow can have multiple `worker-initiate` steps — each gets its own independent task.

### Step Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique step identifier |
| `workflowId` | string | Yes | Parent workflow ID (matches WorkflowDefinition.id) |
| `name` | string | Yes | Human-readable step name |
| `description` | string | No | Optional description for context |
| `type` | string | Yes | Step type (see above) |
| `permissions` | object | Yes | Access control |
| `timeout_minutes` | number | No | Step timeout in minutes |
| `retry_policy` | object | No | Retry configuration |
| `conditions` | array | Yes | Routing conditions |

### Permissions

Control who can access a step:

```yaml
permissions:
  required_groups: ["reviewers"]  # User must be in these groups
  allow_virtual_group: true       # Allow virtual group members
  required_level: 2               # Optional: minimum authorization level
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `required_groups` | string[] | Yes | Group IDs the user must belong to |
| `allow_virtual_group` | boolean | Yes | Whether virtual group members can access |
| `required_level` | number | No | Minimum authorization level required |

### Retry Policy

Configure automatic retry behavior for failed steps:

```yaml
retry_policy:
  max_attempts: 3
  backoff_strategy: 'exponential'
  backoff_seconds: 10
  retry_on: ['timeout', 'rate_limit']
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_attempts` | number | Yes | Maximum number of retry attempts |
| `backoff_strategy` | string | Yes | `'linear'`, `'exponential'`, or `'fixed'` |
| `backoff_seconds` | number | Yes | Base backoff interval in seconds |
| `retry_on` | string[] | No | Error types that trigger a retry |

### Conditions

Define how the workflow routes between steps. Both `condition` (singular) and `conditions` (plural) are supported.

#### Default Condition

Always routes to target:

```yaml
conditions:
  - type: "default"
    target_true: "next-step"
```

#### Comparison Condition

Routes based on variable comparison:

```yaml
conditions:
  - type: "comparison"
    operator: "equals"
    variable: "status"
    constant: "approved"
    target_true: "approved-step"
    target_false: "rejected-step"
```

Operators (multiple aliases supported):
- `eq` / `equals` -- Equality
- `ne` / `notEquals` / `not_equals` -- Inequality
- `gt` / `greaterThan` / `greater_than` -- Greater than
- `gte` / `greaterThanOrEquals` / `greater_than_or_equals` -- Greater than or equal
- `lt` / `lessThan` / `less_than` -- Less than
- `lte` / `lessThanOrEquals` / `less_than_or_equals` -- Less than or equal
- `contains` -- Contains check
- `matches` -- Pattern matching
- `and` / `or` / `not` -- Logical operators

#### Options Condition

Routes based on user selection:

```yaml
conditions:
  - type: "options"
    variable: "action"
    options:
      - option: "approve"
        target: "approved-step"
      - option: "reject"
        target: "rejected-step"
      - option: "review"
        target: "review-step"
    target_true: "default-step"  # If no option matches
```

#### Dynamic Condition

When `target_dynamic` is `true`, the platform calls the `getNextAIHFStepId` handler exported by the step's bundle code to determine the next step at runtime:

```yaml
conditions:
  - type: "default"
    target_true: "fallback-step"
    target_dynamic: true
```

## Complete Example

```yaml
id: "wf-invoice-approval-001"
name: "invoice-approval"
metadata:
  title: "Invoice Approval Workflow"
  version: 1
  description: "AI-powered invoice validation with human review"
  author: "Finance Team"
  category: "finance"
  tags: ["invoices", "ai-powered", "approval"]
  icon: "receipt"
  created: "2024-01-01"
  updated: "2024-06-15"

status:
  enabled: true
  visible: true
  workerVisible: true

spec:
  services:
    notification_rules: ["APP_2_APP", "WORK_2_APP"]
    cost_limits:
      max: 0.25
      alertAt: 0.20
    features:
      - 'aihfControlApp2AppTransitions'

  groups:
    - id: "finance-reviewers"
      name: "Finance Reviewers"
      description: "Can review flagged invoices"
      domain: "work"
      role_match: "finance-reviewer"
      type: "custom"

    - id: "finance-managers"
      name: "Finance Managers"
      description: "Final approval authority"
      domain: "work"
      role_match: "finance-manager"
      type: "custom"

  steps:
    # Entry: Upload invoice
    - id: "upload"
      workflowId: "wf-invoice-approval-001"
      name: "Upload Invoice"
      type: 'workflow-entry'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "ai-validate"

    # AI validation step
    - id: "ai-validate"
      workflowId: "wf-invoice-approval-001"
      name: "AI Validation"
      description: "AI analyzes the uploaded invoice for correctness"
      type: 'workflow-step'
      permissions:
        required_groups: []
        allow_virtual_group: false
      timeout_minutes: 5
      retry_policy:
        max_attempts: 2
        backoff_strategy: 'fixed'
        backoff_seconds: 5
      conditions:
        - type: "comparison"
          operator: "gte"
          variable: "confidence"
          constant: "0.95"
          target_true: "auto-approved"
          target_false: "human-review"

    # Human review for low-confidence
    - id: "human-review"
      workflowId: "wf-invoice-approval-001"
      name: "Human Review"
      description: "Manual review by finance team member"
      type: 'workflow-step'
      permissions:
        required_groups: ["finance-reviewers"]
        allow_virtual_group: false
      timeout_minutes: 1440  # 24 hours
      conditions:
        - type: "options"
          variable: "decision"
          options:
            - option: "approve"
              target: "manager-approval"
            - option: "reject"
              target: "rejected"
            - option: "request-changes"
              target: "upload"
          target_true: "human-review"

    # Manager final approval
    - id: "manager-approval"
      workflowId: "wf-invoice-approval-001"
      name: "Manager Approval"
      type: 'workflow-step'
      permissions:
        required_groups: ["finance-managers"]
        allow_virtual_group: false
        required_level: 2
      conditions:
        - type: "comparison"
          operator: "equals"
          variable: "approved"
          constant: "true"
          target_true: "approved"
          target_false: "rejected"

    # Auto-approved by AI
    - id: "auto-approved"
      workflowId: "wf-invoice-approval-001"
      name: "Auto-Approved"
      type: 'workflow-terminator'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "upload"

    # Manually approved
    - id: "approved"
      workflowId: "wf-invoice-approval-001"
      name: "Approved"
      type: 'workflow-terminator'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "upload"

    # Rejected
    - id: "rejected"
      workflowId: "wf-invoice-approval-001"
      name: "Rejected"
      type: 'workflow-terminator'
      permissions:
        required_groups: []
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "upload"
```

## Relationship with bundle.yaml

The `workflow.yaml` defines **what** the workflow does:
- Workflow identity (`id`, `name`)
- Step IDs, names, descriptions, and types
- Routing logic between steps (conditions)
- Permissions, timeouts, and retry policies
- Groups with domain, role_match, and type
- Service configuration (notifications, cost limits, features)

The `bundle.yaml` defines **how** it's implemented:
- Routes (URLs) for each step
- Domains (app vs work)
- UI file references (css, script, dynamic)
- API handler files and input/output parameter schemas

Each step `id` in workflow.yaml must have a matching step in bundle.yaml. The `workflowId` on each step must match the top-level `id`.

## Related Documentation

- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Implementation details
- [Config.json Guide](./CONFIG_JSON.md) - Workflow configuration
- [Workflow Initialization](./INIT_WORKFLOW.md) - Database setup and data migration
- [Workflow Concepts](./WORKFLOW_CONCEPTS.md) - Tasks, navigation, and multi-part suites
- [AI Workers Guide](./AI_WORKERS.md) - Work domain steps
