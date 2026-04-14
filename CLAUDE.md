# AIHF Workflow Development

This repository is an AIHF.io workflow bundle (or suite). Use this file to understand
the platform conventions before making changes.

## What AIHF.io Is

AIHF (AI-Human Framework) is a platform for building workflows where AI and humans
collaborate. Every workflow runs on the AIHF.io platform and is deployed via
`admin.aihf.io`.

Workflows have two domains:
- **app domain** (`workflow.tenant.aihf.app`) — customer-facing UI and APIs
- **work domain** (`workflow.tenant.aihf.work`) — internal processing, AI workers, human review

## SDK Import Rule

**Always import from `@aihf/platform-sdk`. Never import from any other AIHF internal path.**

```typescript
// ✅ Correct
import { AIHFPlatform } from '@aihf/platform-sdk';

// ❌ Wrong — no direct platform internals
import { something } from '../../../platform/...';
```

The `sdk` object is injected into your handlers by the platform — never instantiate
`AIHFPlatform` directly in handler code.

## Repository Structure

```
src/
├── api/           → API handlers (POST/GET endpoints, AI worker handlers)
├── ui/            → UI handlers (return HTML strings, customer-facing pages)
├── instructions/  → AI instruction YAML files (task_instructions, business_rules)
└── initWorkflow.ts → One-time setup: create DB tables, seed data

config/
└── config.json    → Tenant-configurable settings (shown in admin portal)

bundle.yaml        → Workflow manifest: routes, domains, permissions, AI workers
workflow.yaml      → Step definitions, conditions, routing logic
```

## Handler Conventions

### API Handler
```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export default async function handler(
  sdk: AIHFPlatform,
  request: Request
): Promise<Response> {
  const body = await request.json();
  // ... use sdk.entities, sdk.database, sdk.tasks etc.
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### UI Handler
```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export default async function handler(
  sdk: AIHFPlatform,
  request: Request
): Promise<string> {
  // Return an HTML string — the platform renders it
  return `<div class="aihf-container">...</div>`;
}
```

### Work Domain (AI Worker) Handler
```typescript
export default async function handler(
  sdk: AIHFPlatform,
  request: Request,
  claudeOutput?: any   // Present when step has an instruction YAML
): Promise<{ hasWork: boolean; [key: string]: any }> {
  // Always return hasWork — the platform evaluates workflow.yaml conditions on output
  return { hasWork: true, result: claudeOutput?.decision };
}
```

## CLI Commands

| Command | Purpose |
|---------|---------|
| `aihf init <name>` | Scaffold a new workflow bundle |
| `aihf compile .` | Compile TypeScript → JavaScript (validates SDK usage) |
| `aihf validate .` | Validate bundle.yaml, workflow.yaml, config.json structure |
| `aihf bundle .` | Produce `<name>.zip` for upload to admin.aihf.io |
| `aihf eval . -i src/instructions/my.instruction.yaml -d test-data/cases.json` | Test AI instruction prompts against the Claude API before deploying |

## Testing AI Instructions (eval)

If this workflow has steps with `.instruction.yaml` files, use `aihf eval` to test them
before bundling and deploying. Eval calls the Claude API with the same prompt structure
the platform uses in production — a passing eval means production will behave identically.

Requires `ANTHROPIC_API_KEY` environment variable (your own Anthropic API key).

```bash
export ANTHROPIC_API_KEY=sk-ant-...
aihf eval . \
  --instructions src/instructions/my-task.instruction.yaml \
  --dataset test-data/scenarios.json \
  --runs 3
```

## Deployment Flow

```
aihf compile .   →   aihf validate .   →   aihf bundle .   →   Upload ZIP at admin.aihf.io
```

Do not deploy workflow code directly to Cloudflare — the AIHF platform handles all
infrastructure. Your only deployment action is uploading the ZIP to admin.aihf.io.

## SDK Key Capabilities

| SDK Object | Purpose |
|-----------|---------|
| `sdk.entities` | User/entity management, auth, roles, groups |
| `sdk.database` | Tenant-scoped D1 SQL database |
| `sdk.tasks` | Workflow task lifecycle (create, update, complete) |
| `sdk.files` | File upload/download via platform storage |
| `sdk.emails` | Send transactional emails via platform templates |
| `sdk.billing` | Stripe subscription and payment management |
| `sdk.credentials` | Secure credential storage per entity |
| `sdk.preferences` | Entity-level preference storage |
| `sdk.containers` | Long-running container job management |
| `sdk.utilities` | Platform utilities (slugs, tokens, formatting) |
| `sdk.auth` | Authentication flows (magic link, OAuth, passkey) |

Full reference: [SDK Reference](./docs/SDK_REFERENCE.md)

## Key Constraints

These are enforced by `aihf validate` and the platform at runtime:

1. **Only import from `@aihf/platform-sdk`** — no other platform imports
2. **All routes declared in `bundle.yaml`** — unregistered routes are rejected
3. **UI handlers return strings** — not `Response` objects
4. **Work handlers return `{ hasWork: boolean, ... }`** — always include `hasWork`
5. **`initWorkflow.ts` must be idempotent** — use `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`
6. **No direct Cloudflare bindings** — all platform resources go through the SDK

## Further Reading

- [Getting Started](./docs/GETTING_STARTED.md)
- [Workflow Concepts](./docs/WORKFLOW_CONCEPTS.md)
- [AI Workers Guide](./docs/AI_WORKERS.md)
- [Prompt Evaluation Guide](./docs/PROMPT_EVAL.md)
- [SDK Reference](./docs/SDK_REFERENCE.md)
- [Bundle.yaml Reference](./docs/BUNDLE_YAML.md)
- [Authentication](./docs/AUTHENTICATION.md)
- [Payments](./docs/PAYMENTS.md)
