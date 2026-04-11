# Workflow Templates

Starter templates for building AIHF.io workflows.

## Available Templates

| Template | Description | Best For |
|----------|-------------|----------|
| `basic-workflow` | Simple single-step workflow with form UI | Learning, quick prototypes |
| `full-stack` | Multi-step workflow with auth, database, and navigation | Full applications |
| `multi-part` | Suite structure for multiple related workflows | Multi-workflow products |

## Usage

```bash
# Initialize with a template
aihf init my-project --template basic-workflow

# Or copy manually
cp -r templates/basic-workflow my-project
cd my-project
npm install
aihf build
```

## Template Structure

Each template includes:

- `bundle.yaml` - Handler manifest (routes, UI files, API handlers, input/output params)
- `workflow.yaml` - Flow logic (steps, conditions, permissions, routing)
- `config/config.json` - Tenant-configurable settings
- `src/api/` - API handlers (`invokedByAIHF`)
- `src/ui/` - UI renderers (`renderAIHFWorkflowStepUI`)
- `package.json` - Dependencies

## Key Patterns

These patterns are critical for working AIHF workflows:

### Body Fragments (not full HTML)

UI handlers must return body fragments, NOT full `<!DOCTYPE html>` documents. The platform wraps your output in a shell page and extracts `<body>` content via regex — `<head>` and `<style>` tags outside the body are stripped.

```typescript
// CORRECT — body fragment with inline <style>
const html = `
<style>.my-app { color: blue; }</style>
<div class="my-app">Hello</div>
`;

// WRONG — full document (styles in <head> will be stripped)
const html = `<!DOCTYPE html><html><head><style>...</style></head><body>...</body></html>`;
```

### Include taskId in fetch calls

Always include `window.AIHF_TASK_ID` in POST request bodies. Without it, every API call creates a new task.

```javascript
fetch('/my-route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    myData: value,
    taskId: window.AIHF_TASK_ID || ''
  })
});
```

### Scope CSS with unique prefixes

Avoid conflicts with the platform shell by prefixing all CSS classes:

```css
.my-app-header { }  /* Good */
.header { }          /* Bad — conflicts with platform */
```

### Wrap JavaScript in IIFE

Prevent global scope pollution:

```javascript
(function() {
  // Your code here
})();
```

### Step IDs must match

Step IDs in `bundle.yaml` and `workflow.yaml` must match exactly. Condition variables (e.g., `action`) must be declared as output parameters in `bundle.yaml`.
