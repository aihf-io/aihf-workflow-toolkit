# Getting Started

Build your first AIHF.io workflow from scratch.

## Prerequisites

- Node.js 18 or later
- An AIHF.io tenant account ([Sign up](https://aihf.io))

## Step 1: Install the CLI

```bash
npm install -g @aihf/platform-sdk
```

Verify installation:

```bash
aihf --version
```

## Step 2: Create a New Workflow

```bash
aihf init contact-form --template basic-workflow
cd contact-form
```

This creates:

```
contact-form/
├── workflow.yaml           # Workflow definition (steps, flow, permissions)
├── bundle.yaml             # Implementation manifest (routes, UI, API files)
├── config/
│   └── config.json         # Tenant-configurable settings (fields-based format)
├── package.json            # Dependencies
└── src/
    ├── initWorkflow.ts     # Database/resource initialization (runs on deploy)
    ├── api/
    │   └── submit.ts       # API handler
    ├── ui/
    │   └── main.ts         # UI renderer
    └── static/
        ├── mystyle.css     # Static CSS stylesheet
        └── myfunctions.js  # Static client-side JavaScript
```

> **Note:** No `tsconfig.json` is included — the CLI generates it automatically during `aihf compile`.

## Step 3: Understand the Two YAML Files

AIHF workflows use two files that work together:

### workflow.yaml - Defines the Flow

```yaml
name: "contact-form"
metadata:
  title: "Contact Form"
  version: 1
  description: "Simple contact form workflow"

status:
  enabled: true
  visible: true

spec:
  groups: []

  steps:
    - id: "main"
      name: "Contact Form"
      type: 'workflow-entry'
      permissions:
        required_groups: []
      conditions:
        - type: "default"
          target_true: "main"  # Single-step workflow loops back
```

### bundle.yaml - Defines the Implementation

```yaml
name: contact-form
version: 1

steps:
  - id: "main"
    route: '/'
    domain: 'app'
    ui:
      dynamic: 'ui/main.ts'
    api:
      - route_match: '/submit'
        file: 'api/submit.ts'
        input:
          - name: 'message'
            type: 'string'
            description: 'User message'
        output:
          - name: 'success'
            type: 'boolean'
          - name: 'response'
            type: 'string'
```

**Key relationship:**
- **workflow.yaml**: Defines step `id: "main"` with flow logic
- **bundle.yaml**: Implements step `id: "main"` with route, UI, and API handlers
- Step IDs must match between both files

## Step 4: Build the UI

Edit `src/ui/main.ts`:

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Contact Us</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      max-width: 500px;
      width: 100%;
    }
    h1 { margin-bottom: 8px; color: #1a1a1a; }
    p { color: #666; margin-bottom: 24px; }
    textarea {
      width: 100%;
      min-height: 150px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      resize: vertical;
      margin-bottom: 16px;
    }
    textarea:focus { outline: none; border-color: #3b82f6; }
    button {
      width: 100%;
      padding: 14px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #2563eb; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    .result {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      display: none;
    }
    .result.success { background: #dcfce7; color: #166534; }
    .result.error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Contact Us</h1>
    <p>We'd love to hear from you. Send us a message!</p>

    <form id="contactForm">
      <textarea
        name="message"
        placeholder="Your message..."
        required
      ></textarea>
      <button type="submit" id="submitBtn">Send Message</button>
    </form>

    <div id="result" class="result"></div>
  </div>

  <script>
    const form = document.getElementById('contactForm');
    const btn = document.getElementById('submitBtn');
    const result = document.getElementById('result');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      btn.disabled = true;
      btn.textContent = 'Sending...';
      result.style.display = 'none';

      try {
        const response = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: form.message.value
          })
        });

        const data = await response.json();

        result.className = 'result ' + (data.success ? 'success' : 'error');
        result.textContent = data.response || data.error || 'Something went wrong';
        result.style.display = 'block';

        if (data.success) {
          form.reset();
        }
      } catch (error) {
        result.className = 'result error';
        result.textContent = 'Network error. Please try again.';
        result.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Message';
      }
    });
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

## Step 5: Build the API Handler

Edit `src/api/submit.ts`:

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Parse the validated input
  const input = JSON.parse(sanitisedInput);

  // Validate message
  if (!input.message || input.message.trim().length === 0) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Message is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Store the message in the database
  await sdk.database.insert(workflowName, 'messages', {
    id: crypto.randomUUID(),
    message: input.message.trim(),
    created_at: new Date().toISOString(),
    status: 'new'
  });

  // Return success response
  return new Response(JSON.stringify({
    success: true,
    response: 'Thank you! Your message has been received.'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Step 6: Compile Your Workflow

```bash
aihf compile .
```

This:
1. Generates `tsconfig.json` with correct `@aihf/platform-sdk` type paths
2. Compiles TypeScript to JavaScript
3. Validates Platform SDK usage
4. Creates `dist/` directory with compiled output
5. Copies `config/config.json` into `dist/config/config.json`

Expected output:

```
🔨 Compiling workflow bundle...
📁 Bundle path: /path/to/contact-form
✅ TypeScript compilation successful
✅ Config generated: dist/config/config.json
✅ Compilation complete!
```

## Step 7: Validate Your Bundle

```bash
aihf validate .
```

This checks:
- workflow.yaml structure and step definitions
- bundle.yaml structure and implementation
- Step IDs match between both files
- All referenced UI and API files exist
- Compiled output is present

Expected output:

```
🔍 Validating workflow bundle...
✅ workflow.yaml is valid
✅ bundle.yaml is valid
✅ Step IDs match between files
✅ All UI files found
✅ All API files found
✅ Validation passed!
```

## Step 8: Create Deployment Bundle

```bash
aihf bundle .
```

This creates `contact-form.zip` ready for upload.

Expected output:

```
📦 Creating deployment bundle...
📋 Adding configuration files...
📦 Adding compiled output...
✅ Bundle created successfully!
📊 Bundle size: 12 KB
📁 File: /path/to/contact-form.zip

🚀 Ready for deployment!
   Upload this bundle at: https://admin.aihf.io
```

## Step 9: Deploy to AIHF.io

1. Log in to [admin.aihf.io](https://admin.aihf.io)
2. Navigate to **Workflow Deployment** → **Deploy New**
3. Upload `contact-form.zip`
4. Click **Deploy**

Your workflow is now live within your AIHF Tenant at:
```
https://app.aihf.io/app/<workflowName>/<workflowVersion>/<step>

or 

https://myapp.com/app/<workflowName>/<workflowVersion>/<step>

if you have a custom domain hosted by AIHF
```

## What's Next?

### Initialize Your Database

If your workflow uses `sdk.database`, add table creation to `src/initWorkflow.ts`:

```typescript
await sdk.database.execute(workflowName, `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  )
`);
```

The gateway runs `initWorkflow` automatically during deployment. You can also re-run it from admin.aihf.io. See [Workflow Initialization](./INIT_WORKFLOW.md) for details.

### Add More Steps

Expand your workflow with multiple steps:

```yaml
steps:
  - id: "form"
    route: '/'
    domain: 'app'
    # ...

  - id: "confirmation"
    route: '/thank-you'
    domain: 'app'
    # ...
```

### Add AI Processing

Use work domain for AI automation:

```yaml
steps:
  - id: "analyze"
    route: '/analyze'
    domain: 'work'
    api:
      - route_match: '/aihf-ai-step'
        file: 'api/analyze.ts'
```

### Add Payments

Integrate Stripe checkout:

```typescript
const checkout = await sdk.billing.createCheckoutSession({
  entityId: user.entity_id,
  planId: 'monthly-pro',
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/cancel'
});
return Response.redirect(checkout.checkoutUrl, 302);
```

### Create a Multi-Workflow Suite

For products with multiple related workflows that share code:

```bash
# Create the suite root
aihf init my-product --type multi-part

# Add workflow bundles to the suite
cd my-product
aihf init signup --suite .
aihf init dashboard --suite .

# Compile all bundles at once
aihf compile-suite .
```

Workflows in a suite can share TypeScript types and utilities via the `shared/` directory using `@suite/shared/*` imports. See [Workflow Concepts](./WORKFLOW_CONCEPTS.md#multi-part-workflow-suites) for details.

## Documentation

- [Workflow.yaml Reference](./WORKFLOW_YAML.md) - Steps, conditions, and routing logic
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Routes, UI files, and API handlers
- [Config.json Guide](./CONFIG_JSON.md) - Tenant-configurable settings
- [SDK Reference](./SDK_REFERENCE.md) - Full API documentation
- [Workflow Concepts](./WORKFLOW_CONCEPTS.md) - Core concepts explained
- [Workflow Initialization](./INIT_WORKFLOW.md) - Database setup and data migration
- [Authentication](./AUTHENTICATION.md) - OAuth, Magic Links, TOTP
- [Payments](./PAYMENTS.md) - Stripe integration
- [AI Workers](./AI_WORKERS.md) - Work domain automation

## Troubleshooting

### "Module not found" during compile

Ensure dependencies are installed:
```bash
npm install
```

### "TypeScript errors" during compile

Check your TypeScript syntax. Common issues:
- Missing type imports
- Incorrect function signatures
- Missing async/await

### "Validation failed" errors

Check that:
- workflow.yaml and bundle.yaml syntax is correct
- Step IDs match between workflow.yaml and bundle.yaml
- All files referenced in bundle.yaml exist in `src/`
- Compiled files exist in `dist/`

### Bundle upload fails

Ensure:
- Bundle was created with `aihf bundle`
- ZIP file is not corrupted
- You have deploy permissions in your tenant
