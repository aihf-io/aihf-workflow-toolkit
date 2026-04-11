# Config.json Guide

The `config.json` file provides tenant-configurable settings for your workflow. These settings are structured using the AIHF standard `WorkflowConfig` / `WorkflowConfigField` schema and can be customized per-deployment without changing code.

## WorkflowConfig Schema

```typescript
interface WorkflowConfig {
  name: string;
  description: string;
  version: number;
  fields: WorkflowConfigField[];
}

interface WorkflowConfigField {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'textarea' | 'select' | 'multiselect';
  default: boolean | number | string | string[];
  value?: boolean | number | string | string[];   // Runtime value (user editable)
  description: string;
  placeholder?: string;
  options?: { value: number | string; label: string }[];
  dependsOn?: { field: string; value: boolean | number | string | string[] };
  min?: number;    // For 'number' fields
  max?: number;    // For 'number' fields
  step?: number;   // For 'number' fields
}
```

## Overview

```json
{
  "name": "My Workflow Config",
  "description": "Tenant-configurable settings for My Workflow",
  "fields": [
    {
      "id": "company_name",
      "label": "Company Name",
      "type": "string",
      "default": "Acme Corp",
      "description": "Your company or organization name",
      "placeholder": "Enter company name"
    },
    {
      "id": "dark_mode",
      "label": "Dark Mode",
      "type": "boolean",
      "default": false,
      "description": "Enable dark mode for all UI pages"
    },
    {
      "id": "max_uploads",
      "label": "Maximum Uploads",
      "type": "number",
      "default": 10,
      "description": "Maximum number of files that can be uploaded per session",
      "min": 1,
      "max": 100,
      "step": 1
    },
    {
      "id": "theme",
      "label": "Theme",
      "type": "select",
      "default": "blue",
      "description": "Primary UI theme color",
      "options": [
        { "value": "blue", "label": "Blue" },
        { "value": "green", "label": "Green" },
        { "value": "purple", "label": "Purple" }
      ]
    },
    {
      "id": "notification_channels",
      "label": "Notification Channels",
      "type": "multiselect",
      "default": ["email"],
      "description": "Channels to use for notifications",
      "options": [
        { "value": "email", "label": "Email" },
        { "value": "sms", "label": "SMS" },
        { "value": "push", "label": "Push Notification" }
      ]
    },
    {
      "id": "sms_provider",
      "label": "SMS Provider",
      "type": "select",
      "default": "twilio",
      "description": "SMS provider (only shown when SMS is enabled)",
      "options": [
        { "value": "twilio", "label": "Twilio" },
        { "value": "vonage", "label": "Vonage" }
      ],
      "dependsOn": {
        "field": "notification_channels",
        "value": "sms"
      }
    }
  ]
}
```

## Accessing Config Values

Use `sdk.workflows.getWorkflowConfigHelper()` to get a typed helper for your config, or `sdk.workflows.getWorkflowConfig()` for the raw JSON string.

### WorkflowConfigHelper

The `WorkflowConfigHelper` class provides typed access to field values by their `id`:

```typescript
class WorkflowConfigHelper {
  get<T>(fieldId: string, defaultValue: T): T;
  getString(fieldId: string, defaultValue?: string): string;
  getNumber(fieldId: string, defaultValue?: number): number;
  getBoolean(fieldId: string, defaultValue?: boolean): boolean;
  getArray<T>(fieldId: string, defaultValue?: T[]): T[];
  hasField(fieldId: string): boolean;
  getRawConfig(): WorkflowConfigData;
  getFieldIds(): string[];
}
```

### Usage in API Handlers

```typescript
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Get the typed config helper
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);

  // Access fields by ID with typed accessors
  const companyName = config.getString('company_name', 'Default Name');
  const darkMode = config.getBoolean('dark_mode', false);
  const maxUploads = config.getNumber('max_uploads', 5);
  const theme = config.getString('theme', 'blue');
  const channels = config.getArray<string>('notification_channels', ['email']);

  // Check if a field exists
  if (config.hasField('sms_provider')) {
    const smsProvider = config.getString('sms_provider', 'twilio');
  }

  return new Response(JSON.stringify({ companyName, darkMode, maxUploads }));
}
```

### Usage in UI Renderers

```typescript
export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);

  const companyName = config.getString('company_name', 'App');
  const darkMode = config.getBoolean('dark_mode', false);
  const theme = config.getString('theme', 'blue');

  const themeColors: Record<string, string> = {
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#8b5cf6'
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${companyName}</title>
  <style>
    :root {
      --primary: ${themeColors[theme] || '#3b82f6'};
      --bg: ${darkMode ? '#1f2937' : '#ffffff'};
      --text: ${darkMode ? '#f9fafb' : '#111827'};
    }
    body {
      font-family: system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .btn-primary { background: var(--primary); color: white; border: none; padding: 12px 24px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${companyName}</h1>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

### Raw Config Access

If you need the raw config JSON string (e.g., for custom parsing):

```typescript
const rawConfigJson = await sdk.workflows.getWorkflowConfig(workflowName, workflowVersion);
const parsed = JSON.parse(rawConfigJson); // WorkflowConfig object
```

## Field Types

### boolean

A true/false toggle. The `value` (or `default`) is a `boolean`.

```json
{
  "id": "analytics_enabled",
  "label": "Enable Analytics",
  "type": "boolean",
  "default": true,
  "description": "Track usage analytics for this workflow"
}
```

### number

A numeric value. Supports optional `min`, `max`, and `step` constraints.

```json
{
  "id": "retry_count",
  "label": "Retry Count",
  "type": "number",
  "default": 3,
  "description": "Number of times to retry failed operations",
  "min": 0,
  "max": 10,
  "step": 1
}
```

### string

A free-text string value. Supports optional `placeholder`.

```json
{
  "id": "support_email",
  "label": "Support Email",
  "type": "string",
  "default": "support@example.com",
  "description": "Email address for support inquiries",
  "placeholder": "support@yourdomain.com"
}
```

### select

A single-choice dropdown. Requires `options` array with `{value, label}` entries.

```json
{
  "id": "locale",
  "label": "Default Locale",
  "type": "select",
  "default": "en-AU",
  "description": "Default language and region",
  "options": [
    { "value": "en-AU", "label": "English (Australia)" },
    { "value": "en-US", "label": "English (US)" },
    { "value": "en-GB", "label": "English (UK)" }
  ]
}
```

### multiselect

A multi-choice selection. The `default` and `value` are `string[]`. Requires `options` array.

```json
{
  "id": "allowed_file_types",
  "label": "Allowed File Types",
  "type": "multiselect",
  "default": ["pdf", "docx"],
  "description": "File types accepted for upload",
  "options": [
    { "value": "pdf", "label": "PDF" },
    { "value": "docx", "label": "Word Document" },
    { "value": "xlsx", "label": "Excel Spreadsheet" },
    { "value": "csv", "label": "CSV" }
  ]
}
```

## Conditional Fields (dependsOn)

Fields can be conditionally shown based on another field's value:

```json
{
  "fields": [
    {
      "id": "analytics_enabled",
      "label": "Enable Analytics",
      "type": "boolean",
      "default": false,
      "description": "Track usage analytics"
    },
    {
      "id": "analytics_provider",
      "label": "Analytics Provider",
      "type": "select",
      "default": "google",
      "description": "Which analytics provider to use",
      "options": [
        { "value": "google", "label": "Google Analytics" },
        { "value": "mixpanel", "label": "Mixpanel" }
      ],
      "dependsOn": {
        "field": "analytics_enabled",
        "value": true
      }
    },
    {
      "id": "analytics_tracking_id",
      "label": "Tracking ID",
      "type": "string",
      "default": "",
      "description": "Analytics tracking identifier",
      "placeholder": "GA-XXXXXXXX",
      "dependsOn": {
        "field": "analytics_enabled",
        "value": true
      }
    }
  ]
}
```

## Complete Example

```json
{
  "name": "Document Review Configuration",
  "description": "Settings for the document review workflow",
  "fields": [
    {
      "id": "company_name",
      "label": "Company Name",
      "type": "string",
      "default": "Acme Corp",
      "description": "Company name displayed in the UI",
      "placeholder": "Your Company"
    },
    {
      "id": "primary_color",
      "label": "Primary Color",
      "type": "select",
      "default": "blue",
      "description": "Primary theme color",
      "options": [
        { "value": "blue", "label": "Blue" },
        { "value": "green", "label": "Green" },
        { "value": "purple", "label": "Purple" },
        { "value": "red", "label": "Red" }
      ]
    },
    {
      "id": "dark_mode",
      "label": "Dark Mode",
      "type": "boolean",
      "default": false,
      "description": "Enable dark mode across all pages"
    },
    {
      "id": "max_file_size_mb",
      "label": "Max File Size (MB)",
      "type": "number",
      "default": 10,
      "description": "Maximum file size for uploads in megabytes",
      "min": 1,
      "max": 50,
      "step": 1
    },
    {
      "id": "allowed_file_types",
      "label": "Allowed File Types",
      "type": "multiselect",
      "default": ["pdf", "docx"],
      "description": "File types accepted for document upload",
      "options": [
        { "value": "pdf", "label": "PDF" },
        { "value": "docx", "label": "Word" },
        { "value": "xlsx", "label": "Excel" },
        { "value": "csv", "label": "CSV" }
      ]
    },
    {
      "id": "auto_approve_threshold",
      "label": "Auto-Approve Confidence",
      "type": "number",
      "default": 0.95,
      "description": "AI confidence threshold for auto-approval (0.0 - 1.0)",
      "min": 0,
      "max": 1,
      "step": 0.05
    },
    {
      "id": "notify_on_approval",
      "label": "Notify on Approval",
      "type": "boolean",
      "default": true,
      "description": "Send email when document is approved"
    },
    {
      "id": "notification_email",
      "label": "Notification Email",
      "type": "string",
      "default": "",
      "description": "Email address for approval notifications",
      "placeholder": "notifications@yourcompany.com",
      "dependsOn": {
        "field": "notify_on_approval",
        "value": true
      }
    }
  ]
}
```

Usage:

```typescript
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const [workflowName, workflowVersion] = [args[0], args[1]];
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);

  const maxSize = config.getNumber('max_file_size_mb', 10);
  const allowedTypes = config.getArray<string>('allowed_file_types', ['pdf']);
  const threshold = config.getNumber('auto_approve_threshold', 0.95);

  // Use config values in your logic
  if (fileSize > maxSize * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large' }), { status: 400 });
  }

  return new Response(JSON.stringify({ maxSize, allowedTypes, threshold }));
}
```

## Best Practices

1. **Always provide defaults**: Every field must have a `default` value so the workflow functions without configuration
2. **Use descriptive field IDs**: Field IDs are used as keys in `config.get()` calls, so make them clear (e.g., `max_file_size_mb` not `mfs`)
3. **Add descriptions**: Every field should have a `description` to guide tenants configuring the workflow
4. **Use dependsOn for conditional fields**: Hide irrelevant fields based on other field values
5. **Keep secrets out**: Use environment variables or the platform's secrets management for API keys, not config.json
6. **Use appropriate types**: Use `select`/`multiselect` when there's a fixed set of valid values, `number` for numeric values with constraints

## Security Considerations

- Config values are accessible to your handlers but not directly to clients
- Never store secrets (API keys, passwords) in config.json
- Use the platform's credentials management for sensitive values
- Config is tenant-isolated; one tenant cannot access another's config

## Related Documentation

- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Workflow bundle implementation
- [Workflow.yaml Reference](./WORKFLOW_YAML.md) - Workflow definition and routing
- [Platform SDK Reference](./SDK_REFERENCE.md) - Full API documentation
