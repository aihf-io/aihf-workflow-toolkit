# AIHF.io Platform SDK

**Where AI and Human Expertise Converge**

[![npm version](https://badge.fury.io/js/@aihf%2Fplatform-sdk.svg)](https://www.npmjs.com/package/@aihf/platform-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## From Concept to Code

You've seen [aihf.io](https://aihf.io) — the vision of cognitive partnerships between AI and human intelligence. This SDK is how you build them.

AIHF.io (**AI-Human Framework**) creates workflows where AI handles the routine and humans handle the exceptional. Instead of building separate systems for AI automation and human review, you get a unified platform where:

- **AI Workers** automatically process tasks using Claude
- **Human Reviewers** handle edge cases that need judgment
- **Customers** interact through polished web interfaces
- **Everything** is tenant-isolated, audit-logged, and production-ready

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AIHF.io Platform                             │
│                                                                      │
│   Customer Experience          AI Automation          Human Review   │
│   ┌─────────────────┐         ┌─────────────┐       ┌─────────────┐ │
│   │                 │         │             │       │             │ │
│   │  Upload Form    │────────▶│ AI Worker   │──────▶│ Review UI   │ │
│   │  Dashboard      │         │ (Claude)    │       │ Approve/Fix │ │
│   │  Results Page   │◀────────│ Auto-decide │◀──────│             │ │
│   │                 │         │             │       │             │ │
│   └─────────────────┘         └─────────────┘       └─────────────┘ │
│         app domain               work domain          work domain    │
│                                                                      │
│   Built-in: Auth · Payments · Database · Files · Email · Containers · Utilities  │
└─────────────────────────────────────────────────────────────────────┘
```

### Why AIHF.io?

> *"AI catches patterns humans miss. Humans provide judgment AI can't replicate. Together, they create capabilities that didn't exist before."*

| The Old Way | The AIHF Way |
|-------------|--------------|
| Build separate AI pipeline and web app | Single workflow handles both |
| Manual infrastructure for queues, retries | Platform handles orchestration |
| DIY auth, payments, file storage | Built-in SDK for everything |
| Cobble together AI + human handoffs | Native Human-in-the-Loop support |
| Weeks of integration work | Deploy in hours |

---

## The Two-Domain Model

Every AIHF.io workflow uses two domains:

| Domain | Purpose | Who Uses It |
|--------|---------|-------------|
| **app** (`workflow.tenant.aihf.app`) | Customer-facing UI and APIs | End users (human or AI) |
| **work** (`workflow.tenant.aihf.work`) | Internal processing and review | Workers (human or AI) |

**App domain** = customer-facing (forms, dashboards, results)
**Work domain** = internal processing (analysis, review, background tasks)

### AI and Human Workers Are Equal

AIHF treats AI and human workers identically. Both are entities with group memberships that determine which steps they can access. The difference is speed: the **AI Worker Service** runs on a cron schedule and processes tasks in parallel, so AI workers field work domain tasks faster than humans can manually.

This means:
- A human can process an "AI task" if they have the right group membership
- An AI can process a "human review task" if configured to do so
- Developers use judgment on which steps each is cognitively suited for

---

## Quick Start

### 1. Install the CLI

```bash
npm install -g @aihf/platform-sdk
```

### 2. Create Your First Workflow

```bash
aihf init my-workflow --template basic-workflow
cd my-workflow
```

### 3. Explore the Structure

```
my-workflow/
├── workflow.yaml           # Workflow definition, including steps
├── bundle.yaml             # Workflow manifest for each step
├── config/config.json      # Tenant-configurable settings
└── src/
    ├── initWorkflow.ts     # Database/resource initialization
    ├── api/                # API handlers
    │   └── submit.ts
    ├── ui/                 # UI renderers
    │   └── main.ts
    └── static/             # Static CSS and JS assets
        ├── mystyle.css
        └── myfunctions.js
```

### 4. Build and Deploy

```bash
aihf compile .           # Compile TypeScript
aihf validate .          # Validate structure
aihf bundle .            # Create deployment ZIP
```

Upload the ZIP at [admin.aihf.io](https://admin.aihf.io).


## How Workflows Work

AIHF workflows use two YAML files that work together:

| File | Purpose |
|------|---------|
| **workflow.yaml** | Defines workflow metadata, authorization groups, steps, and routing conditions |
| **bundle.yaml** | Defines implementation details: routes, domains, UI files, API handlers |

### workflow.yaml - Define the Flow

```yaml
name: "document-review"
metadata:
  title: "Document Review Workflow"
  version: 1
  description: "AI-powered document analysis with human review"
  category: "documents"

status:
  enabled: true
  visible: true
  workerVisible: true

spec:
  services:
    notification_rules: ["APP_2_APP"]
    cost_limits:
      max: 0.50
      alertAt: 0.40
  features: ['aihfControlApp2AppTransitions']  # Enable auto app-to-app transitions

  groups:
    - id: "reviewers"
      name: "Document Reviewers"

  steps:
    - id: "upload"
      name: "Upload Document"
      type: 'workflow-entry'
      permissions:
        required_groups: []
        # AIHF virtual groups 'aihf-customer' (for app domain) & 'aihf-worker' (for work domain) to reduce group management overhead
        allow_virtual_group: true 
      conditions:
        - type: "default"
          target_true: "analyze"

    - id: "analyze"
      name: "AI Analysis"
      type: 'workflow-step'
      timeout_minutes: 5
      permissions:
        required_groups: []
        allow_virtual_group: true
      conditions:
        - type: "comparison"
          operator: "gte"
          variable: "confidence"
          constant: 0.95
          target_true: "results"
          target_false: "review"

    - id: "review"
      name: "Human Review"
      type: 'workflow-step'
      permissions:
        required_groups: ["reviewers"]
        allow_virtual_group: false
      conditions:
        - type: "default"
          target_true: "results"

    - id: "results"
      name: "View Results"
      type: 'workflow-terminator'
      permissions:
        required_groups: []
        allow_virtual_group: true
```

### bundle.yaml - Define the Implementation

```yaml
name: document-review
version: 1

steps:
  - id: "upload"
    route: '/upload'
    domain: 'app'
    ui:
      script: 'ui/myfunctions.js'
      css: 'ui/mycss.css'
      dynamic: 'ui/upload-form.ts'
    api:
      - route_match: '/submit'
        file: 'api/submit-document.ts'
        input:
          - name: 'document'
            type: 'file'
        output:
          - name: 'documentId'
            type: 'string'

  - id: "analyze"
    route: '/analyze'
    domain: 'work'
    api:
      - route_match: '/aihf-ai-step'
        file: 'api/analyze-document.ts'
        output:
          - name: 'confidence'
            type: 'number'
          - name: 'hasWork'
            type: 'boolean'

  - id: "review"
    route: '/review'
    domain: 'work'
    ui:
      script: 'ui/myfunctions.js'
      css: 'ui/mycss.css'
      dynamic: 'ui/review-queue.ts'
    api:
      - route_match: '/approve'
        file: 'api/approve.ts'

  - id: "results"
    route: '/results'
    domain: 'app'
    ui:
      script: 'ui/myfunctions.js'
      css: 'ui/mycss.css'
      dynamic: 'ui/results.ts'
```

### Write Handlers with the Platform SDK

```typescript
// src/api/submit-document.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { document } = JSON.parse(sanitisedInput);

  // Store document
  const docId = crypto.randomUUID();
  await sdk.files.upload(`documents/${docId}`, document);

  // Store step data for the next step to consume
  sdk.tasks.setStepData(JSON.stringify({ documentId: docId }));

  return new Response(JSON.stringify({
    success: true,
    message: 'Document submitted for analysis'
  }));
}
```

### AI Worker Executes Work Steps

The AI Worker Service automatically:
1. Polls for tasks on `domain: 'work'` steps
2. Executes your handler code
3. Routes to human review when confidence is low
4. Tracks everything for audit compliance

```typescript
// src/api/analyze-document.ts
export async function invokedByAIHF(sdk: AIHFPlatform, ...args) {
  const { documentId } = JSON.parse(sanitisedInput);

  // Your analysis logic here
  const analysis = await analyzeDocument(sdk, documentId);

  // Store results for the next step (routing is defined in workflow.yaml conditions)
  sdk.tasks.setStepData(JSON.stringify({ documentId, analysis, confidence: analysis.confidence }));

  return new Response(JSON.stringify({ hasWork: true, confidence: analysis.confidence }));
}
```

---

## Platform SDK

The SDK provides everything you need:

```typescript
// Users & Entities
sdk.entities.getCurrentEntity()           // Current authenticated user
sdk.entities.getEntity(entityId)          // Get entity by ID
sdk.entities.findByUsername(username)      // Find by username (admin only)
sdk.entities.updateEntity(entityId, data) // Update entity fields

// Database (Cloudflare D1 — raw SQL)
sdk.database.query(workflow, sql, params)     // SELECT queries
sdk.database.execute(workflow, sql, params)   // INSERT/UPDATE/DELETE
sdk.database.insert(workflow, table, data)    // Convenience insert
sdk.database.update(workflow, table, data, where, whereParams) // Convenience update

// Files (Cloudflare R2 — path-based)
sdk.files.upload(filePath, content)       // Upload file
sdk.files.download(filePath)              // Download file (ReadableStream)
sdk.files.list(folderPath)               // List files in folder
sdk.files.getMetadata(filePath)          // Get file metadata

// Payments (Stripe)
sdk.billing.createCheckoutSession(options)
sdk.billing.getSubscription(entityId)

// Authentication
sdk.auth.createMagicLink({ entityId, workflowName, workflowVersion, stepId })

// OAuth (via Credentials Manager)
sdk.credentials.initiateOAuth(provider, redirectUri)
sdk.credentials.completeOAuth(provider, code, state)

// Tasks & Step Data
sdk.tasks.setStepData(data)              // Store data for next step
sdk.tasks.getStepData()                  // Retrieve step data
sdk.tasks.getTask(taskId)               // Get task details

// Workflow Config
sdk.workflows.getWorkflowConfigHelper(name, version)  // Typed config access

// Utilities (9 sub-managers)
sdk.utilities.documents.parse(buffer, format)       // Parse DOCX/DOC/RTF
sdk.utilities.spreadsheets.parse(buffer, format)    // Parse XLSX/CSV
sdk.utilities.pdfs.extractPages(buffer)             // Extract PDF pages
sdk.utilities.images.getMetadata(buffer)            // Image metadata
sdk.utilities.tensors.analyze(tensor)               // Tensor analysis
sdk.utilities.diagrams.create(definition)           // Mermaid diagrams
sdk.utilities.calendar.buildMonthGrid(year, month)  // Calendar grid
sdk.utilities.waves.fft(data)                       // Signal processing
sdk.utilities.ui.documentEditor(options)            // UI fragments

// Email
sdk.emails.send({ to, subject, bodyHtml })

// Containers (sandboxed compute — Jupyter, Python, Node.js)
sdk.containers.launch(config)                    // Launch container session
sdk.containers.writeFiles(sessionId, files)      // Write files into container
sdk.containers.installRequirements(sessionId, cfg) // Install Python packages
sdk.containers.signalReady(sessionId)            // Start app (e.g. Jupyter)
sdk.containers.execute(sessionId, code)          // Execute code on kernel
sdk.containers.getOutput(sessionId, cursor)      // Poll kernel output
sdk.containers.status(sessionId)                 // Container lifecycle status
sdk.containers.stop(sessionId)                   // Stop and clean up
```

---

## Documentation

### Start Here

| Guide | Description |
|-------|-------------|
| [Getting Started](./docs/GETTING_STARTED.md) | Build your first workflow step-by-step |
| [Workflow Concepts](./docs/WORKFLOW_CONCEPTS.md) | Understand tasks, steps, domains, and the AI-Human model |
| [Configuration](./docs/CONFIGURATION.md) | Set up admin.aihf.io, secrets, and environments |

### Reference

| Guide | Description |
|-------|-------------|
| [Workflow.yaml Reference](./docs/WORKFLOW_YAML.md) | Steps, conditions, permissions, and routing logic |
| [Bundle.yaml Reference](./docs/BUNDLE_YAML.md) | Routes, domains, UI files, and API handlers |
| [Config.json Guide](./docs/CONFIG_JSON.md) | Tenant-configurable settings (fields-based format) |
| [Workflow Initialization](./docs/INIT_WORKFLOW.md) | Database setup, data seeding, and version migrations |
| [SDK Reference](./docs/SDK_REFERENCE.md) | Full API documentation for all SDK methods |

### Features

| Guide | Description |
|-------|-------------|
| [Authentication](./docs/AUTHENTICATION.md) | OAuth (Google/Apple/EntraID), Magic Links |
| [Payments](./docs/PAYMENTS.md) | Stripe checkout, subscriptions, billing portal |
| [AI Workers](./docs/AI_WORKERS.md) | Work domain automation and the AI Worker Service |
| [Prompt Evaluation](./docs/PROMPT_EVAL.md) | Test and tune AI instruction prompts before deployment |
| [Utilities](./docs/UTILITIES.md) | PDF, Excel, Word, and image processing |
| [Custom Landing Pages](./docs/CUSTOM_LANDING_PAGES.md) | Tenant-specific App Portal landing pages |
| [Containers](./docs/CONTAINERS.md) | Sandboxed Jupyter, Python, and Node.js compute environments |

---

## Zero to Hero: Build Your First Workflow

This walkthrough takes you from zero to a compiled, deployable workflow bundle. By the end you'll understand the full development cycle.

### Step 1: Install and Scaffold

```bash
npm install -g @aihf/platform-sdk
aihf init expense-review --template basic-workflow
cd expense-review
```

This creates:

```
expense-review/
├── workflow.yaml           # Defines steps, groups, routing conditions
├── bundle.yaml             # Maps each step to handler files + routes
├── config/config.json      # Admin-configurable settings
├── package.json
└── src/
    ├── api/submit.ts       # API handler (runs server-side)
    ├── ui/main.ts          # UI renderer (generates HTML)
    └── static/
        ├── mystyle.css     # Served to the browser
        └── myfunctions.js  # Client-side JS
```

No `tsconfig.json` — the CLI generates it at compile time with the correct SDK type paths.

### Step 2: Define the Workflow (workflow.yaml)

Edit `workflow.yaml` to define your steps and routing:

```yaml
name: expense-review
metadata:
  title: "Expense Review"
  version: 1
  description: "Submit expenses for AI review with human escalation"
  category: "finance"
  author: "Your Team"
  tags: [expenses, review]
  icon: "receipt"
  created: "2025-02-01"
  updated: "2025-02-01"

status:
  enabled: true
  visible: true
  workerVisible: true

spec:
  services:
    notification_rules: ["APP_2_APP"]
    cost_limits: { max: 0.50, alertAt: 0.40 }

  groups:
    - id: reviewers
      name: "Expense Reviewers"
      description: "Human reviewers for flagged expenses"
      domain: work
      role_match: "reviewer"
      type: custom

  steps:
    - id: submit
      name: "Submit Expense"
      type: workflow-entry
      permissions:
        required_groups: []
        allow_virtual_group: true
      conditions:
        - type: default
          target_true: ai-check

    - id: ai-check
      name: "AI Compliance Check"
      type: workflow-step
      timeout_minutes: 2
      permissions:
        required_groups: []
        allow_virtual_group: true
      conditions:
        - type: comparison
          operator: gte
          variable: confidence
          constant: "0.90"
          target_true: approved      # High confidence → auto-approve
          target_false: human-review  # Low confidence → escalate

    - id: human-review
      name: "Manual Review"
      type: workflow-step
      permissions:
        required_groups: [reviewers]
        allow_virtual_group: false
      conditions:
        - type: default
          target_true: approved

    - id: approved
      name: "Expense Approved"
      type: workflow-terminator
      permissions:
        required_groups: []
        allow_virtual_group: true
```

Key concept: **routing is declarative** — the `conditions` in workflow.yaml decide the next step based on output variables. Your handler code just returns values; it never decides navigation.

### Step 3: Map Steps to Handlers (bundle.yaml)

Edit `bundle.yaml` to wire each step to its code:

```yaml
name: expense-review
version: 1

steps:
  - id: submit
    route: /submit
    domain: app              # Customer-facing
    ui:
      css: "ui/mystyle.css"
      script: "ui/myfunctions.js"
      dynamic: "ui/submit-form.ts"
    api:
      - route_match: /submit
        file: "api/submit-expense.ts"
        input:
          - name: amount
            type: number
          - name: description
            type: string
        output:
          - name: expenseId
            type: string

  - id: ai-check
    route: /ai-check
    domain: work             # Internal processing
    api:
      - route_match: /aihf-ai-step
        file: "api/ai-check.ts"
        output:
          - name: confidence
            type: number

  - id: human-review
    route: /human-review
    domain: work
    ui:
      css: "ui/mystyle.css"
      script: "ui/myfunctions.js"
      dynamic: "ui/review.ts"
    api:
      - route_match: /approve
        file: "api/approve.ts"

  - id: approved
    route: /approved
    domain: app
    ui:
      css: "ui/mystyle.css"
      script: "ui/myfunctions.js"
      dynamic: "ui/approved.ts"
    api: []
```

### Step 4: Write an API Handler

API handlers have a fixed signature. The SDK is injected by the platform:

```typescript
// src/api/submit-expense.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {

  const { amount, description } = JSON.parse(sanitisedInput);

  // Store in tenant database
  const expenseId = crypto.randomUUID();
  await sdk.database.insert(workflowName, 'expenses', {
    id: expenseId,
    amount,
    description,
    submitted_by: (await sdk.entities.getCurrentEntity())?.entity_id,
    submitted_at: Date.now()
  });

  // Pass data to next step via setStepData
  sdk.tasks.setStepData(JSON.stringify({ expenseId, amount, description }));

  return new Response(JSON.stringify({ success: true, expenseId }));
}
```

### Step 5: Write a UI Renderer

UI handlers return HTML that the platform serves to the browser:

```typescript
// src/ui/submit-form.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {

  const entity = await sdk.getSelfEntity();
  const name = entity?.profile?.display_name || 'there';

  const html = `
    <h2>Submit Expense</h2>
    <p>Hi ${name}, submit your expense for review.</p>
    <form method="POST" action="/submit">
      <input type="hidden" name="taskId" value="${taskId}" />
      <label>Amount ($)</label>
      <input type="number" name="amount" step="0.01" required />
      <label>Description</label>
      <textarea name="description" required></textarea>
      <button type="submit">Submit</button>
    </form>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### Step 6: Initialize the Database (Optional)

If your workflow needs database tables, add an `initWorkflow.ts`:

```typescript
// src/initWorkflow.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  await sdk.database.execute(workflowName,
    `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT,
      submitted_by TEXT,
      submitted_at INTEGER,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      status TEXT DEFAULT 'pending'
    )`
  );
  return 'Database initialized';
}
```

### Step 7: Compile, Validate, Bundle

```bash
# Install TypeScript (if not already in node_modules)
npm install

# Compile — generates tsconfig.json, compiles TS → JS into dist/
aihf compile .

# Validate — checks bundle.yaml matches workflow.yaml, handler signatures, etc.
aihf validate .

# Bundle — creates a ZIP for deployment
aihf bundle .
```

The compiled output lands in `dist/src/api/` and `dist/src/ui/` — these `.js` files are what the gateway imports at runtime.

### Step 8: Deploy

Upload your ZIP bundle at **admin.aihf.io**:

1. Log into your tenant's admin portal
2. Navigate to **Workflows > Deploy Bundle**
3. Upload the ZIP
4. The platform extracts your compiled JS into `workers/gateway/src/workflows/{name}/{version}/dist/`
5. wrangler's `find_additional_modules = true` discovers your handlers automatically

Your workflow is now live. Customers see it on `app.{tenant}.aihf.io` and workers process tasks on `work.{tenant}.aihf.io`.

---

## Other Examples

Complete working examples in the [`examples/`](./examples/) directory:

| Example | What It Demonstrates |
|---------|----------------------|
| [onboarding-workflow](./examples/onboarding-workflow/) | Multi-step signup with email verification |
| [payment-integration](./examples/payment-integration/) | Stripe checkout and subscription management |
| [oauth-signup](./examples/oauth-signup/) | Google/Apple OAuth authentication |
| [ai-worker-task](./examples/ai-worker-task/) | Document analysis with AI + human review |
| [office-utilities](./examples/office-utilities/) | PDF generation, spreadsheet parsing |

---

## CLI Commands

```bash
aihf init <name>                    # Create workflow from template
aihf init <name> --type multi-part  # Create multi-workflow suite
aihf init <name> --suite <path>     # Add workflow to existing suite
aihf compile [path]                 # Compile TypeScript
aihf compile-suite [path]           # Compile all workflows in a suite
aihf validate [path]                # Validate bundle structure
aihf validate --suite [path]        # Validate all bundles in a suite
aihf bundle [path]                  # Create deployment ZIP
aihf eval [path]                    # Evaluate AI instruction prompts
```

### Prompt Evaluation

Test and tune your AI instruction prompts before deploying to production:

```bash
# Evaluate an instruction against test scenarios
aihf eval ./my-workflow \
  --instructions src/instructions/analysis.instruction.yaml \
  --dataset test-data/scenarios.json \
  --runs 5

# Compare models
aihf eval . -i src/instructions/analysis.instruction.yaml \
  -d test-data/scenarios.json -m claude-haiku-4-5-20251001

# Save report to file
aihf eval . -i src/instructions/analysis.instruction.yaml \
  -d test-data/scenarios.json -o report.json --verbose
```

See the [Prompt Evaluation Guide](./docs/PROMPT_EVAL.md) for full documentation.

### Workflow Types

```bash
# Isolated workflow (default)
aihf init my-app --template basic-workflow   # Simple single-step
aihf init my-app --template full-stack       # Multi-step with database

# Multi-part suite (shared code across workflows)
aihf init my-product --type multi-part       # Create suite root
cd my-product
aihf init signup --suite .                   # Add workflow bundle
aihf init dashboard --suite .                # Add another
aihf compile-suite .                         # Compile all
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Workflow Bundle                      │
│  ┌──────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │workflow.yaml │ │ bundle.yaml │ │config.json  │           │
│  │ (flow logic) │ │ (manifest)  │ │ (settings)  │           │
│  └──────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────────────────────────────────────┐            │
│  │                    src/                      │            │
│  │   api/*.ts (handlers)    ui/*.ts (renderers)│            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AIHF.io Platform                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Gateway  │ │ AI Worker│ │Container │ │ Database │ │ Storage  │ │
│  │ (routing)│ │ Service  │ │ Service  │ │   (D1)   │ │   (R2)   │ │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ │
│  │ Auth     │ │ Claude   │ │ Jupyter  │ │ Stripe   │ │ Email    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Security-First Architecture

Built with defense in depth from day one:

- **Cloudflare Edge**: DDoS protection, WAF, and global distribution
- **Tenant Isolation**: Separate data stores per organization
- **Level-Up Authentication**: Step-up auth for sensitive operations (TOTP, OAuth, FIDO2)
- **Audit Everything**: Complete trail of every action for compliance
- **Encrypted Storage**: Secrets stored encrypted, never in code

---

## Requirements

- Node.js 18+
- AIHF.io tenant account — [Sign up at aihf.io](https://aihf.io)

---

## Support

- [Documentation](https://docs.aihf.io)
- [GitHub Issues](https://github.com/aihf-io/platform-sdk/issues)
- Email: support@aihf.io

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
